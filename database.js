const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Electron ortamında mıyız?
const isElectron = process.versions.hasOwnProperty('electron');
let dbDir;

if (isElectron) {
    const { app } = require('electron');
    // Geliştirme/Test modunda yerel klasörü kullan, paketlenmişse userData kullan
    if (!app.isPackaged) {
        dbDir = __dirname;
    } else {
        dbDir = app.getPath('userData');
    }
} else {
    dbDir = __dirname;
}

let currentMode = 'kulup';
let db;
let SQL;

function getDbPath() {
    return path.join(dbDir, `${currentMode}_aidat.sqlite`);
}

function getModeFilePath() {
    return path.join(dbDir, 'mode.txt');
}

function loadMode() {
    try {
        const modeFile = getModeFilePath();
        if (fs.existsSync(modeFile)) {
            const savedMode = fs.readFileSync(modeFile, 'utf8').trim();
            if (savedMode === 'kulup' || savedMode === 'doner') {
                currentMode = savedMode;
            }
        }
    } catch (e) {
        console.error('Mod yüklenemedi:', e);
    }
}

function saveMode() {
    try {
        const modeFile = getModeFilePath();
        fs.writeFileSync(modeFile, currentMode, 'utf8');
    } catch (e) {
        console.error('Mod kaydedilemedi:', e);
    }
}

function getCurrentMode() {
    return currentMode;
}

async function switchMode(newMode) {
    if (newMode !== 'kulup' && newMode !== 'doner') {
        throw new Error('Geçersiz mod: ' + newMode);
    }
    
    console.log(`[DB-SWITCH] Switching to mode: ${newMode}`);
    currentMode = newMode;
    saveMode();
    
    try {
        const dbPath = getDbPath();
        if (fs.existsSync(dbPath)) {
            const fileBuffer = fs.readFileSync(dbPath);
            if (!SQL) {
                console.log('[DB-SWITCH] SQL not initialized, initializing now...');
                const initSqlJs = require('sql.js');
                SQL = await initSqlJs();
            }
            db = new SQL.Database(fileBuffer);
            console.log('[DB-SWITCH] Veritabanı yüklendi:', dbPath);
        } else {
            if (!SQL) {
                const initSqlJs = require('sql.js');
                SQL = await initSqlJs();
            }
            db = new SQL.Database();
            console.log('[DB-SWITCH] Yeni veritabanı oluşturuldu:', dbPath);
        }
        
        createTables();
        saveDb();
        console.log(`[DB-SWITCH] Mode switch to ${newMode} completed successfully.`);
    } catch (err) {
        console.error(`[DB-SWITCH-ERROR] Failed to switch to ${newMode}:`, err);
        throw err;
    }
}

let saveTimeout = null;
function saveDb(immediate = false) {
    if (immediate) {
        if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
        try {
            const data = db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(getDbPath(), buffer);
        } catch(e) {
            console.error('[DB-SAVE-ERROR]', e);
        }
        return;
    }
    if (saveTimeout) return;
    saveTimeout = setTimeout(() => {
        saveTimeout = null;
        try {
            const data = db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(getDbPath(), buffer);
        } catch(e) {
            console.error('[DB-SAVE-ERROR]', e);
        }
    }, 150);
}

function createTables() {
    let needsSave = false;
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT, sira INTEGER, no TEXT, ad TEXT, soyad TEXT, tc TEXT UNIQUE, anne_adi TEXT, baba_adi TEXT, egitim_turu TEXT,
        sinif TEXT, giris_tarihi TEXT, cikis_tarihi TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT, tc TEXT, ad_soyad TEXT, ay TEXT, tarih TEXT, dekont TEXT, tutar REAL, tur TEXT DEFAULT 'Ödeme'
    )`);
    // Mükerrer ödemeleri (Aynı tarih ve dekont numarası) engellemek için indeks
    try {
        db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_tarih_dekont ON payments(tarih, dekont) WHERE dekont != '' AND dekont IS NOT NULL");
    } catch(e) { console.error('Index creation error:', e); }

    db.run(`CREATE TABLE IF NOT EXISTS statements (
        id INTEGER PRIMARY KEY AUTOINCREMENT, tarih TEXT, kod TEXT, aciklama TEXT, tutar REAL, tur TEXT, bakiye REAL,
        UNIQUE(tarih, kod, aciklama, tutar)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT, ay TEXT, aciklama TEXT, tarih TEXT, dekont TEXT, tutar REAL, kategori TEXT DEFAULT 'Diğer'
    )`);
    
    // Şifre kontrolü ve varsayılan atama (sql.js syntax)
    try {
        const res = db.exec("SELECT value FROM settings WHERE key = 'settings_password'");
        if (!res || res.length === 0 || !res[0].values || res[0].values.length === 0) {
            db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('settings_password', '123456')");
            db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('school_name', 'Zübeyde Hanım Çocuk Kulübü')");
            needsSave = true;
        }
    } catch (e) {
        console.error("Settings init error:", e);
    }
    
    // Migrations...
    try {
        const tableInfo = db.exec("PRAGMA table_info(payments)");
        if (tableInfo && tableInfo.length > 0) {
            const columns = tableInfo[0].values.map(v => v[1]);
            if (!columns.includes('tur')) {
                db.run("ALTER TABLE payments ADD COLUMN tur TEXT DEFAULT 'Ödeme'");
                needsSave = true;
            }
            if (!columns.includes('notlar')) {
                db.run("ALTER TABLE payments ADD COLUMN notlar TEXT DEFAULT ''");
                needsSave = true;
            }
        }
    } catch(e) { console.error('Migration Error payments:', e); }

    try {
        const tableInfo = db.exec("PRAGMA table_info(students)");
        if (tableInfo && tableInfo.length > 0) {
            const columns = tableInfo[0].values.map(v => v[1]);
            if (!columns.includes('giris_tarihi')) {
                db.run("ALTER TABLE students ADD COLUMN giris_tarihi TEXT DEFAULT ''");
                needsSave = true;
            }
            if (!columns.includes('cikis_tarihi')) {
                db.run("ALTER TABLE students ADD COLUMN cikis_tarihi TEXT DEFAULT ''");
                needsSave = true;
            }
            if (!columns.includes('aciklama')) {
                db.run("ALTER TABLE students ADD COLUMN aciklama TEXT DEFAULT ''");
                needsSave = true;
            }
            if (!columns.includes('no')) {
                db.run("ALTER TABLE students ADD COLUMN no TEXT DEFAULT ''");
                needsSave = true;
            }
            if (!columns.includes('sinif')) {
                db.run("ALTER TABLE students ADD COLUMN sinif TEXT DEFAULT ''");
                needsSave = true;
            }
        }
    } catch(e) { console.error('Migration Error students:', e); }

    if (needsSave) {
        console.log('[DB] Migrations applied, saving database...');
        saveDb();
    }

    // Migration: Add indices for performance
    try { db.run("CREATE INDEX IF NOT EXISTS idx_payments_tc ON payments(tc)"); } catch(e){}
    try { db.run("CREATE INDEX IF NOT EXISTS idx_payments_dekont ON payments(dekont)"); } catch(e){}
    try { db.run("CREATE INDEX IF NOT EXISTS idx_students_tc ON students(tc)"); } catch(e){}
    try { db.run("CREATE INDEX IF NOT EXISTS idx_payments_tc_ay ON payments(tc, ay)"); } catch(e){}
    try { db.run("CREATE INDEX IF NOT EXISTS idx_expenses_ay ON expenses(ay)"); } catch(e){}
    try { db.run("CREATE INDEX IF NOT EXISTS idx_statements_tarih ON statements(tarih)"); } catch(e){}
}

async function cleanupDuplicates() {
    console.log(`[DB-CLEANUP] ${currentMode.toUpperCase()} Veritabanı taranıyor...`);
    try {
        // 1. Verileri normalize et
        db.run("UPDATE payments SET tc = trim(tc), ay = upper(trim(ay)), dekont = trim(dekont)");
        
        // 2. Aynı TC, AY ve DEKONT'a sahip TAMAMEN mükerrerleri bul ve sil
        const resBefore = db.exec("SELECT COUNT(*) as count FROM payments");
        const beforeCount = (resBefore && resBefore[0]) ? resBefore[0].values[0][0] : 0;
        
        db.run(`
            DELETE FROM payments 
            WHERE id NOT IN (
                SELECT max(id) 
                FROM payments 
                GROUP BY tc, ay, dekont
            )
        `);

        db.run(`
            DELETE FROM payments 
            WHERE dekont != '' AND id NOT IN (
                SELECT max(id) 
                FROM payments 
                GROUP BY dekont
            )
        `);

        const resAfter = db.exec("SELECT COUNT(*) as count FROM payments");
        const afterCount = (resAfter && resAfter[0]) ? resAfter[0].values[0][0] : 0;
        const deleted = beforeCount - afterCount;
        
        if (deleted > 0) {
            console.log(`[DB-CLEANUP] BAŞARILI: ${deleted} adet mükerrer kayıt temizlendi.`);
        } else {
            console.log(`[DB-CLEANUP] Mükerrer kayıt bulunmadı.`);
        }
        // 3. Giderler tablosunu temizle
        db.run("UPDATE expenses SET ay = upper(trim(ay))");
        const resExpBefore = db.exec("SELECT COUNT(*) as count FROM expenses");
        const beforeExpCount = (resExpBefore && resExpBefore[0]) ? resExpBefore[0].values[0][0] : 0;
        
        db.run(`
            DELETE FROM expenses 
            WHERE id NOT IN (
                SELECT max(id) 
                FROM expenses 
                GROUP BY ay, aciklama, tarih, dekont, tutar
            )
        `);
        
        const resExpAfter = db.exec("SELECT COUNT(*) as count FROM expenses");
        const afterExpCount = (resExpAfter && resExpAfter[0]) ? resExpAfter[0].values[0][0] : 0;
        const deletedExp = beforeExpCount - afterExpCount;

        if (deletedExp > 0) {
            console.log(`[DB-CLEANUP] BAŞARILI: ${deletedExp} adet mükerrer GİDER temizlendi.`);
        }

        saveDb();
    } catch (err) {
        console.error('[DB-CLEANUP-ERROR]', err);
    }
}

async function init() {
    if (!SQL) {
        console.log('[DB-INIT] Initializing SQL.js...');
        SQL = await initSqlJs();
    }
    loadMode();
    const dbPath = getDbPath();
    if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
        console.log('Veritabanı yüklendi:', dbPath);
    } else {
        db = new SQL.Database();
        console.log('Yeni veritabanı oluşturuldu:', dbPath);
    }
    createTables();
    saveDb();
}

const dbWrapper = {
    all: (sql, params, callback) => {
        try {
            const stmt = db.prepare(sql);
            if (params) stmt.bind(params);
            const results = [];
            while (stmt.step()) results.push(stmt.getAsObject());
            stmt.free();
            callback(null, results);
        } catch (err) { callback(err, null); }
    },
    get: (sql, params, callback) => {
        try {
            const stmt = db.prepare(sql);
            if (params) stmt.bind(params);
            let result = null;
            if (stmt.step()) result = stmt.getAsObject();
            stmt.free();
            callback(null, result);
        } catch (err) { callback(err, null); }
    },
    cleanupDuplicates: (callback) => {
        cleanupDuplicates()
            .then(() => callback ? callback(null) : null)
            .catch(err => callback ? callback(err) : null);
    },
    run: function(sql, params, callback) {
        try {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            params = params || [];
            
            const safeParams = (Array.isArray(params) ? params : [params]).map(p => p === undefined ? null : p);
            
            if (safeParams.length > 0) {
                db.run(sql, safeParams);
            } else {
                db.run(sql);
            }
            
            let changes = 0;
            try {
                const res = db.exec("SELECT changes()");
                if (res && res.length > 0 && res[0].values) {
                    changes = res[0].values[0][0];
                }
            } catch (cErr) {}
            
            let lastID = 0;
            try {
                const res = db.exec("SELECT last_insert_rowid()");
                if (res && res.length > 0 && res[0].values) {
                    lastID = res[0].values[0][0];
                }
            } catch (idErr) {}

            saveDb();
            
            if (callback) {
                const ctx = { lastID: lastID, changes: changes };
                callback.call(ctx, null);
            }
        } catch (err) {
            console.error('[DB-RUN-ERROR]', err);
            if (callback) callback(err);
        }
    },
    // New: Run without immediate save for bulk operations
    runNoSave: function(sql, params) {
        const safeParams = (Array.isArray(params) ? params : [params]).map(p => p === undefined ? null : p);
        if (safeParams.length > 0) {
            db.run(sql, safeParams);
        } else {
            db.run(sql);
        }
    },
    prepare: (sql) => {
        const stmt = db.prepare(sql);
        return {
            run: (p) => { stmt.bind(p); stmt.step(); stmt.reset(); },
            finalize: () => { stmt.free(); }
        };
    },
    transaction: (cb) => {
        try {
            db.run("BEGIN TRANSACTION");
            cb();
            db.run("COMMIT");
            saveDb();
        } catch (err) {
            db.run("ROLLBACK");
            throw err;
        }
    },
    save: () => saveDb(),
    serialize: (cb) => cb()
};



async function hardResetAll() {
    console.log('[DB-HARD-RESET] Full system wipe initiated...');
    const originalMode = currentMode;
    const modes = ['kulup', 'doner'];
    
    for (const m of modes) {
        await switchMode(m);
        db.run("DELETE FROM students");
        db.run("DELETE FROM payments");
        db.run("DELETE FROM expenses");
        db.run("DELETE FROM statements");
        // Keep essential settings but clear others
        db.run("DELETE FROM settings WHERE key NOT IN ('settings_password', 'school_name')");
        db.run("VACUUM"); // Compact database and ensure data is gone
        saveDb();
        console.log(`[DB-HARD-RESET] Cleared and Vacuumed database: ${m}`);
    }
    
    await switchMode(originalMode);
    console.log('[DB-HARD-RESET] Full system wipe completed.');
}

module.exports = { init, dbWrapper, getCurrentMode, switchMode, loadMode, hardResetAll };
