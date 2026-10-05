
const fs = require('fs');

const filePath = 'public/index.html';
let content = fs.readFileSync(filePath, 'utf8');

// Fix var(xxx) to var(--xxx)
content = content.replace(/var\(([^)]+)\)/g, 'var(--$1)');

// Fix space-between
content = content.replace(/spacebetween/g, 'space-between');

// Fix UTF-8
content = content.replace(/charset="UTF8"/g, 'charset="UTF-8"');

// Fix theme-toggle icon
content = content.replace(/<button class="btn" id="theme-toggle"[^>]*><\/button>/g, '<button class="btn" id="theme-toggle" onclick="app.toggleTheme()" title="Temayı Değiştir"><i class="fas fa-moon"></i></button>');

// Fix any other possible square characters in known buttons
content = content.replace(/><\/button>/g, '><i class="fas fa-trash"></i></button>');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Final touches applied to index.html.');
