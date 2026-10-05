const fs = require('fs');
let content = fs.readFileSync('index.html', 'latin1');

// 1. Remove </body> and </html> wherever they are
content = content.replace(/<\/body>/g, '');
content = content.replace(/<\/html>/g, '');

// 2. Find script tags and move them to the end
const scripts = [];
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gm;
let match;
while ((match = scriptRegex.exec(content)) !== null) {
    scripts.push(match[0]);
}
content = content.replace(scriptRegex, '');

// 3. Append scripts, </body>, </html>
content = content.trim() + '\n\n' + scripts.join('\n') + '\n</body>\n</html>';

fs.writeFileSync('index.html', content, 'latin1');
console.log("Reconstructed index.html correctly.");
