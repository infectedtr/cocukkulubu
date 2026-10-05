const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function fixMixedData() {
    const SQL = await initSqlJs();
    const kulupPath = 'kulup_aidat.sqlite';
    const donerPath = 'doner_aidat.sqlite';

    if (!fs.existsSync(kulupPath) || !fs.existsSync(donerPath)) {
        console.error("Database files missing.");
        return;
    }

    const kulupDb = new SQL.Database(fs.readFileSync(kulupPath));
    const donerDb = new SQL.Database(fs.readFileSync(donerPath));

    // 1. Döner DB'deki KULÜP kayıtlarını ayıkla
    // 'ÇOCUK KULÜBÜ' ve 'AIDAT' anahtar kelimeleri en güvenilir olanlar
    const moveFromDonerToKulup = donerDb.exec("SELECT * FROM expenses WHERE aciklama LIKE '%ÇOCUK KULÜBÜ%' OR aciklama LIKE '%AİDAT%' OR aciklama LIKE '%AIDAT%'");
    
    if (moveFromDonerToKulup.length > 0) {
        const rows = moveFromDonerToKulup[0].values;
        console.log(`[FIX] Döner DB'den Kulüp DB'ye ${rows.length} kayıt taşınıyor...`);
        rows.forEach(r => {
            kulupDb.run("INSERT OR IGNORE INTO expenses (ay, aciklama, tarih, dekont, tutar, kategori) VALUES (?,?,?,?,?,?)", [r[1], r[2], r[3], r[4], r[5], r[6]]);
        });
        donerDb.run("DELETE FROM expenses WHERE aciklama LIKE '%ÇOCUK KULÜBÜ%' OR aciklama LIKE '%AİDAT%' OR aciklama LIKE '%AIDAT%'");
    }

    // 2. Kulüp DB'deki DÖNER (DÖSE) kayıtlarını ayıkla
    const moveFromKulupToDoner = kulupDb.exec("SELECT * FROM expenses WHERE aciklama LIKE '%DÖSE%' OR aciklama LIKE '%DÖNER%' OR aciklama LIKE '%SERMAYE%' OR aciklama LIKE '%MTA%'");
    
    if (moveFromKulupToDoner.length > 0) {
        const rows = moveFromKulupToDoner[0].values;
        console.log(`[FIX] Kulüp DB'den Döner DB'ye ${rows.length} kayıt taşınıyor...`);
        rows.forEach(r => {
            donerDb.run("INSERT OR IGNORE INTO expenses (ay, aciklama, tarih, dekont, tutar, kategori) VALUES (?,?,?,?,?,?)", [r[1], r[2], r[3], r[4], r[5], r[6]]);
        });
        kulupDb.run("DELETE FROM expenses WHERE aciklama LIKE '%DÖSE%' OR aciklama LIKE '%DÖNER%' OR aciklama LIKE '%SERMAYE%' OR aciklama LIKE '%MTA%'");
    }

    // 3. Mükerrer temizliği yap (Yeni database.js mantığıyla)
    const cleanup = (db, name) => {
        db.run("UPDATE expenses SET ay = upper(trim(ay))");
        db.run("DELETE FROM expenses WHERE id NOT IN (SELECT max(id) FROM expenses GROUP BY ay, aciklama, tarih, dekont, tutar)");
        console.log(`[CLEANUP] ${name} database cleaned.`);
    };

    cleanup(kulupDb, "Kulüp");
    cleanup(donerDb, "Döner");

    fs.writeFileSync(kulupPath, Buffer.from(kulupDb.export()));
    fs.writeFileSync(donerPath, Buffer.from(donerDb.export()));
    console.log("[SUCCESS] Database files updated and separated.");
}

fixMixedData().catch(console.error);
