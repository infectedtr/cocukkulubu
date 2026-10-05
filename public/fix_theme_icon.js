
const fs = require('fs');
const filePath = 'public/index.html';
let content = fs.readFileSync(filePath, 'utf8');

// Use a regex that matches the button regardless of its inner content
content = content.replace(/<button class="btn" id="theme-toggle" onclick="app\.toggleTheme\(\)" title="Temayı Değiştir">.*?<\/button>/g, '<button class="btn" id="theme-toggle" onclick="app.toggleTheme()" title="Temayı Değiştir"><i class="fas fa-moon"></i></button>');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Theme toggle button fixed.');
