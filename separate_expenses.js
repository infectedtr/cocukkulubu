const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function separateExpenses() {
    const SQL = await initSqlJs();
    const kulupPath = path.join(__dirname, `kulup_aidat.sqlite`);
    const donerPath = path.join(__dirname, `doner_aidat.sqlite`);
    
    if (!fs.existsSync(kulupPath) || !fs.existsSync(donerPath)) {
        console.log("Databases not found.");
        return;
    }
    
    const kulupDb = new SQL.Database(fs.readFileSync(kulupPath));
    const donerDb = new SQL.Database(fs.readFileSync(donerPath));
    
    // 1. Döner DB'den Kulüp-ilgili olanları bul ve sil
    const toKulup = donerDb.exec("SELECT * FROM expenses WHERE aciklama LIKE '%KULÜBÜ%' OR aciklama LIKE '%KULUP%'");
    if (toKulup.length > 0) {
        const rows = toKulup[0].values;
        console.log(`Moving ${rows.length} expenses from DONER to KULUP...`);
        rows.forEach(r => {
            kulupDb.run("INSERT INTO expenses (ay, aciklama, tarih, dekont, tutar, kategori) VALUES (?,?,?,?,?,?)", [r[1], r[2], r[3], r[4], r[5], r[6]]);
        });
        donerDb.run("DELETE FROM expenses WHERE aciklama LIKE '%KULÜBÜ%' OR aciklama LIKE '%KULUP%'");
    }
    
    // 2. Kulüp DB'den Döner-ilgili olanları bul ve sil
    const toDoner = kulupDb.exec("SELECT * FROM expenses WHERE aciklama LIKE '%DÖNER%' OR aciklama LIKE '%DÖSE%'");
    if (toDoner.length > 0) {
        const rows = toDoner[0].values;
        console.log(`Moving ${rows.length} expenses from KULUP to DONER...`);
        rows.forEach(r => {
            donerDb.run("INSERT INTO expenses (ay, aciklama, tarih, dekont, tutar, kategori) VALUES (?,?,?,?,?,?)", [r[1], r[2], r[3], r[4], r[5], r[6]]);
        });
        kulupDb.run("DELETE FROM expenses WHERE aciklama LIKE '%DÖNER%' OR aciklama LIKE '%DÖSE%'");
    }
    
    fs.writeFileSync(kulupPath, Buffer.from(kulupDb.export()));
    fs.writeFileSync(donerPath, Buffer.from(donerDb.export()));
    console.log("Database separation complete.");
}

separateExpenses().catch(console.error);
