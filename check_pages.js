const fs = require('fs');
const c = fs.readFileSync('public/index.html', 'utf8');
const pages = c.match(/id="page-[^"]+"/g);
console.log('Pages found:', JSON.stringify(pages, null, 2));

// Also check what pages app.js expects
const appJs = fs.readFileSync('public/app.js', 'utf8');
const navPages = appJs.match(/showPage\('([^']+)'\)/g);
const unique = [...new Set(navPages)];
console.log('\nShowPage calls:', JSON.stringify(unique, null, 2));
