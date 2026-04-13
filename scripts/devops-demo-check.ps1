#Requires -Version 5.1
<#
.SYNOPSIS
    Panal DevOps - Script de verificacion para modo demo/exposicion.
.DESCRIPTION
    Verifica todos los componentes del stack local en orden y muestra
    un resumen PASS / WARNING / FAIL al finalizar.
.EXAMPLE
    .\scripts\devops-demo-check.ps1
    .\scripts\devops-demo-check.ps1 -SkipBuild
#>

param(
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'SilentlyContinue'

# --- Estado / resultados -------------------------------------------------

$results = [ordered]@{}

function Write-Step([string]$title) {
    Write-Host ""
    Write-Host "=== $title ===" -ForegroundColor Cyan
}

function Pass([string]$key, [string]$detail = '') {
    $results[$key] = @{ status = 'PASS'; detail = $detail }
    $msg = if ($detail) { "  [PASS] $key - $detail" } else { "  [PASS] $key" }
    Write-Host $msg -ForegroundColor Green
}

function Warn([string]$key, [string]$detail = '') {
    $results[$key] = @{ status = 'WARNING'; detail = $detail }
    $msg = if ($detail) { "  [WARN] $key - $detail" } else { "  [WARN] $key" }
    Write-Host $msg -ForegroundColor Yellow
}

function Fail([string]$key, [string]$detail = '') {
    $results[$key] = @{ status = 'FAIL'; detail = $detail }
    $msg = if ($detail) { "  [FAIL] $key - $detail" } else { "  [FAIL] $key" }
    Write-Host $msg -ForegroundColor Red
}

function Invoke-Get([string]$url, [int]$timeoutSec = 6) {
    try {
        return Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec $timeoutSec
    }
    catch {
        return $null
    }
}

# --- Raiz del proyecto ---------------------------------------------------

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

Write-Host ""
Write-Host "+----------------------------------------------+" -ForegroundColor Magenta
Write-Host "|   Panal - DevOps Demo Check                  |" -ForegroundColor Magenta
Write-Host "+----------------------------------------------+" -ForegroundColor Magenta

# ========================================================================
# 1. Docker
# ========================================================================

Write-Step "1 - Docker Engine"

$null = docker info 2>&1
if ($LASTEXITCODE -eq 0) {
    Pass 'Docker Engine' 'daemon running'
}
else {
    Fail 'Docker Engine' 'daemon no disponible - inicia Docker Desktop'
    Write-Host ""
    Write-Host "  Sin Docker no se puede continuar." -ForegroundColor Red
    Pop-Location
    exit 1
}

$composeRaw = docker compose version 2>&1
if ($LASTEXITCODE -eq 0) {
    $cv = ($composeRaw | Select-String 'v[\d.]+').Matches[0].Value
    Pass 'Docker Compose' $cv
}
else {
    Fail 'Docker Compose' 'no disponible'
}

# ========================================================================
# 2. Puerto 3000
# ========================================================================

Write-Step "2 - Puerto 3000"

$port3000 = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($port3000) {
    $ownerPid = ($port3000 | Select-Object -First 1).OwningProcess
    $proc = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
    $procName = if ($proc) { $proc.ProcessName } else { "PID $ownerPid" }

    $runningNames = docker ps --format '{{.Names}}' 2>$null
    if ($runningNames -match 'panal-backend') {
        Pass 'Puerto 3000' 'en uso por panal-backend (contenedor esperado)'
    }
    else {
        Warn 'Puerto 3000' "ocupado por '$procName' (pid $ownerPid) - puede impedir levantar el stack"
    }
}
else {
    Pass 'Puerto 3000' 'libre'
}

# ========================================================================
# 3. Levantar stack
# ========================================================================

Write-Step "3 - Stack Docker Compose"

$stackRunning = docker compose ps --services --filter status=running 2>$null
$expectedServices = @('backend', 'mongo', 'prometheus', 'cadvisor', 'loki', 'promtail', 'grafana')
$missingSvcs = $expectedServices | Where-Object { $stackRunning -notcontains $_ }

if (-not $SkipBuild -or $missingSvcs) {
    if ($missingSvcs) {
        Write-Host "  Servicios faltantes: $($missingSvcs -join ', '). Levantando stack..." -ForegroundColor Yellow
    }
    else {
        Write-Host "  Levantando stack con --build..." -ForegroundColor Yellow
    }

    $null = npm run devops:up 2>&1
    if ($LASTEXITCODE -ne 0) {
        Fail 'Stack Up' 'docker compose up fallo - revisa el log arriba'
    }
    else {
        Write-Host "  Esperando que los servicios esten listos (30 s)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 30
    }
}
else {
    Write-Host "  Stack ya corriendo - se omite rebuild (-SkipBuild activo)." -ForegroundColor Gray
}

$psTable = docker compose ps --format 'table {{.Name}}\t{{.Status}}' 2>$null
$allUp = $true
foreach ($svc in $expectedServices) {
    $line = $psTable | Select-String $svc
    if (-not ($line -and ($line -match 'Up|running|healthy'))) {
        $allUp = $false
    }
}

if ($allUp) {
    Pass 'Stack (7 servicios)' 'todos Up/healthy'
}
else {
    Warn 'Stack (7 servicios)' 'algun servicio puede no estar listo aun'
    Write-Host ($psTable | Out-String) -ForegroundColor Gray
}

# ========================================================================
# 4. Endpoints
# ========================================================================

Write-Step "4 - Verificacion de endpoints"

# Backend /health
$health = Invoke-Get 'http://127.0.0.1:3000/health'
if ($health -and $health.StatusCode -eq 200) {
    try {
        $body = $health.Content | ConvertFrom-Json
        Pass 'Backend /health' "status=$($body.status) uptime=$([math]::Round($body.uptime_seconds,1))s"
    }
    catch {
        Pass 'Backend /health' 'HTTP 200'
    }
}
else {
    Fail 'Backend /health' 'no responde en :3000'
}

# Backend /metrics
$metrics = Invoke-Get 'http://127.0.0.1:3000/metrics'
if ($metrics -and $metrics.StatusCode -eq 200 -and $metrics.Content -match 'panal_app_up') {
    Pass 'Backend /metrics' 'panal_app_up presente'
}
else {
    Fail 'Backend /metrics' 'no responde o formato incorrecto'
}

# Prometheus
$prom = Invoke-Get 'http://127.0.0.1:9090/-/healthy'
if ($prom -and $prom.StatusCode -eq 200) {
    Pass 'Prometheus' ':9090 OK'
}
else {
    Fail 'Prometheus' 'no responde en :9090'
}

# Grafana
$graf = Invoke-Get 'http://127.0.0.1:3001/api/health'
if ($graf -and $graf.StatusCode -eq 200) {
    try {
        $gb = $graf.Content | ConvertFrom-Json
        Pass 'Grafana' "database=$($gb.database)"
    }
    catch {
        Pass 'Grafana' 'HTTP 200'
    }
}
else {
    Fail 'Grafana' 'no responde en :3001'
}

# Loki
$loki = Invoke-Get 'http://127.0.0.1:3100/ready'
if ($loki -and $loki.StatusCode -eq 200) {
    Pass 'Loki' ':3100 ready'
}
else {
    Fail 'Loki' 'no responde en :3100'
}

# cAdvisor - en Windows/WSL2 puede estar limitado
$cadv = Invoke-Get 'http://127.0.0.1:8080/'
if ($cadv -and $cadv.StatusCode -eq 200) {
    Pass 'cAdvisor' ':8080 OK'
}
else {
    Warn 'cAdvisor' 'no responde en :8080 (puede ser normal en Windows/WSL2)'
}

# ========================================================================
# 4b. Prometheus targets API
# ========================================================================

Write-Step "4b - Prometheus targets (API)"

$promTargetsRaw = Invoke-Get 'http://127.0.0.1:9090/api/v1/targets'
if ($promTargetsRaw -and $promTargetsRaw.StatusCode -eq 200) {
    try {
        $targetsData = $promTargetsRaw.Content | ConvertFrom-Json
        $active = $targetsData.data.activeTargets

        $backendT = $active | Where-Object { $_.labels.job -eq 'backend' }
        $cadvisorT = $active | Where-Object { $_.labels.job -eq 'cadvisor' }

        if ($backendT -and $backendT.health -eq 'up') {
            Pass 'Prom target: backend' "UP - scrapes en curso"
        }
        elseif ($backendT) {
            Fail 'Prom target: backend' "health=$($backendT.health) - ultimo error: $($backendT.lastError)"
        }
        else {
            Fail 'Prom target: backend' 'target no encontrado en Prometheus'
        }

        if ($cadvisorT -and $cadvisorT.health -eq 'up') {
            Pass 'Prom target: cadvisor' 'UP'
        }
        elseif ($cadvisorT) {
            Warn 'Prom target: cadvisor' "health=$($cadvisorT.health)"
        }
        else {
            Warn 'Prom target: cadvisor' 'target no encontrado'
        }
    }
    catch {
        Warn 'Prometheus targets' 'no se pudo parsear respuesta de /api/v1/targets'
    }
}
else {
    Fail 'Prometheus targets' 'API /api/v1/targets no responde'
}

# ========================================================================
# 4c. Grafana datasources y dashboard (API)
# ========================================================================

Write-Step "4c - Grafana datasources y dashboard (API)"

$grafUser = if ($env:GRAFANA_USER) { $env:GRAFANA_USER } else { 'admin' }
$grafPass = if ($env:GRAFANA_PASSWORD) { $env:GRAFANA_PASSWORD } else { 'admin' }
$grafB64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${grafUser}:${grafPass}"))
$grafHeaders = @{ Authorization = "Basic $grafB64" }

try {
    $grafDSRaw = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3001/api/datasources' `
        -Headers $grafHeaders -TimeoutSec 8

    if ($grafDSRaw -and $grafDSRaw.StatusCode -eq 200) {
        $dsList = $grafDSRaw.Content | ConvertFrom-Json
        $promDS = $dsList | Where-Object { $_.type -eq 'prometheus' }
        $lokiDS = $dsList | Where-Object { $_.type -eq 'loki' }

        if ($promDS) {
            Pass 'Grafana DS: Prometheus' "uid=$($promDS.uid) - url=$($promDS.url)"
        }
        else {
            Fail 'Grafana DS: Prometheus' 'Datasource no existe - verifica provisioning mount'
        }

        if ($lokiDS) {
            Pass 'Grafana DS: Loki' "uid=$($lokiDS.uid) - url=$($lokiDS.url)"
        }
        else {
            Fail 'Grafana DS: Loki' 'Datasource no existe - verifica provisioning mount'
        }
    }
    else {
        Warn 'Grafana Datasources API' "HTTP $($grafDSRaw.StatusCode)"
    }
}
catch {
    Warn 'Grafana Datasources API' 'no se pudo consultar /api/datasources'
}

try {
    $grafDashRaw = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3001/api/search?type=dash-db' `
        -Headers $grafHeaders -TimeoutSec 8

    if ($grafDashRaw -and $grafDashRaw.StatusCode -eq 200) {
        $dashList = $grafDashRaw.Content | ConvertFrom-Json
        $panalDash = $dashList | Where-Object { $_.uid -eq 'panal-devops-demo' }
        if ($panalDash) {
            Pass 'Grafana Dashboard: Panal Demo' "titulo=$($panalDash.title)"
        }
        else {
            Warn 'Grafana Dashboard: Panal Demo' 'no encontrado - reinicia Grafana para aplicar provisioning'
        }
    }
}
catch {
    Warn 'Grafana Dashboard API' 'no se pudo consultar /api/search'
}

# ========================================================================
# 4d. Loki: labels recibidas (logs ingested?)
# ========================================================================

Write-Step "4d - Loki ingestion (labels API)"

$lokiLabels = Invoke-Get 'http://127.0.0.1:3100/loki/api/v1/labels'
if ($lokiLabels -and $lokiLabels.StatusCode -eq 200) {
    try {
        $labelsData = $lokiLabels.Content | ConvertFrom-Json
        if ($labelsData.data -contains 'job') {
            Pass 'Loki logs ingested' 'label "job" presente - Promtail enviando logs correctamente'
        }
        else {
            Warn 'Loki logs ingested' 'no hay labels aun - espera que Promtail procese backend.log'
        }
    }
    catch {
        Warn 'Loki labels' 'no se pudo parsear respuesta de /loki/api/v1/labels'
    }
}
else {
    Fail 'Loki labels API' 'no responde en :3100'
}

# ========================================================================
# 5. Generar requests de demo
# ========================================================================

Write-Step "5 - Generando trafico de prueba"

$demoRoutes = @('/health', '/metrics', '/api-docs')
foreach ($route in $demoRoutes) {
    $null = Invoke-Get "http://127.0.0.1:3000$route" -timeoutSec 5
}
Write-Host "  Requests enviados: $($demoRoutes -join '  ')" -ForegroundColor Gray
Start-Sleep -Seconds 2

# ========================================================================
# 6. Logs del backend
# ========================================================================

Write-Step "6 - Logs backend"

$logPath = Join-Path $root 'logs\backend.log'
if (Test-Path $logPath) {
    $lines = Get-Content $logPath -ErrorAction SilentlyContinue
    $totalLines = ($lines | Measure-Object).Count

    $recentEntry = $lines | Select-Object -Last 20 | Where-Object {
        try {
            $ts = [datetimeoffset](($_ | ConvertFrom-Json).timestamp)
            (([datetimeoffset]::UtcNow) - $ts.ToUniversalTime()).TotalMinutes -lt 5
        }
        catch { $false }
    }

    if ($recentEntry) {
        Pass 'Logging (backend.log)' "$totalLines lineas totales - entradas recientes presentes"
    }
    else {
        Warn 'Logging (backend.log)' "archivo existe ($totalLines lineas) pero sin entradas recientes"
    }

    Write-Host ""
    Write-Host "  Ultimas 3 lineas del log:" -ForegroundColor Gray
    $lines | Select-Object -Last 3 | ForEach-Object {
        try {
            $obj = $_ | ConvertFrom-Json
            Write-Host "    [$($obj.level.ToUpper())] $($obj.message) $($obj.method) $($obj.path) $($obj.statusCode)" -ForegroundColor DarkGray
        }
        catch {
            Write-Host "    $_" -ForegroundColor DarkGray
        }
    }
}
else {
    Fail 'Logging (backend.log)' "archivo no encontrado en $logPath"
}

# ========================================================================
# 7. log:summary (IA)
# ========================================================================

Write-Step "7 - Generando resumen IA (npm run log:summary)"

$null = npm run log:summary 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Script ejecutado correctamente." -ForegroundColor Gray
}
else {
    Write-Host "  log:summary retorno codigo $LASTEXITCODE (puede ser normal si Ollama no esta disponible)." -ForegroundColor Yellow
}

# ========================================================================
# 8. Confirmar incident-summary.txt
# ========================================================================

Write-Step "8 - Verificando incident-summary.txt"

$summaryPath = Join-Path $root 'logs\incident-summary.txt'
if (Test-Path $summaryPath) {
    $summaryLines = (Get-Content $summaryPath | Measure-Object).Count
    $lastWrite = (Get-Item $summaryPath).LastWriteTime
    Pass 'Summary IA' "$summaryLines lineas - generado $lastWrite"

    Write-Host ""
    Write-Host "  Primeras 5 lineas del resumen:" -ForegroundColor Gray
    Get-Content $summaryPath | Select-Object -First 5 | ForEach-Object {
        Write-Host "    $_" -ForegroundColor DarkGray
    }
}
else {
    Fail 'Summary IA' 'logs\incident-summary.txt no encontrado'
}

# ========================================================================
# 9. Resumen final
# ========================================================================

Write-Host ""
Write-Host ""
Write-Host "+----------------------------------------------+" -ForegroundColor Magenta
Write-Host "|       RESUMEN FINAL - DEMO CHECK             |" -ForegroundColor Magenta
Write-Host "+----------------------------------------------+" -ForegroundColor Magenta

$passCount = 0
$warnCount = 0
$failCount = 0

foreach ($key in $results.Keys) {
    $r = $results[$key]
    $detail = if ($r.detail) { " - $($r.detail)" } else { '' }
    switch ($r.status) {
        'PASS' { Write-Host ("  {0,-28} {1}" -f $key, "[PASS]$detail")  -ForegroundColor Green; $passCount++ }
        'WARNING' { Write-Host ("  {0,-28} {1}" -f $key, "[WARN]$detail")  -ForegroundColor Yellow; $warnCount++ }
        'FAIL' { Write-Host ("  {0,-28} {1}" -f $key, "[FAIL]$detail")  -ForegroundColor Red; $failCount++ }
    }
}

Write-Host ""
Write-Host "  ----------------------------------------" -ForegroundColor Gray
Write-Host ("  PASS: {0}   WARNING: {1}   FAIL: {2}" -f $passCount, $warnCount, $failCount)

if ($failCount -eq 0 -and $warnCount -eq 0) {
    Write-Host ""
    Write-Host "  Stack 100% operativo. Listo para la exposicion!" -ForegroundColor Green
}
elseif ($failCount -eq 0) {
    Write-Host ""
    Write-Host "  Stack operativo con advertencias menores." -ForegroundColor Yellow
}
else {
    Write-Host ""
    Write-Host "  Hay componentes en FAIL. Revisa los detalles arriba." -ForegroundColor Red
}

Write-Host ""
Write-Host "  URLs de acceso rapido:" -ForegroundColor Cyan
Write-Host "    Backend  -> http://localhost:3000/health" -ForegroundColor Gray
Write-Host "    Metrics  -> http://localhost:3000/metrics" -ForegroundColor Gray
Write-Host "    Grafana  -> http://localhost:3001   (admin/admin)" -ForegroundColor Gray
Write-Host "    Prom     -> http://localhost:9090" -ForegroundColor Gray
Write-Host "    Loki     -> http://localhost:3100/ready" -ForegroundColor Gray
Write-Host "    cAdvisor -> http://localhost:8080" -ForegroundColor Gray
Write-Host ""

Pop-Location
