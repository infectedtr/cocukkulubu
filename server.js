console.log('ANTIGRAVITY Sunucu dosyası yükleniyor...');
const express = require('express');
const cors = require('cors');
const { init, dbWrapper: db, getCurrentMode, switchMode } = require('./database.js');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const isElectron = process.versions.hasOwnProperty('electron');
let baseDir;

if (isElectron) {
    const { app } = require('electron');
    if (!app.isPackaged) {
        baseDir = __dirname;
    } else {
        baseDir = app.getPath('userData');
    }
} else {
    baseDir = __dirname;
}

const uploadsDir = path.join(baseDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const zlib = require('zlib');

const app = express();
console.log('Express uygulaması başlatıldı.');

// Built-in Gzip Response Compression Middleware
app.use((req, res, next) => {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (!acceptEncoding.includes('gzip')) return next();

    const originalSend = res.send;
    res.send = function (body) {
        if (req.method === 'HEAD' || res.statusCode === 304 || res.statusCode === 204) {
            return originalSend.call(this, body);
        }
        if (typeof body === 'string' || Buffer.isBuffer(body)) {
            const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
            if (buf.length > 1024) {
                zlib.gzip(buf, (err, gzipped) => {
                    if (err) return originalSend.call(this, body);
                    res.setHeader('Content-Encoding', 'gzip');
                    res.setHeader('Content-Length', gzipped.length);
                    originalSend.call(this, gzipped);
                });
                return;
            }
        }
        return originalSend.call(this, body);
    };
    next();
});

const PORT = process.env.PORT || 3005;
const upload = multer({ dest: uploadsDir });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global Logger
app.use((req, res, next) => {
    console.log(`[GLOBAL-LOG] ${req.method} ${req.url}`);
    next();
});

app.get('/api/ping', (req, res) => {
    res.json({ pong: true, time: new Date().toISOString() });
});

// ─── GİDERLER (EXPENSES) API ────────────────────────────────────────────────
// Giderleri toplu silme (Şifreli)
app.post('/api/expenses/all-delete', (req, res) => {
    const { password } = req.body;
    console.log('[DELETE-EXP-ALL] Request received');
    db.get('SELECT value FROM settings WHERE key = "settings_password"', [], (err, row) => {
        if (err) {
            console.error('[DELETE-EXP-ALL] DB Error:', err);
            return res.status(500).json({ error: err.message });
        }
        if (!row || row.value !== password) {
            console.warn('[DELETE-EXP-ALL] Invalid password attempt');
            return res.status(403).json({ error: "Hatalı şifre!" });
        }
        console.log('[DELETE-EXP-ALL] Password verified. Executing delete...');
        db.run('DELETE FROM expenses', [], function (err) {
            if (err) {
                console.error('[DELETE-EXP-ALL] Execution Error:', err);
                return res.status(500).json({ error: err.message });
            }
            console.log(`[DELETE-EXP-ALL] Success. Changes: ${this.changes}`);
            res.json({ success: true, changes: this.changes });
        });
    });
});

app.get('/api/expenses', (req, res) => {
    db.all('SELECT * FROM expenses ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/expenses', (req, res) => {
    const { ay, aciklama, tarih, dekont, tutar, kategori } = req.body;
    const cleanAy = String(ay || '').trim().toUpperCase();
    const safeTutar = isNaN(parseFloat(tutar)) ? 0 : parseFloat(tutar);
    db.run('INSERT INTO expenses (ay, aciklama, tarih, dekont, tutar, kategori) VALUES (?,?,?,?,?,?)',
        [cleanAy, aciklama || '', tarih || '', dekont || '', safeTutar, kategori || 'Diğer'],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, success: true });
        });
});

app.put('/api/gider-guncelle/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { ay, aciklama, tarih, dekont, tutar, kategori } = req.body;
    const safeTutar = isNaN(parseFloat(tutar)) ? 0 : parseFloat(tutar);
    db.run('UPDATE expenses SET ay=?, aciklama=?, tarih=?, dekont=?, tutar=?, kategori=? WHERE id=?',
        [ay || '', aciklama || '', tarih || '', dekont || '', safeTutar, kategori || 'Diğer', id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.delete('/api/expenses/:id', (req, res) => {
    db.run('DELETE FROM expenses WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/expenses/bulk', (req, res) => {
    const expenses = req.body.expenses;
    if (!Array.isArray(expenses) || expenses.length === 0) {
        return res.status(400).json({ error: 'Geçersiz gider listesi' });
    }

    let count = 0;
    try {
        const stmt = db.prepare('INSERT INTO expenses (ay, aciklama, tarih, dekont, tutar, kategori) VALUES (?,?,?,?,?,?)');
        for (const e of expenses) {
            const safeTutar = isNaN(parseFloat(e.tutar)) ? 0 : parseFloat(e.tutar);
            stmt.run([
                e.ay || '',
                e.aciklama || '',
                e.tarih || '',
                e.dekont || '',
                safeTutar,
                e.kategori || 'Banka'
            ]);
            count++;
        }
        stmt.finalize();
        res.json({ success: true, count: count, message: `${count} adet gider başarıyla kaydedildi.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PAYMENTS API ---
app.get('/api/payments', (req, res) => {
    db.all('SELECT * FROM payments ORDER BY tarih DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/payments', (req, res) => {
    try {
        let { ay, tc, ad_soyad, tarih, dekont, tutar, tur, notlar, force } = req.body;
        if (!ay || !tc) return res.status(400).json({ error: 'Ay ve TC zorunludur' });

        const cleanTc = String(tc).trim();
        const cleanAy = String(ay).trim().toUpperCase();
        const cleanDekont = String(dekont || '').trim();
        const safeTutar = isNaN(parseFloat(tutar)) ? 0 : parseFloat(tutar);

        if (cleanDekont !== '' && !force) {
            db.get('SELECT id, ay, ad_soyad FROM payments WHERE dekont COLLATE NOCASE = ? AND tarih = ?', [cleanDekont, tarih || ''], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                if (row) {
                    return res.status(409).json({
                        error: 'exists',
                        message: 'Bu tarih ve dekont numarası zaten eklendi!',
                        details: `${row.ad_soyad} - ${row.ay} ayı için mevcut.`
                    });
                }
                proceedUpsert();
            });
        } else {
            proceedUpsert();
        }

        function proceedUpsert() {
            if (cleanDekont !== '') {
                db.get('SELECT id FROM payments WHERE tc = ? AND ay = ? AND dekont COLLATE NOCASE = ?', [cleanTc, cleanAy, cleanDekont], (err, existing) => {
                    if (err) return res.status(500).json({ error: err.message });

                    if (existing) {
                        db.run('UPDATE payments SET ad_soyad=?, tarih=?, tutar=?, tur=?, notlar=? WHERE id=?',
                            [ad_soyad || '', tarih || '', safeTutar, tur || 'Ödeme', notlar || '', existing.id],
                            function (err) {
                                if (err) return res.status(500).json({ error: err.message });
                                res.json({ id: existing.id, success: true, updated: true, message: 'Ödeme başarıyla güncellendi.' });
                            });
                    } else {
                        insertNew();
                    }
                });
            } else {
                insertNew();
            }
        }

        function insertNew() {
            db.run('INSERT INTO payments (ay, tc, ad_soyad, tarih, dekont, tutar, tur, notlar) VALUES (?,?,?,?,?,?,?,?)',
                [cleanAy, cleanTc, ad_soyad || '', tarih || '', cleanDekont, safeTutar, tur || 'Ödeme', notlar || ''],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ id: this.lastID, success: true, updated: false, message: 'Yeni ödeme eklendi.' });
                });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/payments/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { tc, ay, ad_soyad, tarih, dekont, tutar, tur, notlar } = req.body;
    
    const safeTutar = isNaN(parseFloat(tutar)) ? 0 : parseFloat(tutar);
    const cleanDekont = String(dekont || '').trim();
    const cleanAy = String(ay || '').trim().toUpperCase();

    db.run('UPDATE payments SET tc=?, ay=?, ad_soyad=?, tarih=?, dekont=?, tutar=?, tur=?, notlar=? WHERE id=?',
        [tc, cleanAy, ad_soyad || '', tarih || '', cleanDekont, safeTutar, tur || 'Ödeme', notlar || '', id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, changes: this.changes, message: 'Ödeme başarıyla güncellendi.' });
        });
});

app.post('/api/payments/bulk', (req, res) => {
    const payments = req.body.payments;
    if (!Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({ error: 'Geçersiz ödeme listesi' });
    }

    let count = 0;
    try {
        const stmt = db.prepare('INSERT OR IGNORE INTO payments (ay, tc, ad_soyad, tarih, dekont, tutar, tur, notlar) VALUES (?,?,?,?,?,?,?,?)');
        for (const p of payments) {
            const safeTutar = isNaN(parseFloat(p.tutar)) ? 0 : parseFloat(p.tutar);
            stmt.run([
                p.ay ? String(p.ay).trim().toUpperCase() : '',
                p.tc ? String(p.tc).trim() : '',
                p.ad_soyad || '',
                p.tarih || '',
                p.dekont ? String(p.dekont).trim() : '',
                safeTutar,
                p.tur || 'Ödeme',
                p.notlar || ''
            ]);
            count++;
        }
        stmt.finalize();
        res.json({ success: true, count: count, message: `${count} adet ödeme başarıyla kaydedildi.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/payments/all-records', (req, res) => {
    db.run('DELETE FROM payments', [], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

app.delete('/api/payments/:id', (req, res) => {
    const id = parseInt(req.params.id);
    db.run('DELETE FROM payments WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- STUDENTS ---
app.get('/api/students', (req, res) => {
    db.all('SELECT * FROM students ORDER BY sira', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/students', (req, res) => {
    const { sira, ad, soyad, tc, anne_adi, baba_adi, egitim_turu, giris_tarihi, cikis_tarihi } = req.body;
    const cleanTc = String(tc || '').trim();
    if (!cleanTc) return res.status(400).json({ error: 'TC Kimlik Numarası zorunludur' });

    db.get('SELECT tc, ad, soyad FROM students WHERE tc = ?', [cleanTc], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            return res.status(409).json({ error: 'exists', message: `Bu TC numarası ile kayıtlı bir öğrenci zaten var: ${row.ad} ${row.soyad}` });
        }
        db.run('INSERT INTO students (sira, ad, soyad, tc, anne_adi, baba_adi, egitim_turu, giris_tarihi, cikis_tarihi) VALUES (?,?,?,?,?,?,?,?,?)',
            [sira || null, String(ad || '').trim().toUpperCase(), String(soyad || '').trim().toUpperCase(), cleanTc, (anne_adi || '').trim(), (baba_adi || '').trim(), egitim_turu || 'TAM GÜN', (giris_tarihi || '').trim(), (cikis_tarihi || '').trim()],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ id: this.lastID, success: true });
            });
    });
});

app.post('/api/students/update_student', (req, res) => {
    const { oldTc, sira, ad, soyad, tc, anne_adi, baba_adi, egitim_turu, giris_tarihi, cikis_tarihi } = req.body;
    const cleanAd = String(ad || '').trim().toUpperCase();
    const cleanSoyad = String(soyad || '').trim().toUpperCase();
    const newTc = String(tc || '').trim();

    db.run('UPDATE students SET sira=?, ad=?, soyad=?, tc=?, anne_adi=?, baba_adi=?, egitim_turu=?, giris_tarihi=?, cikis_tarihi=? WHERE tc=?',
        [sira, cleanAd, cleanSoyad, newTc, (anne_adi || '').trim(), (baba_adi || '').trim(), egitim_turu, (giris_tarihi || '').trim(), (cikis_tarihi || '').trim(), oldTc],
        function (err) {
            if (err) return res.status(500).json({ error: 'Veritabanı hatası: ' + err.message });
            if (newTc !== oldTc) {
                db.run('UPDATE payments SET tc=?, ad_soyad=? WHERE tc=?', [newTc, `${cleanAd} ${cleanSoyad}`, oldTc]);
            } else {
                db.run('UPDATE payments SET ad_soyad=? WHERE tc=?', [`${cleanAd} ${cleanSoyad}`, oldTc]);
            }
            res.json({ success: true });
        });
});

app.delete('/api/students/bulk', (req, res) => {
    const { tcs } = req.body;
    if (!tcs || !Array.isArray(tcs)) return res.status(400).json({ error: 'Geçersiz TC listesi.' });
    const placeholders = tcs.map(() => '?').join(',');
    db.run(`DELETE FROM students WHERE tc IN (${placeholders})`, tcs, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run(`DELETE FROM payments WHERE tc IN (${placeholders})`, tcs);
        res.json({ success: true, count: tcs.length });
    });
});

app.delete('/api/students/:tc', (req, res) => {
    db.run('DELETE FROM students WHERE tc=?', [req.params.tc], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run('DELETE FROM payments WHERE tc = ?', [req.params.tc]);
        res.json({ success: true, changes: this.changes });
    });
});

// --- STATEMENTS ---
app.post('/api/upload-statement', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi' });
    try {
        const wb = xlsx.readFile(req.file.path);
        const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
        let hIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 30); i++) {
            const rowStr = rows[i].join('|').toLowerCase();
            if ((rowStr.includes('tarih') || rowStr.includes('valör')) && (rowStr.includes('açıklama') || rowStr.includes('tutar'))) {
                hIdx = i; break;
            }
        }
        const IDX_TARIH = 0, IDX_REF = 1, IDX_ACIKLAMA = 2, IDX_TUTAR = 3, IDX_BAKIYE = 4;
        let count = 0;
        const stmt = db.prepare('INSERT OR IGNORE INTO statements (tarih, kod, aciklama, tutar, tur, bakiye) VALUES (?, ?, ?, ?, ?, ?)');
        for (let i = hIdx + 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || r.length < 3) continue;
            let tarihRaw = r[IDX_TARIH], tarih = String(tarihRaw || '').trim();
            if (!/^\d{1,2}[\.\\/]\d{1,2}[\.\\/]\d{2,4}/.test(tarih) && typeof tarihRaw !== 'number') continue;
            if (typeof tarihRaw === 'number' && tarihRaw > 40000) tarih = new Date((tarihRaw - 25569) * 86400 * 1000).toLocaleDateString('tr-TR');
            const parseNum = (v) => typeof v === 'number' ? v : parseFloat(String(v || '0').replace(/\./g, '').replace(',', '.')) || 0;
            let tutar = parseNum(r[IDX_TUTAR]), bakiye = parseNum(r[IDX_BAKIYE]);
            stmt.run([tarih, String(r[IDX_REF] || '').trim(), String(r[IDX_ACIKLAMA] || '').trim(), tutar, tutar >= 0 ? "Gelir" : "Gider", bakiye]);
            count++;
        }
        stmt.finalize();
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({ message: `${count} adet işlem başarıyla kaydedildi.` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/statements', (req, res) => {
    db.all('SELECT * FROM statements ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.delete('/api/statements', (req, res) => {
    const month = req.query.month;
    if (month && month !== 'all') {
        db.run('DELETE FROM statements WHERE tarih LIKE ?', [`%.${month}.%`], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    } else {
        db.run('DELETE FROM statements', [], () => res.json({ success: true }));
    }
});

// --- SETTINGS ---
app.get('/api/settings', (req, res) => {
    db.all('SELECT * FROM settings', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    });
});

app.post('/api/settings', (req, res) => {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: "Geçersiz veri!" });
    Object.entries(settings).forEach(([k, v]) => {
        db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [k, v]);
    });
    res.json({ success: true });
});

// --- MODES & SYSTEM ---
app.get('/api/current-mode', (req, res) => res.json({ mode: getCurrentMode() }));
app.post('/api/switch-mode', async (req, res) => {
    const { mode } = req.body;
    try { await switchMode(mode); res.json({ success: true, mode }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/hard-reset', async (req, res) => {
    const { password } = req.body;
    db.get('SELECT value FROM settings WHERE key = "settings_password"', [], async (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row || row.value !== password) return res.status(403).json({ error: "Hatalı şifre!" });
        const { hardResetAll } = require('./database.js');
        try { await hardResetAll(); res.json({ success: true }); } 
        catch (e) { res.status(500).json({ error: e.message }); }
    });
});

app.post('/api/cleanup-duplicates', (req, res) => {
    db.cleanupDuplicates((err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Mükerrer kayıtlar temizlendi.' });
    });
});

// --- YEDEKLEME (BACKUP) ---
app.get('/api/backup/all', (req, res) => {
    const mode = getCurrentMode();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `yedek_tam_${mode}_${timestamp}.json`;

    Promise.all([
        new Promise((resolve, reject) => db.all('SELECT * FROM students ORDER BY sira', [], (e, r) => e ? reject(e) : resolve(r))),
        new Promise((resolve, reject) => db.all('SELECT * FROM payments ORDER BY id', [], (e, r) => e ? reject(e) : resolve(r))),
        new Promise((resolve, reject) => db.all('SELECT * FROM expenses ORDER BY id', [], (e, r) => e ? reject(e) : resolve(r))),
        new Promise((resolve, reject) => db.all('SELECT * FROM statements ORDER BY id', [], (e, r) => e ? reject(e) : resolve(r))),
        new Promise((resolve, reject) => db.all('SELECT * FROM settings', [], (e, r) => e ? reject(e) : resolve(r)))
    ]).then(([students, payments, expenses, statements, settings]) => {
        const backup = {
            version: '1.6',
            mode: mode,
            createdAt: new Date().toISOString(),
            data: { students, payments, expenses, statements, settings }
        };
        const json = JSON.stringify(backup, null, 2);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(json);
    }).catch(err => {
        console.error('[BACKUP-ALL] Error:', err);
        res.status(500).json({ error: err.message });
    });
});

app.get('/api/backup/students', (req, res) => {
    const mode = getCurrentMode();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `yedek_ogrenciler_${mode}_${timestamp}.json`;

    db.all('SELECT * FROM students ORDER BY sira', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const backup = {
            version: '1.6',
            mode: mode,
            createdAt: new Date().toISOString(),
            data: { students: rows }
        };
        const json = JSON.stringify(backup, null, 2);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(json);
    });
});

// --- GERİ YÜKLEME (RESTORE) ---
app.post('/api/restore/all', (req, res) => {
    const { password, data } = req.body;
    db.get('SELECT value FROM settings WHERE key = "settings_password"', [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row || row.value !== password) return res.status(403).json({ error: 'Hatalı şifre!' });
        if (!data) return res.status(400).json({ error: 'Yedek verisi eksik!' });

        try {
            // Bulk operations using a single transaction for performance
            db.transaction(() => {
                if (data.students) {
                    db.runNoSave('DELETE FROM students');
                    data.students.forEach(s => {
                        db.runNoSave('INSERT OR IGNORE INTO students (sira,ad,soyad,tc,anne_adi,baba_adi,egitim_turu,giris_tarihi,cikis_tarihi,aciklama,no,sinif) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
                            [s.sira||null, s.ad||'', s.soyad||'', s.tc||'', s.anne_adi||'', s.baba_adi||'', s.egitim_turu||'', s.giris_tarihi||'', s.cikis_tarihi||'', s.aciklama||'', s.no||'', s.sinif||'']);
                    });
                }
                if (data.payments) {
                    db.runNoSave('DELETE FROM payments');
                    data.payments.forEach(p => {
                        db.runNoSave('INSERT OR IGNORE INTO payments (ay,tc,ad_soyad,tarih,dekont,tutar,tur,notlar) VALUES (?,?,?,?,?,?,?,?)',
                            [p.ay||'', p.tc||'', p.ad_soyad||'', p.tarih||'', p.dekont||'', parseFloat(p.tutar)||0, p.tur||'Ödeme', p.notlar||'']);
                    });
                }
                if (data.expenses) {
                    db.runNoSave('DELETE FROM expenses');
                    data.expenses.forEach(e => {
                        db.runNoSave('INSERT INTO expenses (ay,aciklama,tarih,dekont,tutar,kategori) VALUES (?,?,?,?,?,?)',
                            [e.ay||'', e.aciklama||'', e.tarih||'', e.dekont||'', parseFloat(e.tutar)||0, e.kategori||'Diğer']);
                    });
                }
                if (data.statements) {
                    db.runNoSave('DELETE FROM statements');
                    data.statements.forEach(s => {
                        db.runNoSave('INSERT OR IGNORE INTO statements (tarih,kod,aciklama,tutar,tur,bakiye) VALUES (?,?,?,?,?,?)',
                            [s.tarih||'', s.kod||'', s.aciklama||'', parseFloat(s.tutar)||0, s.tur||'', parseFloat(s.bakiye)||0]);
                    });
                }
            });
            res.json({ success: true, message: 'Tüm veriler başarıyla geri yüklendi.' });
        } catch (e) {
            res.status(500).json({ error: 'Geri yükleme hatası: ' + e.message });
        }
    });
});

app.post('/api/restore/students', (req, res) => {
    const { password, data } = req.body;
    db.get('SELECT value FROM settings WHERE key = "settings_password"', [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row || row.value !== password) return res.status(403).json({ error: 'Hatalı şifre!' });
        if (!data || !data.students) return res.status(400).json({ error: 'Öğrenci verisi eksik!' });

        try {
            db.transaction(() => {
                db.runNoSave('DELETE FROM students');
                data.students.forEach(s => {
                    db.runNoSave('INSERT OR IGNORE INTO students (sira,ad,soyad,tc,anne_adi,baba_adi,egitim_turu,giris_tarihi,cikis_tarihi,aciklama,no,sinif) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
                        [s.sira||null, s.ad||'', s.soyad||'', s.tc||'', s.anne_adi||'', s.baba_adi||'', s.egitim_turu||'', s.giris_tarihi||'', s.cikis_tarihi||'', s.aciklama||'', s.no||'', s.sinif||'']);
                });
            });
            res.json({ success: true, message: 'Öğrenci verileri başarıyla geri yüklendi.' });
        } catch (e) {
            res.status(500).json({ error: 'Geri yükleme hatası: ' + e.message });
        }
    });
});

app.patch('/api/students/:tc/aciklama', (req, res) => {
    const { aciklama } = req.body;
    db.run('UPDATE students SET aciklama = ? WHERE tc = ?', [aciklama || '', req.params.tc], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true
}));
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
        init().then(() => console.log('Veritabanı hazır.'));
    });
    setInterval(() => {}, 1000 * 60 * 60);
}

module.exports = app;
