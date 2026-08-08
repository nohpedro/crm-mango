param([int]$Port = 0)

$ErrorActionPreference = "Stop"
$ConfigFile = Join-Path $PSScriptRoot "config.psd1"
if (-not (Test-Path -LiteralPath $ConfigFile)) {
    throw "No se encontro production\config.psd1. Copia nuevamente la carpeta completa del CRM."
}
$Configuration = Import-PowerShellDataFile -LiteralPath $ConfigFile
if ($Port -le 0) {
    $Port = [int]$Configuration.Port
}
$IsAdministrator = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $IsAdministrator) {
    Start-Process powershell.exe -Verb RunAs -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", "`"$PSCommandPath`"",
        "-Port", $Port
    )
    exit
}

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Refresh-ProcessPath {
    $MachinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$MachinePath;$UserPath"
}

function Test-CompatiblePython {
    $ExistingEnvironment = Join-Path (Split-Path -Parent $PSScriptRoot) "backend\.venv\Scripts\python.exe"
    if (Test-Path -LiteralPath $ExistingEnvironment) {
        try {
            $Version = & $ExistingEnvironment -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
            if ([version]$Version -ge [version]"3.11") { return $true }
        }
        catch { }
    }
    $PythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($PythonCommand) {
        try {
            $Version = & $PythonCommand.Source -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
            if ([version]$Version -ge [version]"3.11") { return $true }
        }
        catch { }
    }
    $Launcher = Get-Command py.exe -ErrorAction SilentlyContinue
    if (-not $Launcher) { return $false }
    foreach ($Specifier in @("-3.13", "-3.12", "-3.11")) {
        & $Launcher.Source $Specifier -c "import sys" 2>$null
        if ($LASTEXITCODE -eq 0) { return $true }
    }
    return $false
}

function Test-CompatibleNode {
    $Node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $Node) { return $false }
    try {
        $Version = [version]((& $Node.Source --version).Trim().TrimStart("v"))
        return (($Version.Major -eq 20 -and $Version.Minor -ge 19) -or $Version.Major -ge 22)
    }
    catch { return $false }
}

function Install-Prerequisite([string]$Id, [string]$Name) {
    $Winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $Winget) {
        throw (
            "Falta $Name y Windows Package Manager (winget) no esta disponible. " +
            "Instala 'Instalador de aplicaciones' desde Microsoft Store y vuelve a ejecutar este boton."
        )
    }
    Write-Step "Instalando $Name (solo se realiza la primera vez)"
    & $Winget.Source install `
        --id $Id `
        --exact `
        --silent `
        --force `
        --accept-package-agreements `
        --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo instalar $Name. Comprueba la conexion a Internet y vuelve a intentarlo."
    }
    Refresh-ProcessPath
}

Write-Step "Comprobando los programas necesarios"
if (-not (Test-CompatiblePython)) {
    Install-Prerequisite "Python.Python.3.12" "Python 3.12"
}
if (-not (Test-CompatibleNode)) {
    Install-Prerequisite "OpenJS.NodeJS.LTS" "Node.js LTS"
}
if (-not (Test-CompatiblePython)) {
    throw "Python se instalo, pero Windows aun no lo reconoce. Reinicia el equipo y ejecuta nuevamente este boton."
}
if (-not (Test-CompatibleNode)) {
    throw "Node.js se instalo, pero Windows aun no lo reconoce. Reinicia el equipo y ejecuta nuevamente este boton."
}

$RuleName = "CRM IDESEM - Red local (TCP $Port)"
$ExistingRule = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
if (-not $ExistingRule) {
    New-NetFirewallRule `
        -DisplayName $RuleName `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $Port `
        -Profile Private | Out-Null
}
else {
    Set-NetFirewallRule `
        -DisplayName $RuleName `
        -Enabled True `
        -Action Allow `
        -Profile Private | Out-Null
}

$NonPrivateNetworks = @(
    Get-NetConnectionProfile -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPv4Connectivity -ne "Disconnected" -and
            $_.NetworkCategory -ne "Private"
        }
)
if ($NonPrivateNetworks.Count -gt 0) {
    Write-Warning (
        "La red activa no esta marcada como Privada. Cambiala desde Configuracion de Windows > " +
        "Red e Internet > Propiedades para permitir el acceso desde otros equipos."
    )
}

& (Join-Path $PSScriptRoot "start-production.ps1") -Port $Port -Rebuild -PrepareOnly

if ($LASTEXITCODE -ne 0) {
    throw "La configuracion no finalizo correctamente."
}

Write-Host "`nEl puerto $Port quedo habilitado unicamente para redes privadas." -ForegroundColor Green
Write-Host "Ya puedes iniciar el CRM con 'Iniciar CRM IDESEM.bat'." -ForegroundColor Yellow
Read-Host "Presiona Enter para cerrar"
