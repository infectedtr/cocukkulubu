const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function analyzeMixing() {
    const SQL = await initSqlJs();
    const kulupPath = path.join(__dirname, `kulup_aidat.sqlite`);
    const donerPath = path.join(__dirname, `doner_aidat.sqlite`);
    
    if (fs.existsSync(kulupPath)) {
        const db = new SQL.Database(fs.readFileSync(kulupPath));
        const res = db.exec("SELECT COUNT(*) FROM expenses WHERE aciklama LIKE '%DÖNER%' OR aciklama LIKE '%DÖSE%'");
        console.log(`Kulüp DB has ${res[0].values[0][0]} DÖSE-related expenses.`);
    }
    
    if (fs.existsSync(donerPath)) {
        const db = new SQL.Database(fs.readFileSync(donerPath));
        const res = db.exec("SELECT COUNT(*) FROM expenses WHERE aciklama LIKE '%KULÜBÜ%' OR aciklama LIKE '%ÇOCUK KULÜBÜ%' OR aciklama LIKE '%KULUP%'");
        console.log(`Döner DB has ${res[0].values[0][0]} Kulüp-related expenses.`);
        
        if (res[0].values[0][0] > 0) {
            const list = db.exec("SELECT aciklama FROM expenses WHERE aciklama LIKE '%KULÜBÜ%' OR aciklama LIKE '%ÇOCUK KULÜBÜ%' OR aciklama LIKE '%KULUP%'");
            list[0].values.forEach(v => console.log("  - " + v[0]));
        }
    }
}

analyzeMixing().catch(console.error);
