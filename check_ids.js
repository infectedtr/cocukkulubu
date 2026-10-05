const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/app.js', 'utf8');

const idRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const missingIds = [];
const foundIds = new Set();

while ((match = idRegex.exec(js)) !== null) {
    const id = match[1];
    if (html.indexOf(`id="${id}"`) === -1 && html.indexOf(`id='${id}'`) === -1) {
        missingIds.push(id);
    } else {
        foundIds.add(id);
    }
}

console.log('Missing IDs in HTML:', JSON.stringify([...new Set(missingIds)], null, 2));
