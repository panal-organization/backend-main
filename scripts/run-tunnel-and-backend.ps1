#Requires -Version 5.1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info([string]$message) {
    Write-Host "[INFO] $message" -ForegroundColor Cyan
}

function Write-Ok([string]$message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

try {
    Write-Info 'Levantando stack local con npm run devops:run-all...'
    npm run devops:run-all
    if ($LASTEXITCODE -ne 0) {
        throw 'Fallo al levantar el entorno local.'
    }

    Write-Info 'Esperando 5 segundos antes de abrir el tunnel...'
    Start-Sleep -Seconds 5

    try {
        $health = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/health -TimeoutSec 10
        if ($health.StatusCode -ne 200) {
            throw 'El backend no respondio 200 en /health.'
        }
        Write-Ok 'Backend listo en http://localhost:3000'
    } catch {
        throw "No se pudo validar el backend en http://localhost:3000/health. $($_.Exception.Message)"
    }

    Write-Host ''
    Write-Host 'Comparte esta URL con tu companero cuando aparezca abajo.' -ForegroundColor Green
    Write-Host ''

    & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'run-cloudflare-tunnel.ps1')
    if ($LASTEXITCODE -ne 0) {
        throw 'No se pudo iniciar Cloudflare Tunnel.'
    }
} finally {
    Pop-Location
}