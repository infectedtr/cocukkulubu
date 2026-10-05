const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'latin1');

let newPageHtml = `
      <div id="page-ogrenci-detay" class="page">
      <div class="table-container" style="margin-bottom: 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 15px; border-bottom:1px solid var(--border);">
            <h3 style="margin:0; font-size:16px;">&#214;&#287;renci Detaylar&#305;</h3>
            <div>
              <button class="btn btn-primary" onclick="app.showPage('matris')" style="font-size:12px; padding:6px 12px; margin-right:5px; background:var(--surface); color:var(--text); border:1px solid var(--border);">&#8592; Matrise D&#246;n</button>
              <button class="btn btn-primary" onclick="app.showEditStudent(app.currentDetailTc)" style="font-size:12px; padding:6px 12px;">D&#252;zenle</button>
            </div>
        </div>
        <table class="data-table" style="width:100%; border-collapse: collapse;" id="detail-student-info">
            <!-- Populated via JS -->
        </table>
      </div>

      <div style="display:flex; justify-content:flex-end; padding:10px 15px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:20px; align-items:center;">
          <strong style="font-size:14px; margin-right:15px;">Toplam &#214;denen:</strong>
          <span id="detail-total-paid" style="font-size:16px; font-weight:700; color:var(--text);">0 &#8378;</span>
      </div>

      <div class="table-container">
        <div style="padding:10px 15px; background:rgba(139, 195, 74, 0.2); border-bottom:1px solid var(--border); text-align:center;">
            <h3 style="margin:0; font-size:16px; color:#558b2f;">Yap&#305;lan &#214;demeler</h3>
        </div>
        <table class="data-table" style="width:100%;">
            <thead>
                <tr>
                    <th style="width:60px;">S&#305;ra No</th>
                    <th>&#214;deme T&#252;r&#252; / Ay</th>
                    <th>&#214;deme Tarihi</th>
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

indexHtml = indexHtml.replace('<!-- \xD6\u011ERENC\xDD D\xDCZENLE MODAL -->', newPageHtml + '\n  <!-- \xD6\u011ERENC\xDD D\xDCZENLE MODAL -->');
fs.writeFileSync('index.html', indexHtml, 'latin1');


let appJs = fs.readFileSync('app.js', 'latin1');

let jsCode = `
app.currentDetailTc = null;
app.showStudentDetail = function(tc) {
    app.currentDetailTc = tc;
    const s = allStudents.find(x => x.tc === tc);
    if (!s) return;

    const tbody = document.getElementById('detail-student-info');
    if (tbody) {
        tbody.innerHTML = \`
            <tr><th style="width:200px; text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">&#214;&#287;rencinin Ad&#305; Soyad&#305;</th><td style="font-weight:700; padding:8px;">\${s.ad} \${s.soyad}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">S&#305;n&#305;f&#305;</th><td style="padding:8px;">\${s.sinif || '-'}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">&#214;&#287;renci No</th><td style="padding:8px;">\${s.no || '-'}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">TC Kimlik No</th><td style="padding:8px;">\${s.tc}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">Baba Ad&#305; Soyad&#305;</th><td style="padding:8px;">\${s.baba_adi || '-'}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">Anne Ad&#305; Soyad&#305;</th><td style="padding:8px;">\${s.anne_adi || '-'}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">E&#287;itim T&#252;r&#252;</th><td style="padding:8px;">\${formatEgitimTuru(s.egitim_turu)}</td></tr>
        \`;
    }

    const pb = document.getElementById('detail-payments-body');
    if (pb) {
        pb.innerHTML = '';
        const payments = allPayments.filter(p => p.tc === tc).sort((a, b) => {
            const da = new Date(a.tarih);
            const db = new Date(b.tarih);
            return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
        });

        let total = 0;
        if (payments.length === 0) {
            pb.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Kay&#305;tl&#305; &#246;deme bulunamad&#305;.</td></tr>';
        } else {
            payments.forEach((p, index) => {
                const tutar = parseFloat(p.tutar) || 0;
                total += tutar;
                let bgClass = index % 2 !== 0 ? 'background:rgba(0,0,0,0.03);' : '';
                
                pb.innerHTML += \`
                    <tr style="\${bgClass} cursor:pointer;" onclick="app.showEditPayment(\${p.id})" title="D&#252;zenlemek i&#231;in t&#305;klay&#305;n">
                        <td style="text-align:center;">\${index + 1}</td>
                        <td>\${p.ay} \${p.tur !== '&#214;deme' ? \`(\${p.tur})\` : ''} \${p.notlar ? \` <span style="color:var(--accent); font-size:10px;">[Not]</span>\` : ''}</td>
                        <td>\${p.tarih || '-'}</td>
                        <td>\${p.dekont || '-'}</td>
                        <td style="text-align:right; font-weight:700;">\${tutar} &#8378;</td>
                    </tr>
                \`;
            });
        }
        
        const totalEl = document.getElementById('detail-total-paid');
        if (totalEl) {
            totalEl.innerHTML = \`\${total} &#8378;\`;
        }
    }
    
    // update title directly
    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-sub');
    if (titleEl) titleEl.innerText = '\u00D6\u011Frenci Detaylar\u0131';
    if (subEl) subEl.innerText = s.ad + ' ' + s.soyad;

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-ogrenci-detay').classList.add('active');
};
`;

appJs = appJs.replace('Object.assign(window.app, {', jsCode + '\n  Object.assign(window.app, {');
appJs = appJs.replace('showStudentDetail,\n', '');
appJs = appJs.replace('exportMatrixPDF,\n', 'showStudentDetail,\n      exportMatrixPDF,\n');

// Also update the matrix cell onClick to navigate to detail instead of doing nothing or editing student directly.
// The user asked "MATRISTE OLDUĞU GİBİ... öğrenciye ait bir sayfa"
// Wait, currently in matrix, clicking the student's name opens edit student modal:
// <span onclick="app.showEditStudent('${s.tc}')" style="cursor:pointer; ...
// Let's change it to app.showStudentDetail('${s.tc}')

appJs = appJs.replace(/onclick="app.showEditStudent\('\$\{s.tc\}'\)"/g, `onclick="app.showStudentDetail('\${s.tc}')"`);
appJs = appJs.replace(/onclick="app.showEditStudent\(\$\{s.tc\}\)"/g, `onclick="app.showStudentDetail('\${s.tc}')"`); // just in case

// We can also add it to the 'Öğrenciler' list table.
appJs = appJs.replace(/onclick="app.showEditStudent\(\$\{s.tc\}\)"/g, `onclick="app.showStudentDetail('\${s.tc}')"`);

fs.writeFileSync('app.js', appJs, 'latin1');
console.log('Pages added.');
