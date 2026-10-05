const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function checkCoşğun() {
    const SQL = await initSqlJs();
    const dbPath = path.join(__dirname, `doner_aidat.sqlite`);
    if (!fs.existsSync(dbPath)) return;
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    const res = db.exec("SELECT ad, soyad, anne_adi, baba_adi FROM students WHERE soyad LIKE 'ÇOŞ%'");
    if (res.length > 0) {
        res[0].values.forEach(s => console.log(s));
    }
}
checkCoşğun().catch(console.error);
