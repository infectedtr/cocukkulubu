const fs = require('fs');
let content = fs.readFileSync('app.js', 'latin1'); 

content = content.replace(/onclick="app\.showEditStudent\('\$\{st\.tc\}'\)"/g, `onclick="app.showStudentDetail('\${st.tc}')"`);

fs.writeFileSync('app.js', content, 'latin1');
console.log('Replaced successfully.');
