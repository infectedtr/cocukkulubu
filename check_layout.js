const fs = require('fs');
const c = fs.readFileSync('public/index.html', 'utf8');

// Check layout structure
const layoutOpen = c.indexOf('<div class="layout">');
const asideOpen = c.indexOf('<aside class="sidebar">');
const asideClose = c.indexOf('</aside>');
const mainOpen = c.indexOf('<div class="main">');
const contentOpen = c.indexOf('<div class="content">');

console.log('layout opens at:', layoutOpen);
console.log('aside opens at:', asideOpen);
console.log('aside closes at:', asideClose);
console.log('main opens at:', mainOpen);
console.log('content opens at:', contentOpen);

// Count divs inside .main to find when it closes
const mainStart = mainOpen;
const afterMain = c.substring(mainStart);
let depth = 0;
let mainClosePos = -1;
for (let i = 0; i < afterMain.length - 5; i++) {
    if (afterMain.substring(i, i+4) === '<div') depth++;
    if (afterMain.substring(i, i+6) === '</div>') {
        depth--;
        if (depth < 0) {
            mainClosePos = mainStart + i;
            break;
        }
    }
}
console.log('\n.main closes at char:', mainClosePos);
if (mainClosePos > 0) {
    console.log('Context:', JSON.stringify(c.substring(mainClosePos - 100, mainClosePos + 10)));
}
