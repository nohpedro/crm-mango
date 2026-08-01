param([int]$Port = 0)

$ErrorActionPreference = "Stop"
$Configuration = Import-PowerShellDataFile -LiteralPath (Join-Path $PSScriptRoot "config.psd1")
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

& (Join-Path $PSScriptRoot "start-production.ps1") -Port $Port -Rebuild -PrepareOnly

if ($LASTEXITCODE -ne 0) {
    throw "La configuración no finalizó correctamente."
}

Write-Host "`nEl puerto $Port quedó habilitado únicamente para redes privadas." -ForegroundColor Green
Write-Host "Ya puedes iniciar el CRM con 'Iniciar CRM IDESEM.bat'." -ForegroundColor Yellow
Read-Host "Presiona Enter para cerrar"
