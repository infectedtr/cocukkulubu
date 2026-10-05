const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function checkMixing() {
    const SQL = await initSqlJs();
    const kulupPath = 'kulup_aidat.sqlite';
    const donerPath = 'doner_aidat.sqlite';

    if (fs.existsSync(donerPath)) {
        const db = new SQL.Database(fs.readFileSync(donerPath));
        const res = db.exec("SELECT * FROM expenses WHERE aciklama LIKE '%KULÜBÜ%' OR aciklama LIKE '%KULUP%' OR aciklama LIKE '%ÇOCUK%' OR aciklama LIKE '%ZÜBEYDE%'");
        if (res.length > 0) {
            console.log(`[DONER DB] Found ${res[0].values.length} Kulüp-related records.`);
            res[0].values.slice(0, 5).forEach(v => console.log(`  - ${v[2]} (${v[3]})`));
        } else {
            console.log("[DONER DB] No Kulüp-related records found.");
        }
    }

    if (fs.existsSync(kulupPath)) {
        const db = new SQL.Database(fs.readFileSync(kulupPath));
        const res = db.exec("SELECT * FROM expenses WHERE aciklama LIKE '%DÖSE%' OR aciklama LIKE '%DÖNER%' OR aciklama LIKE '%SERMAYE%'");
        if (res.length > 0) {
            console.log(`[KULUP DB] Found ${res[0].values.length} DÖSE-related records.`);
            res[0].values.slice(0, 5).forEach(v => console.log(`  - ${v[2]} (${v[3]})`));
        } else {
            console.log("[KULUP DB] No DÖSE-related records found.");
        }
    }
}

checkMixing().catch(console.error);
