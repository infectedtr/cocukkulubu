
const fs = require('fs');
const filePath = 'public/index.html';
let content = fs.readFileSync(filePath, 'utf8');

// Fix ÖĞLECİ corruption
content = content.replace(/""ĞLECİÖ/g, '"ÖĞLECİ"');
content = content.replace(/ÖÖğrencilerÖ/g, '"Öğrenciler"');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Final polish applied.');
