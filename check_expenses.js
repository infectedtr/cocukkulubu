const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function checkExpenses() {
    const SQL = await initSqlJs();
    const dbPath = path.join(__dirname, `doner_aidat.sqlite`);
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const res = db.exec("SELECT aciklama FROM expenses WHERE aciklama LIKE '%DENETİM%'");
    if (res.length > 0) {
        console.log(`Found ${res[0].values.length} DENETİM expenses in DONER DB!`);
        res[0].values.forEach(v => console.log(v[0]));
    } else {
        console.log("No DENETİM expenses found in DONER DB.");
    }
}

checkExpenses().catch(console.error);
