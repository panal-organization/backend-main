#Requires -Version 5.1
<#
.SYNOPSIS
    Levanta y valida todo el entorno DevOps de Panal con un solo comando.

.DESCRIPTION
    Flujo:
      1) Valida Docker
      2) Libera puertos en conflicto (3000, 8000, 5500)
      3) Levanta stack Docker (backend, mongo, prometheus, grafana, loki, promtail, cadvisor)
      4) Levanta AI service local (uvicorn en :8000)
      5) Levanta frontend demo local en :5500 (si existe carpeta)
      6) Espera endpoints clave con retry
      7) Ejecuta devops-demo-check.ps1 -SkipBuild
      8) Auto-fix si detecta problemas en Prometheus/Grafana/Loki
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

$global:status = [ordered]@{}

function Log-Info([string]$msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Log-Ok([string]$msg) { Write-Host "[ OK ] $msg" -ForegroundColor Green }
function Log-Warn([string]$msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Log-Err([string]$msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

function Mark-Status([string]$key, [string]$value) { $global:status[$key] = $value }

function Test-HttpReady([string]$url, [int]$timeoutSec = 5) {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec $timeoutSec
        return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
    } catch {
        return $false
    }
}

function Wait-HttpReady([string]$name, [string]$url, [int]$maxAttempts = 40, [int]$intervalSec = 3) {
    for ($i = 1; $i -le $maxAttempts; $i++) {
        if (Test-HttpReady -url $url) {
            Log-Ok "$name disponible en $url"
            return $true
        }
        Start-Sleep -Seconds $intervalSec
    }

    Log-Err "$name no respondio tras $($maxAttempts * $intervalSec)s -> $url"
    return $false
}

function Get-PortListeners([int]$port) {
    return Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
}

function Stop-PortConflicts([int]$port, [switch]$skipDockerOwned) {
    $listeners = Get-PortListeners -port $port
    if (-not $listeners) {
        Log-Ok "Puerto $port libre"
        return
    }

    $listenerPids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($listenerPid in $listenerPids) {
        $proc = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
        if (-not $proc) {
            continue
        }

        $name = $proc.ProcessName
        $isDockerLike = $name -match 'docker|com\.docker|vmmem|wsl|vpnkit' 

        if ($skipDockerOwned -and $isDockerLike) {
            Log-Warn "Puerto $port ocupado por proceso Docker-like '$name' (pid $listenerPid). No se mata."
            continue
        }

        try {
            Stop-Process -Id $listenerPid -Force -ErrorAction Stop
            Log-Ok "Proceso '$name' (pid $listenerPid) detenido en puerto $port"
        } catch {
            Log-Warn "No se pudo detener pid $listenerPid en puerto ${port}: $($_.Exception.Message)"
        }
    }
}

function Ensure-DockerReady {
    Log-Info "Validando Docker..."
    docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker daemon no disponible. Inicia Docker Desktop y reintenta."
    }

    docker compose version *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose no esta disponible."
    }

    Log-Ok "Docker y Docker Compose OK"
    Mark-Status 'Docker' 'PASS'
}

function Ensure-DockerStack {
    Log-Info "Levantando stack Docker (npm run devops:up)..."
    npm run devops:up
    if ($LASTEXITCODE -ne 0) {
        throw "Fallo al ejecutar 'npm run devops:up'."
    }

    $services = @('panal-backend','panal-mongo','panal-prometheus','panal-grafana','panal-loki','panal-promtail','panal-cadvisor')
    foreach ($svc in $services) {
        $running = docker ps --format '{{.Names}}' | Select-String -SimpleMatch $svc
        if (-not $running) {
            Log-Warn "Contenedor esperado no visible aun: $svc"
        }
    }

    Mark-Status 'Docker Stack' 'PASS'
}

function Test-PythonHasUvicorn([string]$pythonExe, [string]$workDir) {
    if (-not (Test-Path $pythonExe)) {
        return $false
    }

    Push-Location $workDir
    try {
        & $pythonExe -c "import uvicorn" *> $null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    } finally {
        Pop-Location
    }
}

function Get-AIPythonCandidate([string]$aiRoot) {
    $candidates = @(
        (Join-Path $aiRoot '.venv\Scripts\python.exe'),
        (Join-Path $root '.venv\Scripts\python.exe')
    )

    foreach ($candidate in $candidates) {
        if (Test-PythonHasUvicorn -pythonExe $candidate -workDir $aiRoot) {
            return $candidate
        }
    }

    return $null
}

function Repair-AIEnvironment([string]$aiRoot) {
    $venvDir = Join-Path $aiRoot '.venv'
    $venvPython = Join-Path $venvDir 'Scripts\python.exe'
    $reqFile = Join-Path $aiRoot 'requirements.txt'

    Log-Warn "No hay Python con uvicorn listo para AI service. Intentando auto-reparacion de venv..."

    if (Test-Path $venvDir) {
        try {
            Remove-Item $venvDir -Recurse -Force -ErrorAction Stop
            Log-Info "Venv anterior removido: $venvDir"
        } catch {
            Log-Warn "No se pudo eliminar venv anterior por completo: $($_.Exception.Message)"
        }
    }

    Push-Location $aiRoot
    try {
        py -3.12 -m venv .venv
        if ($LASTEXITCODE -ne 0) {
            python -m venv .venv
        }

        if (-not (Test-Path $venvPython)) {
            throw "No se pudo crear .venv para AI service"
        }

        & $venvPython -m pip install --upgrade pip
        if ($LASTEXITCODE -ne 0) {
            throw "Fallo al actualizar pip en AI venv"
        }

        if (-not (Test-Path $reqFile)) {
            throw "requirements.txt no encontrado en panal-ai-service"
        }

        & $venvPython -m pip install -r $reqFile
        if ($LASTEXITCODE -ne 0) {
            throw "Fallo al instalar requirements del AI service"
        }

        Log-Ok "AI venv reparado correctamente"
    } finally {
        Pop-Location
    }
}

function Ensure-AIService {
    $aiRoot = Join-Path $root 'panal-ai-service'
    if (-not (Test-Path $aiRoot)) {
        Log-Warn "No se encontro panal-ai-service/. Se omite AI local."
        Mark-Status 'AI Service' 'WARNING'
        return
    }

    if (Test-HttpReady -url 'http://127.0.0.1:8000/docs') {
        Log-Ok "AI service ya estaba corriendo en :8000"
        Mark-Status 'AI Service' 'PASS'
        return
    }

    $venvPython = Get-AIPythonCandidate -aiRoot $aiRoot
    if (-not $venvPython) {
        try {
            Repair-AIEnvironment -aiRoot $aiRoot
        } catch {
            Log-Warn "No se pudo reparar AI service automaticamente: $($_.Exception.Message)"
        }
        $venvPython = Get-AIPythonCandidate -aiRoot $aiRoot
    }

    if (-not $venvPython) {
        Log-Warn "No se encontro Python funcional para AI service (uvicorn). El stack Docker continua sin AI local."
        Mark-Status 'AI Service' 'WARNING'
        return
    }

    $aiLogDir = Join-Path $root 'logs'
    if (-not (Test-Path $aiLogDir)) {
        New-Item -ItemType Directory -Path $aiLogDir | Out-Null
    }
    $aiStdout = Join-Path $aiLogDir 'ai-service.out.log'
    $aiStderr = Join-Path $aiLogDir 'ai-service.err.log'

    Log-Info "Levantando AI service en :8000 con uvicorn..."
    Start-Process -FilePath $venvPython `
        -WorkingDirectory $aiRoot `
        -ArgumentList '-m','uvicorn','app.main:app','--host','0.0.0.0','--port','8000','--reload' `
        -RedirectStandardOutput $aiStdout `
        -RedirectStandardError $aiStderr `
        -WindowStyle Minimized | Out-Null

    if (-not (Wait-HttpReady -name 'AI Service' -url 'http://127.0.0.1:8000/docs' -maxAttempts 40 -intervalSec 2)) {
        $errTail = ''
        if (Test-Path $aiStderr) {
            $errTail = (Get-Content $aiStderr -Tail 12 -ErrorAction SilentlyContinue) -join " | "
        }
        Log-Warn "AI service no levanto en :8000. Revisa $aiStderr. Ultimos errores: $errTail"
        Mark-Status 'AI Service' 'WARNING'
        return
    }

    Mark-Status 'AI Service' 'PASS'
}

function Find-FrontendDemoDir {
    $candidates = @(
        (Join-Path $root 'frontend'),
        (Join-Path $root 'demo'),
        (Join-Path $root 'public'),
        (Join-Path $root 'ai-demo'),
        (Join-Path $root 'panal-frontend')
    )

    foreach ($dir in $candidates) {
        if (Test-Path $dir) {
            return $dir
        }
    }

    return $null
}

function Test-FrontendDemoConfigured {
    $dir = Find-FrontendDemoDir
    if ($dir) {
        return $true
    }

    $fileCandidates = @(
        (Join-Path $root 'ai-demo\index.html'),
        (Join-Path $root 'frontend\index.html'),
        (Join-Path $root 'public\index.html')
    )

    foreach ($file in $fileCandidates) {
        if (Test-Path $file) {
            return $true
        }
    }

    return $false
}

function Ensure-FrontendDemo {
    if (-not (Test-FrontendDemoConfigured)) {
        Log-Info "Frontend Demo no configurado en este proyecto. Se omite puerto :5500"
        Mark-Status 'Frontend Demo' 'NO CONFIGURADO'
        return
    }

    if (Test-HttpReady -url 'http://127.0.0.1:5500') {
        Log-Ok "Frontend demo ya estaba corriendo en :5500"
        Mark-Status 'Frontend Demo' 'PASS'
        return
    }

    $frontendDir = Find-FrontendDemoDir
    if (-not $frontendDir) {
        Log-Warn "No se encontro carpeta de frontend demo en este workspace. Se omite :5500"
        Mark-Status 'Frontend Demo' 'WARNING'
        return
    }

    Log-Info "Levantando frontend demo desde '$frontendDir' en :5500"

    $httpServerCmd = Get-Command http-server -ErrorAction SilentlyContinue
    if ($httpServerCmd) {
        Start-Process -FilePath $httpServerCmd.Source `
            -WorkingDirectory $frontendDir `
            -ArgumentList '-p','5500' `
            -WindowStyle Minimized | Out-Null
    } else {
        # Fallback con Python
        $py = Get-Command python -ErrorAction SilentlyContinue
        if (-not $py) {
            Log-Warn "No hay http-server ni python global para servir frontend demo."
            Mark-Status 'Frontend Demo' 'WARNING'
            return
        }

        Start-Process -FilePath $py.Source `
            -WorkingDirectory $frontendDir `
            -ArgumentList '-m','http.server','5500' `
            -WindowStyle Minimized | Out-Null
    }

    if (Wait-HttpReady -name 'Frontend Demo' -url 'http://127.0.0.1:5500' -maxAttempts 25 -intervalSec 2) {
        Mark-Status 'Frontend Demo' 'PASS'
    } else {
        Mark-Status 'Frontend Demo' 'WARNING'
    }
}

function Wait-CoreServices {
    Log-Info "Esperando servicios core (con retries)..."

    $okBackend = Wait-HttpReady -name 'Backend /health' -url 'http://127.0.0.1:3000/health' -maxAttempts 40 -intervalSec 3
    $okProm = Wait-HttpReady -name 'Prometheus' -url 'http://127.0.0.1:9090/-/healthy' -maxAttempts 35 -intervalSec 3
    $okGraf = Wait-HttpReady -name 'Grafana' -url 'http://127.0.0.1:3001/api/health' -maxAttempts 35 -intervalSec 3
    $okLoki = Wait-HttpReady -name 'Loki' -url 'http://127.0.0.1:3100/ready' -maxAttempts 35 -intervalSec 3

    if (-not ($okBackend -and $okProm -and $okGraf -and $okLoki)) {
        throw "Uno o mas servicios core no respondieron."
    }

    Mark-Status 'Core Services' 'PASS'
}

function Test-PromTargetsUp([int]$attempts = 4, [int]$intervalSec = 3) {
    for ($i = 1; $i -le $attempts; $i++) {
        try {
            $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:9090/api/v1/targets' -TimeoutSec 8
            $obj = $r.Content | ConvertFrom-Json
            $targets = $obj.data.activeTargets

            $backend = $targets | Where-Object { $_.labels.job -eq 'backend' }
            $cadvisor = $targets | Where-Object { $_.labels.job -eq 'cadvisor' }

            if ($backend -and $backend.health -eq 'up' -and $cadvisor -and $cadvisor.health -eq 'up') {
                return $true
            }
        } catch {
            # reintento
        }

        Start-Sleep -Seconds $intervalSec
    }

    return $false
}

function Test-GrafanaDashboardPresent {
    try {
        $user = if ($env:GRAFANA_USER) { $env:GRAFANA_USER } else { 'admin' }
        $pass = if ($env:GRAFANA_PASSWORD) { $env:GRAFANA_PASSWORD } else { 'admin' }
        $b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${user}:${pass}"))
        $headers = @{ Authorization = "Basic $b64" }

        $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3001/api/search?type=dash-db' -Headers $headers -TimeoutSec 8
        $dash = $r.Content | ConvertFrom-Json
        return [bool]($dash | Where-Object { $_.uid -eq 'panal-devops-demo' })
    } catch {
        return $false
    }
}

function Test-LokiReceivingLogs {
    try {
        # Generar trafico minimo para forzar logs
        Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/health' -TimeoutSec 3 | Out-Null
        Start-Sleep -Seconds 2

        $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3100/loki/api/v1/labels' -TimeoutSec 8
        $obj = $r.Content | ConvertFrom-Json
        return [bool]($obj.data -contains 'job')
    } catch {
        return $false
    }
}

function AutoFix-Observability {
    Log-Info "Ejecutando auto-fix de observabilidad (si aplica)..."

    $promOk = Test-PromTargetsUp
    if (-not $promOk) {
        Log-Warn "Prometheus targets no estan UP. Reiniciando backend/prometheus/cadvisor..."
        docker compose restart backend prometheus cadvisor | Out-Null
        Start-Sleep -Seconds 8
        $promOk = Test-PromTargetsUp
    }

    $grafOk = Test-GrafanaDashboardPresent
    if (-not $grafOk) {
        Log-Warn "Dashboard no encontrado en Grafana. Reiniciando Grafana..."
        docker compose restart grafana | Out-Null
        Start-Sleep -Seconds 8
        $grafOk = Test-GrafanaDashboardPresent

        if (-not $grafOk) {
            Log-Warn "Grafana sigue sin dashboard. Limpiando volumen grafana_data y re-creando contenedor..."
            docker compose stop grafana | Out-Null
            docker volume rm backend-main_grafana_data | Out-Null
            docker compose up -d grafana | Out-Null
            Start-Sleep -Seconds 12
            $grafOk = Test-GrafanaDashboardPresent
        }
    }

    $lokiOk = Test-LokiReceivingLogs
    if (-not $lokiOk) {
        Log-Warn "Loki no muestra labels de logs. Reiniciando loki/promtail..."
        docker compose restart loki promtail | Out-Null
        Start-Sleep -Seconds 8
        $lokiOk = Test-LokiReceivingLogs
    }

    if ($promOk) { Log-Ok 'Prometheus targets UP'; Mark-Status 'Prometheus Targets' 'PASS' } else { Log-Warn 'Prometheus targets siguen inestables'; Mark-Status 'Prometheus Targets' 'WARNING' }
    if ($grafOk) { Log-Ok 'Grafana dashboard provisionado'; Mark-Status 'Grafana Dashboard' 'PASS' } else { Log-Warn 'Grafana dashboard no visible aun'; Mark-Status 'Grafana Dashboard' 'WARNING' }
    if ($lokiOk) { Log-Ok 'Loki recibiendo logs'; Mark-Status 'Loki Logs' 'PASS' } else { Log-Warn 'Loki aun no confirma labels de logs'; Mark-Status 'Loki Logs' 'WARNING' }
}

function Run-ValidationScript {
    $checkScript = Join-Path $root 'scripts\devops-demo-check.ps1'
    if (-not (Test-Path $checkScript)) {
        Log-Warn "No se encontro devops-demo-check.ps1. Se omite validacion extendida."
        Mark-Status 'DevOps Check Script' 'WARNING'
        return
    }

    Log-Info "Ejecutando validacion extendida..."
    & $checkScript -SkipBuild
    if ($LASTEXITCODE -eq 0) {
        Log-Ok "devops-demo-check.ps1 finalizo sin FAIL global"
        Mark-Status 'DevOps Check Script' 'PASS'
    } else {
        Log-Warn "devops-demo-check.ps1 devolvio codigo $LASTEXITCODE (revisar detalles)"
        Mark-Status 'DevOps Check Script' 'WARNING'
    }
}

try {
    Write-Host ""
    Write-Host "==============================================" -ForegroundColor Magenta
    Write-Host "   PANAL - RUN ALL DEVOPS                    " -ForegroundColor Magenta
    Write-Host "==============================================" -ForegroundColor Magenta
    Write-Host ""

    Ensure-DockerReady

    Log-Info "Liberando puertos en conflicto..."
    Stop-PortConflicts -port 3000 -skipDockerOwned
    Stop-PortConflicts -port 8000
    if (Test-FrontendDemoConfigured) {
        Stop-PortConflicts -port 5500
    } else {
        Log-Info "Puerto 5500 omitido (Frontend Demo no configurado)"
    }

    Ensure-DockerStack
    Ensure-AIService
    Ensure-FrontendDemo

    Wait-CoreServices
    AutoFix-Observability
    Run-ValidationScript

    Write-Host ""
    Write-Host "=== ENTORNO LISTO ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Backend:" -ForegroundColor Cyan
    Write-Host "http://localhost:3000"
    Write-Host ""
    Write-Host "AI Service:" -ForegroundColor Cyan
    Write-Host "http://localhost:8000"
    Write-Host ""
    if (Test-FrontendDemoConfigured) {
        Write-Host "Frontend Demo:" -ForegroundColor Cyan
        Write-Host "http://localhost:5500/ai-demo/index.html"
    } else {
        Write-Host "Frontend Demo: no configurado" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Prometheus:" -ForegroundColor Cyan
    Write-Host "http://localhost:9090"
    Write-Host ""
    Write-Host "Grafana:" -ForegroundColor Cyan
    Write-Host "http://localhost:3001"
    Write-Host ""
    Write-Host "cAdvisor:" -ForegroundColor Cyan
    Write-Host "http://localhost:8080"
    Write-Host ""
    Write-Host "Loki:" -ForegroundColor Cyan
    Write-Host "http://localhost:3100/ready"
    Write-Host ""

    Write-Host "Resumen rapido:" -ForegroundColor Magenta
    foreach ($k in $global:status.Keys) {
        Write-Host (" - {0}: {1}" -f $k, $global:status[$k])
    }

    Pop-Location
    exit 0
} catch {
    Log-Err $_.Exception.Message
    Write-Host ""
    Write-Host "El arranque global no pudo completarse." -ForegroundColor Red
    Write-Host "Recomendacion: revisa logs de docker compose y vuelve a ejecutar el script." -ForegroundColor Yellow
    Pop-Location
    exit 1
}
