@echo off
cd /d "%~dp0"
TITLE Aidat Takip Sistemi - Masaustu Testi
color 0B

echo ======================================================
echo    S.Gultekin KADAYIFCI Aidat Takip Sistemi
echo          Masaustu Uygulamasi Testi
echo ======================================================
echo.
echo Uygulama bagimsiz bir pencere olarak aciliyor...

:: Eski node ve electron sureclerini kapat (port cakismasini onlemek icin)
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM electron.exe /T >nul 2>&1
timeout /t 1 >nul

:: Electron'u baslat
call npm run start-desktop

if %errorlevel% neq 0 (
    echo.
    echo [HATA] Masaustu uygulamasi acilamadi.
    echo Lutfen once MASAUSTU_YAP.bat dosyasini 1 kez calistirin.
    pause
)
