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
$VenvRoot = Join-Path $Backend ".venv"
$Python = Join-Path $VenvRoot "Scripts\python.exe"
$Requirements = Join-Path $Backend "requirements.txt"
$RequirementsMarker = Join-Path $Runtime "requirements.sha256"
$NodeMarker = Join-Path $Runtime "package-lock.sha256"
$SecretFile = Join-Path $Runtime "secret-key.txt"
$ConfiguredMarker = Join-Path $Runtime "configured.ok"
$ConfigFile = Join-Path $PSScriptRoot "config.psd1"

if (-not (Test-Path -LiteralPath $ConfigFile)) {
    throw "No se encontro el archivo de configuracion: $ConfigFile"
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
$env:PYTHONUTF8 = "1"

$VenvUsable = $false
if (Test-Path -LiteralPath $Python) {
    try {
        $ExistingVenvVersion = [version](& $Python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
        $VenvUsable = $ExistingVenvVersion -ge [version]"3.11"
    }
    catch { $VenvUsable = $false }
}

if (-not $VenvUsable) {
    if (Test-Path -LiteralPath $VenvRoot) {
        $ResolvedVenv = [IO.Path]::GetFullPath($VenvRoot)
        $ResolvedBackend = [IO.Path]::GetFullPath($Backend) + [IO.Path]::DirectorySeparatorChar
        if (-not $ResolvedVenv.StartsWith($ResolvedBackend, [StringComparison]::OrdinalIgnoreCase)) {
            throw "La ruta del entorno de Python no pertenece a la carpeta backend."
        }
        Remove-Item -LiteralPath $ResolvedVenv -Recurse -Force
    }
    Write-Step "Creando el entorno de Python"
    $PyLauncher = Get-Command py.exe -ErrorAction SilentlyContinue
    $EnvironmentCreated = $false
    if ($PyLauncher) {
        foreach ($Specifier in @("-3.12", "-3.13", "-3.11")) {
            $RuntimeAvailable = $false
            try {
                & $PyLauncher.Source $Specifier -c "import sys" 2>$null
                $RuntimeAvailable = $LASTEXITCODE -eq 0
            }
            catch {
                $RuntimeAvailable = $false
            }
            if ($RuntimeAvailable) {
                & $PyLauncher.Source $Specifier -m venv $VenvRoot
                $EnvironmentCreated = $LASTEXITCODE -eq 0
                break
            }
        }
    }
    if (-not $EnvironmentCreated) {
        $SystemPython = Get-Command python.exe -ErrorAction SilentlyContinue
        if (-not $SystemPython) {
            throw "No se encontro Python 3.11 o superior. Ejecuta primero 'Configurar CRM IDESEM.bat'."
        }
        $SystemVersion = [version](& $SystemPython.Source -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
        if ($SystemVersion -lt [version]"3.11") {
            throw "La version de Python es $SystemVersion. Ejecuta primero 'Configurar CRM IDESEM.bat'."
        }
        & $SystemPython.Source -m venv $VenvRoot
        $EnvironmentCreated = $LASTEXITCODE -eq 0
    }
    if (-not $EnvironmentCreated -or -not (Test-Path -LiteralPath $Python)) {
        throw "No se pudo crear el entorno de Python. Ejecuta nuevamente el configurador."
    }
}

$VenvVersion = [version](& $Python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
if ($VenvVersion -lt [version]"3.11") {
    throw "El entorno del CRM usa Python $VenvVersion. Borra backend\.venv y ejecuta el configurador para actualizarlo."
}

if ($Rebuild -or -not (Test-HashMarker $Requirements $RequirementsMarker)) {
    Write-Step "Instalando dependencias del servidor"
    & $Python -m pip install --upgrade pip
    & $Python -m pip install -r $Requirements
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron instalar las dependencias de Python." }
    Save-HashMarker $Requirements $RequirementsMarker
}

$Npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $Npm) {
    throw "No se encontro Node.js. Ejecuta primero 'Configurar CRM IDESEM.bat'."
}
$Node = Get-Command node.exe -ErrorAction SilentlyContinue
$NodeVersion = [version]((& $Node.Source --version).Trim().TrimStart("v"))
if (-not (($NodeVersion.Major -eq 20 -and $NodeVersion.Minor -ge 19) -or $NodeVersion.Major -ge 22)) {
    throw "Node.js $NodeVersion no es compatible. Ejecuta nuevamente 'Configurar CRM IDESEM.bat'."
}

$PackageLock = Join-Path $Frontend "package-lock.json"
if ($Rebuild -or
    -not (Test-Path -LiteralPath (Join-Path $Frontend "node_modules")) -or
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
if (-not $NeedsBuild) {
    # Una compilacion de desarrollo usa /assets y apunta la API a localhost.
    # La version para red local siempre debe usar /static y una API relativa.
    $NeedsBuild = (Get-Content -Raw -LiteralPath $DistIndex) -notmatch '/static/'
}
if (-not $NeedsBuild -and $LatestFrontendChange) {
    $NeedsBuild = $LatestFrontendChange.LastWriteTimeUtc -gt (Get-Item $DistIndex).LastWriteTimeUtc
}

if ($NeedsBuild) {
    Write-Step "Compilando la interfaz para la URL unica del CRM"
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

Write-Step "Preparando la base de datos y los archivos estaticos"
Push-Location $Backend
try {
    & $Python manage.py migrate --noinput
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron aplicar las migraciones." }
    & $Python manage.py collectstatic --noinput --verbosity 0
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron preparar los archivos estaticos." }
    & $Python manage.py seed_system_data
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron verificar los datos iniciales." }
    & $Python manage.py check
    if ($LASTEXITCODE -ne 0) { throw "La configuracion de Django contiene errores." }

    $NetworkUrl = "http://$ConfiguredHostName`:$Port"
    Set-Content -LiteralPath (Join-Path $Runtime "url-red-local.txt") -Value $NetworkUrl -Encoding UTF8

    if ($ConfiguredHostName -ne $ComputerName) {
        Write-Warning (
            "La URL configurada usa '$ConfiguredHostName', pero esta computadora se llama " +
            "'$ComputerName'. Asigna el mismo nombre al equipo en Windows o utiliza HostName = 'auto'."
        )
    }

    if ($PrepareOnly) {
        Set-Content -LiteralPath $ConfiguredMarker -Value (Get-Date -Format "yyyy-MM-dd HH:mm:ss") -Encoding ASCII
        Write-Host "`nConfiguracion terminada correctamente." -ForegroundColor Green
        Write-Host "URL estable para la red local: $NetworkUrl" -ForegroundColor Yellow
        return
    }

    $ExistingListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($ExistingListener) {
        throw (
            "El puerto $Port ya esta siendo utilizado por otro programa (PID $($ExistingListener.OwningProcess)). " +
            "Cierra el otro programa o cambia Port en production\config.psd1."
        )
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
