
const fs = require('fs');
const filePath = 'public/index.html';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the app.js script tag source
content = content.replace('app.jsÇv=4', 'app.js?v=4');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Script tag source fixed.');
