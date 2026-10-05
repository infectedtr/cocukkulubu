const fs = require('fs');
const c = fs.readFileSync('public/index.html', 'utf8');
const pages = c.match(/id="page-[^"]+"/g);
console.log('Pages found:', JSON.stringify(pages, null, 2));

// Check nav buttons - which data-page values exist
const navPages = c.match(/data-page="[^"]+"/g);
console.log('\nNav data-pages:', JSON.stringify(navPages, null, 2));

// Check page divs are in the .pages/content area (before modals)
const idx = c.indexOf('page-dashboard');
console.log('\npage-dashboard at char:', idx);
const idxModal = c.indexOf('modal-overlay');
console.log('First modal at char:', idxModal);
console.log('Pages before modals:', idx < idxModal ? 'YES' : 'NO - PROBLEM!');
