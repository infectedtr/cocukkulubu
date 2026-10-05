const fs = require('fs');
let content = fs.readFileSync('app.js', 'latin1'); 

// Append a refresh call inside loadData
let targetStr = "updateStats();";
if (content.includes("if (app.currentDetailTc) { app.showStudentDetail(app.currentDetailTc); }")) {
    console.log("Already added");
} else {
    content = content.replace(targetStr, targetStr + "\n    if (app.currentDetailTc && document.getElementById('page-ogrenci-detay').classList.contains('active')) { app.showStudentDetail(app.currentDetailTc); }");
    fs.writeFileSync('app.js', content, 'latin1');
    console.log("Refreshed.");
}
