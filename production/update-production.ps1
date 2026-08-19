param(
    [string]$Repository = "nohpedro/crm-mango",
    [string]$Branch = "produccion"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Root = Split-Path -Parent $PSScriptRoot
$Root = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Runtime = Join-Path $PSScriptRoot "runtime"
$ConfigFile = Join-Path $PSScriptRoot "config.psd1"
$ArchiveUrl = "https://github.com/$Repository/archive/refs/heads/$Branch.zip"
$TempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/')
$TempRoot = Join-Path $TempBase ("crm-idesem-update-" + [guid]::NewGuid().ToString("N"))
$ArchiveFile = Join-Path $TempRoot "source.zip"
$ExtractRoot = Join-Path $TempRoot "source"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $Runtime ("backups\pre-update-" + $Timestamp)
$ReplacedFilesBackup = Join-Path $BackupRoot "archivos-reemplazados"

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Test-ProtectedPath([string]$RelativePath) {
    $Path = $RelativePath.Replace('\', '/')

    if ($Path -eq "Actualizar CRM IDESEM.bat") { return $true }
    if ($Path -match "^\.git(?:/|$)") { return $true }
    if ($Path -match "(?:^|/)(?:\.venv|venv|node_modules|dist|staticfiles|__pycache__)(?:/|$)") { return $true }
    if ($Path -match "^backend/db\.sqlite3(?:$|-journal$|-shm$|-wal$)") { return $true }
    if ($Path -match "^backend/media(?:/|$)") { return $true }
    if ($Path -match "^production/runtime(?:/|$)") { return $true }
    if ($Path -eq "production/config.psd1") { return $true }

    $FileName = [IO.Path]::GetFileName($Path)
    if ($FileName -eq ".env") { return $true }
    if ($FileName -like ".env.*" -and $FileName -ne ".env.example") { return $true }

    return $false
}

function Copy-PersistentFile([string]$RelativePath) {
    $Source = Join-Path $Root $RelativePath
    if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) { return }

    $Destination = Join-Path (Join-Path $BackupRoot "datos") $RelativePath
    $DestinationDirectory = Split-Path -Parent $Destination
    New-Item -ItemType Directory -Force -Path $DestinationDirectory | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

function Get-SourceRoot([string]$ExtractedPath) {
    $Candidates = @($ExtractedPath) + @(Get-ChildItem -LiteralPath $ExtractedPath -Directory)
    foreach ($Candidate in $Candidates) {
        $CandidatePath = [string]$Candidate
        if ($Candidate -is [IO.DirectoryInfo]) {
            $CandidatePath = $Candidate.FullName
        }
        if (
            (Test-Path -LiteralPath (Join-Path $CandidatePath "backend\manage.py") -PathType Leaf) -and
            (Test-Path -LiteralPath (Join-Path $CandidatePath "frontend\package.json") -PathType Leaf) -and
            (Test-Path -LiteralPath (Join-Path $CandidatePath "production\start-production.ps1") -PathType Leaf)
        ) {
            return [IO.Path]::GetFullPath($CandidatePath).TrimEnd('\', '/')
        }
    }
    throw "El archivo descargado no contiene la estructura esperada del CRM."
}

if (-not (Test-Path -LiteralPath (Join-Path $Backend "manage.py") -PathType Leaf) -or
    -not (Test-Path -LiteralPath (Join-Path $Frontend "package.json") -PathType Leaf) -or
    -not (Test-Path -LiteralPath $ConfigFile -PathType Leaf)) {
    throw "Ejecuta 'Actualizar CRM IDESEM.bat' unicamente desde la carpeta raiz del proyecto."
}

$Configuration = Import-PowerShellDataFile -LiteralPath $ConfigFile
$Port = [int]$Configuration.Port
if ($Port -gt 0) {
    $Listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($Listener) {
        throw (
            "El CRM parece estar abierto en el puerto $Port (PID $($Listener.OwningProcess)). " +
            "Cierra la ventana 'Iniciar CRM IDESEM' y vuelve a ejecutar el actualizador."
        )
    }
}

New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

try {
    Write-Step "Guardando una copia de seguridad de los datos"
    foreach ($PersistentFile in @(
        "backend\db.sqlite3",
        "backend\db.sqlite3-journal",
        "backend\db.sqlite3-shm",
        "backend\db.sqlite3-wal",
        "production\config.psd1",
        "production\runtime\secret-key.txt"
    )) {
        Copy-PersistentFile $PersistentFile
    }

    Write-Step "Descargando $Repository, rama $Branch"
    New-Item -ItemType Directory -Force -Path $TempRoot, $ExtractRoot | Out-Null
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri $ArchiveUrl -OutFile $ArchiveFile

    Write-Step "Verificando el paquete descargado"
    Expand-Archive -LiteralPath $ArchiveFile -DestinationPath $ExtractRoot -Force
    $SourceRoot = Get-SourceRoot $ExtractRoot

    $Added = 0
    $Updated = 0
    $Unchanged = 0

    Write-Step "Actualizando los archivos sin eliminar contenido local"
    $SourceFiles = Get-ChildItem -LiteralPath $SourceRoot -Recurse -File
    foreach ($SourceFile in $SourceFiles) {
        $RelativePath = $SourceFile.FullName.Substring($SourceRoot.Length).TrimStart('\', '/')
        if (Test-ProtectedPath $RelativePath) { continue }

        $Destination = Join-Path $Root $RelativePath
        $DestinationDirectory = Split-Path -Parent $Destination

        if (Test-Path -LiteralPath $Destination -PathType Leaf) {
            $SourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $SourceFile.FullName).Hash
            $DestinationHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Destination).Hash
            if ($SourceHash -eq $DestinationHash) {
                $Unchanged++
                continue
            }

            $OldVersion = Join-Path $ReplacedFilesBackup $RelativePath
            $OldVersionDirectory = Split-Path -Parent $OldVersion
            New-Item -ItemType Directory -Force -Path $OldVersionDirectory | Out-Null
            Copy-Item -LiteralPath $Destination -Destination $OldVersion -Force
            $Updated++
        }
        else {
            $Added++
        }

        New-Item -ItemType Directory -Force -Path $DestinationDirectory | Out-Null
        Copy-Item -LiteralPath $SourceFile.FullName -Destination $Destination -Force
    }

    Write-Host "  Archivos nuevos:        $Added" -ForegroundColor DarkGray
    Write-Host "  Archivos reemplazados:  $Updated" -ForegroundColor DarkGray
    Write-Host "  Archivos sin cambios:   $Unchanged" -ForegroundColor DarkGray

    Write-Step "Actualizando dependencias, interfaz y base de datos"
    $PrepareScript = Join-Path $PSScriptRoot "start-production.ps1"
    & $PrepareScript -Rebuild -PrepareOnly

    $UpdateSummary = @(
        "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
        "Origen: $ArchiveUrl",
        "Archivos nuevos: $Added",
        "Archivos reemplazados: $Updated",
        "Archivos sin cambios: $Unchanged",
        "Copia previa: $BackupRoot"
    )
    Set-Content -LiteralPath (Join-Path $Runtime "last-update.txt") -Value $UpdateSummary -Encoding UTF8

    Write-Host "`nActualizacion terminada correctamente." -ForegroundColor Green
    Write-Host "Los registros, archivos subidos, secretos y configuracion local se conservaron." -ForegroundColor Green
    Write-Host "Copia previa: $BackupRoot" -ForegroundColor Yellow
    Write-Host "Ya puedes iniciar el CRM con 'Iniciar CRM IDESEM.bat'." -ForegroundColor Yellow
}
catch {
    Write-Host "`nLa actualizacion no pudo terminar: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "No se eliminaron los datos existentes." -ForegroundColor Yellow
    Write-Host "Copia previa disponible en: $BackupRoot" -ForegroundColor Yellow
    exit 1
}
finally {
    if (Test-Path -LiteralPath $TempRoot) {
        $ResolvedTempRoot = [IO.Path]::GetFullPath($TempRoot)
        if ($ResolvedTempRoot.StartsWith($TempBase + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            Remove-Item -LiteralPath $ResolvedTempRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}
