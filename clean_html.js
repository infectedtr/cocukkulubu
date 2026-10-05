const fs = require('fs');
let c = fs.readFileSync('public/index.html', 'utf8');

// The corruption patterns
const patterns = [
    { from: / "ğ/g, to: 'Öğ' },
    { from: /ğapıştır/g, to: 'yapıştır' },
    { from: /AğARLAR/g, to: 'AYARLAR' },
    { from: /"rn:/g, to: '"Örn:' },
    { from: /"rn: /g, to: '"Örn: ' },
    { from: /app.js%C3%87v=4/g, to: 'app.js?v=5' },
    { from: /app.js\?v=4/g, to: 'app.js?v=5' }
];

patterns.forEach(p => {
    c = c.replace(p.from, p.to);
});

// Remove potential zero-width or weird chars that look like ' '
c = c.replace(/\uFFFD/g, ''); 

fs.writeFileSync('public/index.html', c, 'utf8');
console.log('index.html cleaned successfully.');
