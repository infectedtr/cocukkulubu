const fs = require('fs');
let content = fs.readFileSync('app.js', 'latin1'); 

let regex = /let cellText = \(info\.diff !== 0\) \? [^\n]+;/;
let replacement = "let paidStr = p.tutar + ' &#8378;';\n                      let cellText = (info.diff !== 0) ? `${paidStr}<br><span style=\"font-size:9px;\">(${info.diff > 0 ? '+' : ''}${info.diff})</span>` : paidStr;";

content = content.replace(regex, replacement);
fs.writeFileSync('app.js', content, 'latin1');
console.log('Replaced successfully 2.');
