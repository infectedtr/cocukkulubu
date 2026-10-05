
const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\Alien\\.gemini\\antigravity\\scratch\\kulup_aidat_app\\kulup_aidat_app\\public\\index.html';
let content = fs.readFileSync(filePath, 'utf8');

// The corruption seems to be "Öğ" (0xD6 0xF0 in some encodings, or just literal chars)
// appearing before every character.
// Let's remove all occurrences of "Öğ".
const cleanedContent = content.split('Öğ').join('');

fs.writeFileSync(filePath, cleanedContent, 'utf8');
console.log('File cleaned.');
