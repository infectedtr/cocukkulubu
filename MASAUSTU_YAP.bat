@echo off
cd /d "%~dp0"
TITLE Masaustu Uygulamasi Olusturucu
color 1F

echo ======================================================
echo    S.Gultekin KADAYIFCI Aidat Takip Sistemi
echo          Masaustu Uygulamasi Olusturucu
echo ======================================================
echo.
echo LUTFEN BEKLEYIN...
echo Bu islem sirasinda internetten bazi Windows bilesenleri
echo indirilebilir. Lutfen pencereyi kapatmayin.
echo.

:: Calisan eski uygulamalari kapat
taskkill /F /IM "Aidat Takip.exe" /T >nul 2>&1
taskkill /F /IM electron.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 >nul

:: Hata ayıklama modunu aç
set DEBUG=electron-builder

echo [1/2] Bagimliliklar kontrol ediliyor...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [HATA] Kurulum sirasinda bir sorun olustu.
    pause
    exit
)

echo.
echo [2/2] Paketleme islemi basliyor...
echo (Bu asama biraz zaman alabilir, lutfen bekleyin)
call npm run build-desktop
if %errorlevel% neq 0 (
    echo.
    echo [HATA] .exe dosyasi olusturulamadi!
    echo Lutfen yukaridaki hata mesajini kontrol edin.
    echo Antivirus yaziliminizi gecici olarak kapatmayi deneyebilirsiniz.
    pause
    exit
)

echo.
echo ======================================================
echo ✅ ISLEM BASARILI!
echo ======================================================
echo.
echo "dist" klasorundeki setup dosyasini kullanabilirsiniz.
echo.
pause
