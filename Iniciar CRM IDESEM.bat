@echo off
setlocal
title CRM IDESEM
cd /d "%~dp0"
echo Iniciando frontend y backend de CRM IDESEM en una sola URL...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0production\start-production.ps1"
if errorlevel 1 (
  echo.
  echo El CRM no pudo iniciarse. Revisa el mensaje anterior.
  pause
)
endlocal
