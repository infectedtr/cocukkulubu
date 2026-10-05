const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');
const crypto = require('crypto');
const { exec } = require('child_process');

// Veritabanı ve Sunucuyu Al
const { init, dbWrapper: db, getCurrentMode } = require('./database.js');
const serverApp = require('./server.js');

const licensing = require('./licensing.js');

const PORT = process.env.PORT || 3005;
let mainWindow;
let licenseWindow;

// --- LİSANS MANTIĞI ---
function checkLicense() {
    return licensing.checkStoredLicense(app.getPath('userData'));
}
// ----------------------

async function startEverything() {
    if (checkLicense()) {
        // Pencereyi HEMEN göster — kullanıcı loading ekranını görür
        createWindow();

        // DB ve server arka planda başlasın
        setImmediate(async () => {
            try {
                await init();
                serverApp.listen(PORT, () => {
                    console.log(`[STARTUP] Server started on port ${PORT}`);
                    // Hazır olduğunda ana sayfayı yükle
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.loadURL(`http://localhost:${PORT}`);
                    }
                });
            } catch (err) {
                console.error('[STARTUP] Başlatma hatası:', err);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.loadURL(`data:text/html,<h1>Başlatma Hatası</h1><p>${err.message}</p>`);
                }
            }
        });
    } else {
        createLicenseWindow();
    }
}

function createLicenseWindow() {
    licenseWindow = new BrowserWindow({
        width: 460, height: 380,
        frame: false, resizable: false,
        webPreferences: { 
            nodeIntegration: true,
            contextIsolation: false 
        }
    });
    const hwid = licensing.getHWID();
    const html = `
        <body style="background:#161b22; color:#fff; font-family:sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; border:1px solid #30363d; height:100vh; margin:0; box-sizing:border-box; padding:20px;">
            <h3 style="margin-bottom:10px; color:#58a6ff;">🔑 Lisans Aktivasyonu</h3>
            <p style="font-size:12px; color:#8b949e; margin-bottom:5px;">Cihaz Kimliğiniz (HWID):</p>
            <div style="display:flex; align-items:center; gap:5px; background:#0d1117; padding:6px 12px; border-radius:6px; border:1px solid #30363d; margin-bottom:15px;">
                <code id="hwid-text" style="color:#58a6ff; font-weight:bold; font-size:11px;">${hwid}</code>
                <button onclick="copyHwid()" style="background:#21262d; color:#c9d1d9; border:1px solid #30363d; border-radius:4px; padding:3px 8px; font-size:11px; cursor:pointer;">Kopyala</button>
            </div>
            <p style="font-size:12px; margin-bottom:5px;">Lisans Anahtarını Girin:</p>
            <input id="key" placeholder="AIDAT-2026-XXXX veya 12 Haneli Anahtar" style="padding:10px; width:300px; background:#0d1117; color:#fff; border:1px solid #30363d; border-radius:6px; text-align:center; font-size:13px; outline:none;">
            <button id="btn-act" onclick="activate()" style="margin-top:18px; padding:10px 30px; background:#238636; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; width:300px;">Aktive Et</button>
            <p id="msg" style="font-size:11px; color:#8b949e; margin-top:10px; min-height:15px; text-align:center;"></p>
            
            <script>
                const { ipcRenderer, clipboard } = require('electron');
                function copyHwid() {
                    const text = document.getElementById('hwid-text').innerText;
                    clipboard.writeText(text);
                    document.getElementById('msg').style.color = '#3fb950';
                    document.getElementById('msg').innerText = 'Cihaz kimliği kopyalandı!';
                    setTimeout(() => document.getElementById('msg').innerText = '', 2500);
                }
                function activate() {
                    const key = document.getElementById('key').value;
                    if(!key.trim()) return;
                    document.getElementById('btn-act').disabled = true;
                    document.getElementById('msg').style.color = '#58a6ff';
                    document.getElementById('msg').innerText = 'Lisans doğrulanıyor...';
                    ipcRenderer.send('activate-license', key);
                }
                ipcRenderer.on('license-result', (e, res) => {
                    document.getElementById('btn-act').disabled = false;
                    if (res.valid) {
                        document.getElementById('msg').style.color = '#3fb950';
                        document.getElementById('msg').innerText = res.message + ' Başlatılıyor...';
                    } else {
                        document.getElementById('msg').style.color = '#f85149';
                        document.getElementById('msg').innerText = res.message;
                    }
                });
            </script>
        </body>
    `;
    licenseWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: 'Aidat Takip Programı',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
        show: false
    });

    // Load loading screen first
    mainWindow.loadFile(path.join(__dirname, 'public', 'loading.html'));

    // Hemen göster — loading.html hızlı yüklenir
    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

// --- IPC HANDLERS ---

ipcMain.on('activate-license', async (event, key) => {
    const result = await licensing.verifyLicense(key, app.getPath('userData'));
    event.reply('license-result', result);
    if (result.valid) {
        setTimeout(() => {
            app.relaunch();
            app.exit();
        }, 1200);
    }
});

// File Dialog Handler
ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Data Files', extensions: ['xlsx', 'xls', 'json'] }
        ]
    });
    if (canceled) return null;
    return filePaths[0];
});

// Bulk Import IPC
ipcMain.on('import:start', (event, { filePath, type, options }) => {
    const dbPath = path.join(app.getPath('userData'), `${getCurrentMode()}_aidat.sqlite`);
    
    // Create Worker
    const worker = new Worker(path.join(__dirname, 'workers', 'bulkImportWorker.js'), {
        workerData: { filePath, type, dbPath, options }
    });

    worker.on('message', (message) => {
        if (message.type === 'start') {
            event.reply('import:progress', {
                current: 0,
                total: message.total,
                percent: 0,
                remaining: message.total
            });
        } else if (message.type === 'data') {
            // Write chunks to DB in the main process
            try {
                db.transaction(() => {
                    if (type === 'students') {
                        const sql = `INSERT OR IGNORE INTO students 
                            (sira, no, ad, soyad, tc, anne_adi, baba_adi, egitim_turu, sinif, giris_tarihi, cikis_tarihi) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                        
                        const stmt = db.prepare(sql);
                        for (const s of message.data) {
                            stmt.run([
                                s.sira || null, s.no || '', s.ad || '', s.soyad || '', s.tc || '',
                                s.anne_adi || '', s.baba_adi || '', s.egitim_turu || 'TAM GÜN',
                                s.sinif || '', s.giris_tarihi || '', s.cikis_tarihi || ''
                            ]);
                        }
                        stmt.finalize();
                    } else if (type === 'statements') {
                        const sql = `INSERT OR IGNORE INTO statements 
                            (tarih, kod, aciklama, tutar, tur, bakiye) 
                            VALUES (?, ?, ?, ?, ?, ?)`;
                        
                        const stmt = db.prepare(sql);
                        for (const s of message.data) {
                            stmt.run([
                                s.tarih || '', s.kod || '', s.aciklama || '',
                                s.tutar || 0, s.tur || 'Gelir', s.bakiye || 0
                            ]);
                        }
                        stmt.finalize();
                    }
                });
                
                // Event loop'un nefes alması için bir sonraki turu bekle
                setImmediate(() => {
                    mainWindow.webContents.send('import-progress', {
                        current: message.current,
                        total: message.total
                    });
                });
                
                // Signal progress back to renderer
                event.reply('import:progress', {
                    current: message.current,
                    total: message.total,
                    percent: Math.round((message.current / message.total) * 100),
                    remaining: message.total - message.current
                });
            } catch (err) {
                console.error('Import Insertion Error:', err);
                event.reply('import:error', 'Veritabanı kayıt hatası: ' + err.message);
            }
        } else if (message.type === 'status') {
            event.reply('import:status', message.message);
        } else if (message.type === 'done') {
            db.save(); // Final save
            event.reply('import:done', message);
        } else if (message.type === 'error') {
            event.reply('import:error', message.message);
        }
    });

    worker.on('error', (err) => {
        console.error('Worker Crash:', err);
        event.reply('import:error', 'Worker hatası: ' + err.message);
    });

    worker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`);
        }
    });
});

// --- APP EVENTS ---

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-proxy-server');
app.on('ready', startEverything);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
        process.exit(0);
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});

