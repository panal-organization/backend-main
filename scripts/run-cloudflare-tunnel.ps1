#Requires -Version 5.1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info([string]$message) {
    Write-Host "[INFO] $message" -ForegroundColor Cyan
}

function Write-Ok([string]$message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

function Write-Warn([string]$message) {
    Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Write-Step([string]$message) {
    Write-Host "`n=== $message ===" -ForegroundColor Magenta
}

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    Write-Warn 'cloudflared no esta instalado o no esta en PATH.'
    Write-Host ''
    Write-Host 'Instalacion recomendada en Windows:'
    Write-Host '  winget install Cloudflare.cloudflared'
    Write-Host ''
    Write-Host 'Alternativa:'
    Write-Host '  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/'
    exit 1
}

Write-Step 'Cloudflare Tunnel - Panal Backend'
Write-Info 'Backend objetivo: http://localhost:3000'
Write-Info 'Presiona Ctrl+C para cerrar el tunnel cuando termines.'
Write-Host ''

$script:publicUrl = $null

function Show-TunnelLine([string]$line) {
    Write-Host $line

    if (-not $script:publicUrl) {
        $match = [regex]::Match($line, 'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
        if ($match.Success) {
            $script:publicUrl = $match.Value
            Write-Host ''
            Write-Ok "URL publica: $script:publicUrl"
            Write-Host 'Comparte esta URL con tu companero.' -ForegroundColor Green
            Write-Host ''
            Write-Host 'Endpoints utiles:'
            Write-Host "  Swagger: $script:publicUrl/api-docs"
            Write-Host "  AI plan: $script:publicUrl/api/ai/agent/plan"
            Write-Host "  AI continue: $script:publicUrl/api/ai/agent/continue"
            Write-Host ''
            Write-Host 'No expongas Prometheus, Loki ni cAdvisor con este tunnel.' -ForegroundColor Yellow
        }
    }
}

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'

try {
    & $cloudflared.Source tunnel --url http://localhost:3000 2>&1 | ForEach-Object {
        Show-TunnelLine ($_.ToString())
    }

    if ($LASTEXITCODE -ne 0) {
        throw "cloudflared termino con codigo $LASTEXITCODE."
    }
} finally {
    $ErrorActionPreference = $previousErrorActionPreference
}