@echo off
cd /d "%~dp0"
echo [1/2] Node.js kontrol ediliyor...
node -v
if %errorlevel% neq 0 (
    echo Node.js bulunamadi. Yukleniyor...
    winget install OpenJS.NodeJS.LTS
    echo Lutfen kurulum bittikten sonra bilgisayari yeniden baslatin.
    pause
    exit
)
echo [2/2] Kutuphaneler yukleniyor...
call npm install
echo Islem tamamlandi. baslat.bat dosyasini kullanabilirsiniz.
pause
