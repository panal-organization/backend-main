#Requires -Version 5.1
<#
.SYNOPSIS
  Guia asistida para instalar un GitHub Actions self-hosted runner en Windows.

.DESCRIPTION
  Este script NO descarga automaticamente binarios ni usa tokens de GitHub por seguridad.
  Su objetivo es documentar y guiar el setup local del runner para el proyecto Panal.

  Flujo recomendado:
    1) Crear carpeta del runner
    2) Descargar y descomprimir actions-runner
    3) Ejecutar config.cmd con URL y token
    4) Ejecutar run.cmd (modo foreground) o instalar como servicio (svc install)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/setup-runner.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Title([string]$text) {
    Write-Host ''
    Write-Host '====================================================' -ForegroundColor Cyan
    Write-Host $text -ForegroundColor Cyan
    Write-Host '====================================================' -ForegroundColor Cyan
}

function Write-Step([string]$text) {
  Write-Host "`n[STEP] $text" -ForegroundColor Yellow
}

$defaultRunnerDir = 'C:\actions-runner\panal-runner'

Write-Title 'Panal - Setup Self-Hosted Runner (Windows)'

Write-Host 'Este setup corre GitHub Actions en tu propia maquina (self-hosted).' -ForegroundColor Gray
Write-Host 'Workflow objetivo: .github/workflows/local-ci-cd.yml' -ForegroundColor Gray

Write-Step '1) Crear carpeta del runner'
Write-Host "New-Item -ItemType Directory -Path '$defaultRunnerDir' -Force | Out-Null"
Write-Host "Set-Location '$defaultRunnerDir'"

Write-Step '2) Descargar runner desde GitHub (releases oficiales)'
Write-Host 'Abre: https://github.com/actions/runner/releases'
Write-Host 'Descarga el zip mas reciente para Windows x64 (actions-runner-win-x64-*.zip)'
Write-Host 'Copia el zip a la carpeta del runner y descomprime:'
Write-Host "Add-Type -AssemblyName System.IO.Compression.FileSystem"
Write-Host "[System.IO.Compression.ZipFile]::ExtractToDirectory('actions-runner-win-x64-<version>.zip', '$defaultRunnerDir')"

Write-Step '3) Configurar runner con config.cmd'
Write-Host 'En GitHub: Repo -> Settings -> Actions -> Runners -> New self-hosted runner'
Write-Host 'Ahi GitHub te dara el comando exacto con URL y token temporal.'
Write-Host 'Ejemplo:'
Write-Host '.\config.cmd --url https://github.com/<owner>/<repo> --token <TOKEN>'
Write-Host ''
Write-Host 'Sugerencia de labels para este proyecto:'
Write-Host '.\config.cmd --url https://github.com/<owner>/<repo> --token <TOKEN> --labels windows,local,panal --unattended --replace'

Write-Step '4) Ejecutar runner'
Write-Host 'Modo foreground (debug inicial):'
Write-Host '.\run.cmd'

Write-Step '5) Instalar como servicio (recomendado para uso continuo)'
Write-Host '.\svc install'
Write-Host '.\svc start'
Write-Host ''
Write-Host 'Para detener o desinstalar servicio:'
Write-Host '.\svc stop'
Write-Host '.\svc uninstall'

Write-Step '6) Verificar en GitHub'
Write-Host 'Repo -> Settings -> Actions -> Runners'
Write-Host 'Debes ver el runner en estado Online.'

Write-Step '7) Probar pipeline local'
Write-Host 'Haz push a main/master o ejecuta workflow_dispatch:'
Write-Host 'Actions -> Local CI/CD (Self-hosted) -> Run workflow'

Write-Step 'Notas de compatibilidad Panal'
Write-Host '- El runner debe tener Docker Desktop corriendo.'
Write-Host '- El workflow usa runs-on: self-hosted.'
Write-Host '- El pipeline levanta docker compose y valida /health y /metrics.'
Write-Host '- No depende del frontend demo.'
Write-Host '- El flujo no exige AI local disponible para pasar el stack Docker principal.'

Write-Host ''
Write-Host 'Setup guide completada.' -ForegroundColor Green
