const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'index.html');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix CSS Class Hyphens (Ensuring consistency)
const classFixes = [
    { from: 'class="matrixwrap"', to: 'class="matrix-wrap"' },
    { from: 'class="matrixtable"', to: 'class="matrix-table"' },
    { from: 'class="tablecount"', to: 'class="table-count"' },
    { from: 'class="cardbody"', to: 'class="card-body"' },
    { from: 'class="cardheader"', to: 'class="card-header"' },
];

classFixes.forEach(fix => {
    content = content.split(fix.from).join(fix.to);
});

// 2. Fix Turkish Character Corruption and Placeholders
const textFixes = [
    // Double encoding / Over-correction fixes
    { from: /ÖÖğ/g, to: 'Öğ' },
    { from: /öÖğ/g, to: 'Öğ' },
    { from: /ğLECİ/g, to: 'ÖĞLECİ' },
    { from: /KAğIT/g, to: 'KAYIT' },
    { from: /SİLİNİğOR/g, to: 'SİLİNİYOR' },
    { from: /ÖğRENİCİğİ/g, to: 'ÖĞRENCİYİ' },
    
    // Placeholder cleanups (removing the trailing Ö and ensuring quotes)
    { from: /placeholder="Öğrenci veya TC ara...Ö/g, to: 'placeholder="Öğrenci veya TC ara..."' },
    { from: /placeholder="Öğrenci ara...Ö/g, to: 'placeholder="Öğrenci ara..."' },
    { from: /placeholder="Örn: (.*?)Ö/g, to: 'placeholder="Örn: $1"' },
    
    // Explicit text fixes
    { from: /ğapılan/g, to: 'Yapılan' },
    { from: /ğapilan/g, to: 'Yapılan' },
    { from: /ğeşil/g, to: 'yeşil' },
    { from: /Odeme/g, to: 'Ödeme' },
    { from: /Odenen/g, to: 'Ödenen' },
    
    // Ensure "Öğrenci" is correct everywhere
    { from: /Öğrenci/g, to: 'Öğrenci' }, // Redundant but safe
    
    // Version update
    { from: /app.js\?v=\d+/g, to: 'app.js?v=7' }
];

textFixes.forEach(fix => {
    content = content.replace(fix.from, fix.to);
});

// Final cleanup of any lingering artifact patterns
content = content.replace(/Ö\s+oninput/g, '" oninput'); // Fix for the oninput attribute mess

fs.writeFileSync(filePath, content, 'utf8');
console.log('Final fix v2 applied to index.html');
