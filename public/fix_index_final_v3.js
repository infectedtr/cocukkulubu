
const fs = require('fs');

const filePath = 'public/index.html';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix specific corrupted strings
content = content.replace(/value=""deme/g, 'value="Ödeme"');
content = content.replace(/KAğDET/g, 'KAYDET');
content = content.replace(/placeholder=""rn: F12345/g, 'placeholder="Örn: F12345"');
content = content.replace(/placeholder=""zel durumlar/g, 'placeholder="Özel durumlar"');
content = content.replace(/placeholder=" "ğrenci/g, 'placeholder="🔍 Öğrenci');
content = content.replace(/ /g, '🔍 ');
content = content.replace(//g, '🌙'); // Theme toggle moon icon or similar
content = content.replace(//g, '📊'); // Dashboard
content = content.replace(//g, '👥'); // Students
content = content.replace(//g, '📅'); // Matrix
content = content.replace(//g, '🏦'); // Bank
content = content.replace(//g, '🔄'); // Match
content = content.replace(//g, '📈'); // Rapor
content = content.replace(/‍‍‍/g, '👨‍👩‍👧‍👦'); // Kardesler
content = content.replace(//g, '💸'); // Giderler
content = content.replace(//g, '📖'); // Kilavuz
content = content.replace(//g, '💾'); // Sablon
content = content.replace(//g, '📥'); // Import

// 2. Fix some missing hyphens in style attributes
content = content.replace(/boxshadow:/g, 'box-shadow:');
content = content.replace(/gridcolumn:/g, 'grid-column:');
content = content.replace(/flexwrap:/g, 'flex-wrap:');

// 3. Restore page-ogrenci-detay
const detailPageHtml = `
      <!-- ÖĞRENCİ DETAY SAYFASI -->
      <div id="page-ogrenci-detay" class="page">
        <div class="table-container" style="margin-bottom: 20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 15px; border-bottom:1px solid var(--border);">
              <h3 style="margin:0; font-size:16px;">Öğrenci Detayları</h3>
              <div>
                <button class="btn" onclick="app.showPage('ogrenciler')" style="font-size:12px; padding:6px 12px; margin-right:5px; background:var(--surface); color:var(--text); border:1px solid var(--border);">Geri Dön</button>
                <button class="btn" onclick="app.showEditStudent(app.currentDetailTc)" style="font-size:12px; padding:6px 12px; background:rgba(255,152,0,0.1); color:#ff9800; border:1px solid rgba(255,152,0,0.3); margin-right:5px;">Düzenle</button>
                <button class="btn btn-success" onclick="app.showAddPayment(); setTimeout(() => { document.getElementById('newogrenci').value = app.currentDetailTc; }, 50);" style="font-size:12px; padding:6px 12px;">+ Ödeme Ekle</button>
              </div>
          </div>
          <table class="data-table" style="width:100%; border-collapse: collapse;" id="detail-student-info">
              <!-- JS ile doldurulur -->
          </table>
        </div>

        <div style="display:flex; justify-content:flex-end; padding:10px 15px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:20px; align-items:center;">
            <strong style="font-size:14px; margin-right:15px;">Toplam Ödenen:</strong>
            <span id="detail-total-paid" style="font-size:16px; font-weight:700; color:var(--text);">0 ₺</span>
        </div>

        <div class="table-container">
          <div style="padding:10px 15px; background:rgba(139, 195, 74, 0.1); border-bottom:1px solid var(--border); text-align:center;">
              <h3 style="margin:0; font-size:16px; color:var(--accent);">Yapılan Ödemeler</h3>
          </div>
          <table class="data-table" style="width:100%;">
              <thead>
                  <tr>
                      <th style="width:60px;">Sıra No</th>
                      <th>Ödeme Türü / Ay</th>
                      <th>Ödeme Tarihi</th>
                      <th>Dekont No</th>
                      <th style="text-align:right;">Tutar</th>
                  </tr>
              </thead>
              <tbody id="detail-payments-body">
                  <!-- JS ile doldurulur -->
              </tbody>
          </table>
        </div>
      </div>
`;

if (!content.includes('page-ogrenci-detay')) {
    // Insert before the closing tags of .content
    content = content.replace('      <! ÖĞRENCİLER >', detailPageHtml + '\n\n      <! ÖĞRENCİLER >');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Final restoration complete.');
