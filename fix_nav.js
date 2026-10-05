const fs = require('fs');
const filePath = 'public/index.html';
let content = fs.readFileSync(filePath, 'utf8');

// Fix datapage= -> data-page= in nav buttons
content = content.replace(/\bdatapage=/g, 'data-page=');

fs.writeFileSync(filePath, content, 'utf8');
console.log('data-page attribute fixed.');
