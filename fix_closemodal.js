const fs = require('fs');
const filePath = 'public/index.html';
let content = fs.readFileSync(filePath, 'utf8');

// Fix closeModal without app. prefix
const before = (content.match(/onclick="closeModal/g) || []).length;
content = content.replace(/onclick="closeModal\(/g, 'onclick="app.closeModal(');
const after = (content.match(/onclick="app.closeModal/g) || []).length;
console.log('closeModal fixes:', before, '->', after);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done.');
