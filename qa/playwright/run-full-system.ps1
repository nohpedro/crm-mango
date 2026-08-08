param(
  [string]$FrontendUrl = "http://localhost:5173",
  [string]$ApiUrl = "http://localhost:8000/api/v1",
  [string]$Username = "superadmin",
  [string]$Password = "Demo12345!",
  [switch]$Headed,
  [int]$SlowMo = 0
)

$ErrorActionPreference = "Stop"
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = Resolve-Path (Join-Path $scriptDirectory "..\..")
$localNodeModules = Join-Path $repositoryRoot "frontend\node_modules"
$bundledNodeModules = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules"

if (Test-Path (Join-Path $localNodeModules "playwright\package.json")) {
  $env:NODE_PATH = $localNodeModules
} elseif (Test-Path (Join-Path $bundledNodeModules "playwright\package.json")) {
  $env:NODE_PATH = $bundledNodeModules
} else {
  throw "Playwright no está instalado. Ejecuta 'npm install --save-dev playwright' en frontend o define NODE_PATH."
}

$env:QA_FRONTEND_URL = $FrontendUrl
$env:QA_API_URL = $ApiUrl
$env:QA_USERNAME = $Username
$env:QA_PASSWORD = $Password
$env:QA_HEADED = if ($Headed) { "1" } else { "0" }
$env:QA_SLOW_MO = [string]$SlowMo

Write-Host "Ejecutando QA E2E contra $FrontendUrl y $ApiUrl"
& node (Join-Path $scriptDirectory "full-system.qa.cjs")
exit $LASTEXITCODE
