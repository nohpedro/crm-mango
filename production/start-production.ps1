param(
    [int]$Port = 0,
    [switch]$Rebuild,
    [switch]$PrepareOnly
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Runtime = Join-Path $PSScriptRoot "runtime"
$Python = Join-Path $Backend ".venv\Scripts\python.exe"
$Requirements = Join-Path $Backend "requirements.txt"
$RequirementsMarker = Join-Path $Runtime "requirements.sha256"
$NodeMarker = Join-Path $Runtime "package-lock.sha256"
$SecretFile = Join-Path $Runtime "secret-key.txt"
$ConfigFile = Join-Path $PSScriptRoot "config.psd1"

if (-not (Test-Path -LiteralPath $ConfigFile)) {
    throw "No se encontró el archivo de configuración: $ConfigFile"
}

$Configuration = Import-PowerShellDataFile -LiteralPath $ConfigFile
if ($Port -le 0) {
    $Port = [int]$Configuration.Port
}
if ($Port -lt 1 -or $Port -gt 65535) {
    throw "El puerto configurado debe estar entre 1 y 65535."
}

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Get-FileHashValue([string]$Path) {
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash
}

function Test-HashMarker([string]$Source, [string]$Marker) {
    if (-not (Test-Path -LiteralPath $Marker)) { return $false }
    return (Get-Content -Raw -LiteralPath $Marker).Trim() -eq (Get-FileHashValue $Source)
}

function Save-HashMarker([string]$Source, [string]$Marker) {
    Set-Content -LiteralPath $Marker -Value (Get-FileHashValue $Source) -Encoding ASCII
}

function Get-LanAddresses {
    try {
        return @(
            Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
                Where-Object {
                    $_.IPAddress -ne "127.0.0.1" -and
                    $_.IPAddress -notlike "169.254.*" -and
                    $_.AddressState -eq "Preferred"
                } |
                Select-Object -ExpandProperty IPAddress -Unique
        )
    }
    catch {
        return @()
    }
}

New-Item -ItemType Directory -Force -Path $Runtime | Out-Null

if (-not (Test-Path -LiteralPath $Python)) {
    Write-Step "Creando el entorno de Python"
    $PyLauncher = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($PyLauncher) {
        & $PyLauncher.Source -3 -m venv (Join-Path $Backend ".venv")
    }
    else {
        $SystemPython = Get-Command python.exe -ErrorAction SilentlyContinue
        if (-not $SystemPython) {
            throw "No se encontró Python. Instala Python 3.12 o superior y vuelve a ejecutar este archivo."
        }
        & $SystemPython.Source -m venv (Join-Path $Backend ".venv")
    }
}

if (-not (Test-HashMarker $Requirements $RequirementsMarker)) {
    Write-Step "Instalando dependencias del servidor"
    & $Python -m pip install --upgrade pip
    & $Python -m pip install -r $Requirements
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron instalar las dependencias de Python." }
    Save-HashMarker $Requirements $RequirementsMarker
}

$Npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $Npm) {
    throw "No se encontró Node.js. Instala Node.js 22 LTS o superior y vuelve a ejecutar este archivo."
}

$PackageLock = Join-Path $Frontend "package-lock.json"
if (-not (Test-Path -LiteralPath (Join-Path $Frontend "node_modules")) -or
    -not (Test-HashMarker $PackageLock $NodeMarker)) {
    Write-Step "Instalando dependencias de la interfaz"
    Push-Location $Frontend
    try {
        & $Npm.Source ci
        if ($LASTEXITCODE -ne 0) { throw "No se pudieron instalar las dependencias del frontend." }
    }
    finally { Pop-Location }
    Save-HashMarker $PackageLock $NodeMarker
    $Rebuild = $true
}

$DistIndex = Join-Path $Frontend "dist\index.html"
$LatestFrontendChange = Get-ChildItem -Path (Join-Path $Frontend "src"), (Join-Path $Frontend "package.json"), (Join-Path $Frontend "vite.config.ts") -Recurse -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
$NeedsBuild = $Rebuild -or -not (Test-Path -LiteralPath $DistIndex)
if (-not $NeedsBuild -and $LatestFrontendChange) {
    $NeedsBuild = $LatestFrontendChange.LastWriteTimeUtc -gt (Get-Item $DistIndex).LastWriteTimeUtc
}

if ($NeedsBuild) {
    Write-Step "Compilando la interfaz para la URL única del CRM"
    $env:VITE_API_URL = "/api/v1"
    Push-Location $Frontend
    try {
        & $Npm.Source run build -- --base=/static/
        if ($LASTEXITCODE -ne 0) { throw "No se pudo compilar el frontend." }
    }
    finally { Pop-Location }
}

if (-not (Test-Path -LiteralPath $SecretFile)) {
    $Bytes = New-Object byte[] 64
    $Generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $Generator.GetBytes($Bytes) }
    finally { $Generator.Dispose() }
    Set-Content -LiteralPath $SecretFile -Value ([Convert]::ToBase64String($Bytes)) -Encoding ASCII
}

$ComputerName = $env:COMPUTERNAME.ToLowerInvariant()
$ConfiguredHostName = ([string]$Configuration.HostName).Trim().ToLowerInvariant()
if ([string]::IsNullOrWhiteSpace($ConfiguredHostName) -or $ConfiguredHostName -eq "auto") {
    $ConfiguredHostName = $ComputerName
}
$OpenBrowser = [bool]$Configuration.OpenBrowser
$LanAddresses = @(Get-LanAddresses)
$Hosts = @("localhost", "127.0.0.1", $ComputerName, $ConfiguredHostName) + $LanAddresses
$Origins = @(
    "http://localhost:$Port",
    "http://$ComputerName`:$Port",
    "http://$ConfiguredHostName`:$Port"
) +
    @($LanAddresses | ForEach-Object { "http://$_`:$Port" })

$env:DJANGO_DEBUG = "False"
$env:DJANGO_SECRET_KEY = (Get-Content -Raw -LiteralPath $SecretFile).Trim()
$env:DJANGO_ALLOWED_HOSTS = ($Hosts | Select-Object -Unique) -join ","
$env:CORS_ALLOWED_ORIGINS = ($Origins | Select-Object -Unique) -join ","
$env:CSRF_TRUSTED_ORIGINS = $env:CORS_ALLOWED_ORIGINS

Write-Step "Preparando la base de datos y los archivos estáticos"
Push-Location $Backend
try {
    & $Python manage.py migrate --noinput
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron aplicar las migraciones." }
    & $Python manage.py collectstatic --noinput --clear
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron preparar los archivos estáticos." }
    & $Python manage.py seed_system_data
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron verificar los datos iniciales." }
    & $Python manage.py check
    if ($LASTEXITCODE -ne 0) { throw "La configuración de Django contiene errores." }

    $NetworkUrl = "http://$ConfiguredHostName`:$Port"
    Set-Content -LiteralPath (Join-Path $Runtime "url-red-local.txt") -Value $NetworkUrl -Encoding UTF8

    if ($ConfiguredHostName -ne $ComputerName) {
        Write-Warning (
            "La URL configurada usa '$ConfiguredHostName', pero esta computadora se llama " +
            "'$ComputerName'. Asigna el mismo nombre al equipo en Windows o utiliza HostName = 'auto'."
        )
    }

    if ($PrepareOnly) {
        Write-Host "`nConfiguración terminada correctamente." -ForegroundColor Green
        Write-Host "URL estable para la red local: $NetworkUrl" -ForegroundColor Yellow
        return
    }

    Write-Host "`nFrontend y backend de CRM IDESEM iniciados." -ForegroundColor Green
    Write-Host "En esta computadora: http://localhost:$Port" -ForegroundColor White
    Write-Host "En la red local:     $NetworkUrl" -ForegroundColor Yellow
    Write-Host "Presiona Ctrl+C para detener el sistema.`n" -ForegroundColor DarkGray

    if ($OpenBrowser) {
        Start-Process "http://localhost:$Port"
    }
    & $Python -m waitress --listen="0.0.0.0:$Port" --threads=8 config.wsgi:application
}
finally {
    Pop-Location
}
