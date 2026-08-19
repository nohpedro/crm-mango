@echo off
setlocal
title Actualizar CRM IDESEM
cd /d "%~dp0"

if not exist "%~dp0production\update-production.ps1" (
  echo.
  echo No se encontro el actualizador del CRM.
  echo Verifica que este archivo se encuentre en la carpeta raiz del proyecto.
  echo.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0production\update-production.ps1"
set "UPDATE_EXIT_CODE=%ERRORLEVEL%"

if not "%UPDATE_EXIT_CODE%"=="0" (
  echo.
  echo No se pudo completar la actualizacion del CRM.
  echo Los datos existentes no fueron eliminados.
  echo Revisa el mensaje anterior para conocer la causa.
) else (
  echo.
  echo La actualizacion del CRM termino correctamente.
)

echo.
pause
endlocal & exit /b %UPDATE_EXIT_CODE%
