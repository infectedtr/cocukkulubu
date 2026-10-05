const fs = require('fs');
let c = fs.readFileSync('public/app.js', 'utf8');

const detailLogic = `
// ---------- Student Detail Logic ----------
app.currentDetailTc = "";
app.showStudentDetail = function(tc) {
    app.currentDetailTc = tc;
    const s = allStudents.find(x => x.tc === tc);
    if (!s) return;

    const tbody = document.getElementById('detail-student-info');
    if (tbody) {
        tbody.innerHTML = \`
            <tr><th style="width:200px; text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">Öğrencinin Adı Soyadı</th><td style="font-weight:700; padding:8px;">\${s.ad} \${s.soyad}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">Sınıfı</th><td style="padding:8px;">\${s.sinif || '-'}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">Öğrenci No</th><td style="padding:8px;">\${s.no || '-'}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">TC Kimlik No</th><td style="padding:8px;">\${s.tc}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">Baba Adı Soyadı</th><td style="padding:8px;">\${s.baba_adi || '-'}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">Anne Adı Soyadı</th><td style="padding:8px;">\${s.anne_adi || '-'}</td></tr>
            <tr><th style="text-align:right; background:var(--bg); border-right:1px solid var(--border); padding:8px;">Eğitim Türü</th><td style="padding:8px;">\${formatEgitimTuru(s.egitim_turu)}</td></tr>
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
            pb.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text2);">Kayıtlı ödeme bulunamadı.</td></tr>';
        } else {
            payments.forEach((p, index) => {
                const tutar = parseFloat(p.tutar) || 0;
                total += tutar;
                let bgClass = index % 2 !== 0 ? 'background:rgba(255,255,255,0.03);' : '';
                
                pb.innerHTML += \`
                    <tr style="\${bgClass} cursor:pointer;" onclick="app.showEditPayment(\${p.id})" title="Düzenlemek için tıklayın">
                        <td style="text-align:center;">\${index + 1}</td>
                        <td>\${p.ay} \${p.tur !== 'Ödeme' ? \`(\${p.tur})\` : ''} \${p.notlar ? \` <span style="color:var(--accent); font-size:10px;">[Not]</span>\` : ''}</td>
                        <td>\${p.tarih || '-'}</td>
                        <td>\${p.dekont || '-'}</td>
                        <td style="text-align:right; font-weight:700;">\${tutar.toLocaleString('tr-TR')} ₺</td>
                    </tr>
                \`;
            });
        }
        
        const totalEl = document.getElementById('detail-total-paid');
        if (totalEl) {
            totalEl.innerHTML = total.toLocaleString('tr-TR') + ' ₺';
        }
    }
    
    // update global header if needed
    const globalTitle = document.getElementById('global-title');
    // Save original title if not saved
    if (!app._originalTitle && globalTitle) app._originalTitle = globalTitle.innerText;
    
    // show page
    app.showPage('ogrenci-detay');
};
`;

if (!c.includes('app.showStudentDetail')) {
    c += detailLogic;
}

// Bump version
c = c.replace(/app.js\?v=\d+/g, 'app.js?v=13');

fs.writeFileSync('public/app.js', c, 'utf8');
console.log('Student Detail logic merged into app.js.');
