@echo off
setlocal
title CRM IDESEM
cd /d "%~dp0"
if not exist "%~dp0production\runtime\configured.ok" (
  echo.
  echo CRM IDESEM aun no esta configurado en esta computadora.
  echo Ejecuta primero "Configurar CRM IDESEM.bat" con conexion a Internet.
  echo Cuando termine correctamente, vuelve a utilizar este acceso directo.
  echo.
  pause
  exit /b 1
)
echo Iniciando frontend y backend de CRM IDESEM en una sola URL...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0production\start-production.ps1"
if errorlevel 1 (
  echo.
  echo El CRM no pudo iniciarse. Revisa el mensaje anterior.
  pause
)
endlocal
