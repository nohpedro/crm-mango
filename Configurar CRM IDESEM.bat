@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0production\configure-production.ps1"
if errorlevel 1 (
  echo.
  echo No se pudo completar la configuracion del CRM.
  pause
)
endlocal
