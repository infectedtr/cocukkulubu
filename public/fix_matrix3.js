const fs = require('fs');
let content = fs.readFileSync('app.js', 'latin1'); 

let regex = /let paidStr = p\.tutar \+ ' ';\s+let paidStr = p\.tutar \+ ' &#8378;';/;
let replacement = "let paidStr = p.tutar + ' &#8378;';";

content = content.replace(regex, replacement);
fs.writeFileSync('app.js', content, 'latin1');
console.log('Fixed let paidStr redeclaration.');
