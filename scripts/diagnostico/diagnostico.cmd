@echo off
REM Lanza el diagnostico de permisos contra produccion.
REM Las credenciales se piden por teclado y no se guardan en ningun archivo.
cd /d "%~dp0..\.."
node scripts\diagnostico\permisos.cjs %1
echo.
pause
