const fs = require('fs');
let indexHtml = fs.readFileSync('index.html', 'latin1');

let newPageHtml = `
      <div id="page-ogrenci-detay" class="page">
      <div class="table-container" style="margin-bottom: 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 15px; border-bottom:1px solid var(--border);">
            <h3 style="margin:0; font-size:16px;">Ogrenci Detaylari</h3>
            <div>
              <button class="btn" onclick="app.showPage('matris')" style="font-size:12px; padding:6px 12px; margin-right:5px; background:var(--surface); color:var(--text); border:1px solid var(--border);">Geri Don</button>
              <button class="btn btn-primary" onclick="app.showEditStudent(app.currentDetailTc)" style="font-size:12px; padding:6px 12px; background:rgba(255,152,0,0.1); color:#ff9800; border:1px solid rgba(255,152,0,0.3); margin-right:5px;">Duzenle</button>
              <button class="btn btn-success" onclick="app.showAddPayment(); setTimeout(() => { document.getElementById('new-ogrenci').value = app.currentDetailTc; }, 50);" style="font-size:12px; padding:6px 12px;">+ Odeme Ekle</button>
            </div>
        </div>
        <table class="data-table" style="width:100%; border-collapse: collapse;" id="detail-student-info">
            <!-- Populated via JS -->
        </table>
      </div>

      <div style="display:flex; justify-content:flex-end; padding:10px 15px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:20px; align-items:center;">
          <strong style="font-size:14px; margin-right:15px;">Toplam Odenen:</strong>
          <span id="detail-total-paid" style="font-size:16px; font-weight:700; color:var(--text);">0</span>
      </div>

      <div class="table-container">
        <div style="padding:10px 15px; background:rgba(139, 195, 74, 0.2); border-bottom:1px solid var(--border); text-align:center;">
            <h3 style="margin:0; font-size:16px; color:#558b2f;">Yapilan Odemeler</h3>
        </div>
        <table class="data-table" style="width:100%;">
            <thead>
                <tr>
                    <th style="width:60px;">Sira No</th>
                    <th>Odeme Turu / Ay</th>
                    <th>Odeme Tarihi</th>
                    <th>Dekont No</th>
                    <th style="text-align:right;">Tutar</th>
                </tr>
            </thead>
            <tbody id="detail-payments-body">
                <!-- Populated via JS -->
            </tbody>
        </table>
      </div>
    </div>
`;

let target = '<div class="modal-overlay" id="edit-student-modal">';
if (indexHtml.includes(target)) {
    indexHtml = indexHtml.replace(target, newPageHtml + '\n  ' + target);
    fs.writeFileSync('index.html', indexHtml, 'latin1');
    console.log('Page HTML added.');
} else {
    console.log('Target string not found in index.html!');
}
