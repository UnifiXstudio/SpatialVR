@echo off
title Spatial VR Windows Server
cd /d "%~dp0\windows-server"

echo ========================================================
echo   Spousteni Spatial VR / AR Desktop Streaming Serveru
echo ========================================================

:: Zkusit povolit porty ve firewallu (pokud bezi jako spravce)
netsh advfirewall firewall add rule name="Spatial VR Server" dir=in action=allow protocol=TCP localport=3000,3443 >nul 2>&1

if not exist "bin\native-capturer.exe" (
    echo Kompilace nativniho zachytavace obrazovky pro maximalni FPS...
    dotnet publish native-capturer -c Release -o bin
)

echo.
echo Spoustim server...
npm start
pause
