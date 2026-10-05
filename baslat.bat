@echo off
cd /d "%~dp0"
echo [1/2] Hazirlaniyor...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 1 >nul
echo [2/2] Sunucu baslatiliyor...
echo Tarayici aciliyor: http://localhost:3005
start "" "http://localhost:3005"
node server.js
if %errorlevel% neq 0 (
    echo Sunucu durdu! Bir hata olusmus olabilir.
    pause
)
