const fs = require('fs');
const getFuncs = (file) => {
    const content = fs.readFileSync(file, 'latin1');
    const matches = content.match(/(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g);
    return new Set(matches.map(m => m.split(/\s+/).pop()));
};
const backupFuncs = getFuncs('app_backup.js');
const currentFuncs = getFuncs('app.js');

console.log("Missing functions:");
for (let f of backupFuncs) {
    if (!currentFuncs.has(f)) console.log("- " + f);
}
