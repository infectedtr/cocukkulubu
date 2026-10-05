const fs = require('fs');
let indexHtml = fs.readFileSync('index.html', 'latin1');

let targetRegex = /<button class="btn btn-primary" onclick="app\.showEditStudent\(app\.currentDetailTc\)"[^>]*>D\&#252;zenle<\/button>/;
let replace = `<button class="btn btn-primary" onclick="app.showEditStudent(app.currentDetailTc)" style="font-size:12px; padding:6px 12px; background:rgba(255,152,0,0.1); color:#ff9800; border:1px solid rgba(255,152,0,0.3); margin-right:5px;">D&#252;zenle</button>
              <button class="btn btn-success" onclick="app.showAddPayment(); setTimeout(() => { document.getElementById('new-ogrenci').value = app.currentDetailTc; }, 50);" style="font-size:12px; padding:6px 12px;">+ &#214;deme Ekle</button>`;

if (indexHtml.match(targetRegex)) {
    indexHtml = indexHtml.replace(targetRegex, replace);
    fs.writeFileSync('index.html', indexHtml, 'latin1');
    console.log("Added Odeme Ekle button.");
} else {
    console.log("Target not found.");
}
