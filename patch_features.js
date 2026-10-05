/**
 * patch_features.js
 * 1. Matris boş hücrelere tıklanınca openMatrixQuickAdd çağır
 * 2. showStudentDetail'e açıklama not alanı ekle
 * 3. saveStudentAciklama + openMatrixQuickAdd fonksiyonlarını ekle
 * 4. exports güncellemesi
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'app.js');
let src = fs.readFileSync(filePath, 'utf8');

// ─── 1. Matris boş hücre: — yerine tıklanabilir ＋ ───────────────────────────
src = src.replace(
    /rowHtml \+= `<td class="cell-unpaid"><span class="matrix-cell">—<\/span><\/td>`;/g,
    "rowHtml += `<td class=\"cell-unpaid\" onclick=\"app.openMatrixQuickAdd('${s.tc}','${s.ad} ${s.soyad}','${m}')\" style=\"cursor:pointer;\" title=\"Tıkla: Ödeme veya not ekle\"><span class=\"matrix-cell\" style=\"opacity:0.5;\">＋</span></td>`;"
);

// ─── 2. showStudentDetail için yeni student detail fonksiyonu ─────────────────
const oldStudentDetailSection = `window.app = {`;

const newStudentDetailFunctions = `
// ─── Öğrenci Not Kaydet ───────────────────────────────────────────────────────
async function saveStudentAciklama() {
    const tc = window.app.currentDetailTc;
    const aciklama = document.getElementById('student-aciklama-input')?.value || '';
    if (!tc) return;

    const btn = document.getElementById('save-student-note-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Kaydediliyor...'; }

    try {
        const res = await fetch('/api/students/' + tc + '/aciklama', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aciklama })
        });
        if (res.ok) {
            const s = allStudents.find(x => x.tc === tc);
            if (s) s.aciklama = aciklama;
            showToast('Not kaydedildi.', 'success');
        } else {
            showToast('Kaydedilemedi!', 'error');
        }
    } catch (e) {
        showToast('Hata oluştu.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '💾 Kaydet'; }
    }
}

// ─── Matris hızlı ödeme ekle ──────────────────────────────────────────────────
function openMatrixQuickAdd(tc, adSoyad, ay) {
    showAddPayment();
    setTimeout(() => {
        const ogrEl = document.getElementById('new-ogrenci');
        const ayEl  = document.getElementById('new-ay');
        if (ogrEl) ogrEl.value = tc;
        if (ayEl) {
            for (let i = 0; i < ayEl.options.length; i++) {
                if (ayEl.options[i].value === ay) { ayEl.selectedIndex = i; break; }
            }
        }
        const modalTitle = document.querySelector('#add-payment-modal .modal-title');
        if (modalTitle) modalTitle.textContent = '+ Ödeme / Not Ekle — ' + adSoyad + ' / ' + ay;
    }, 80);
}

// ─── Öğrenci Detay Sayfası ────────────────────────────────────────────────────
function showStudentDetail(tc) {
    window.app.currentDetailTc = tc;
    const s = allStudents.find(x => x.tc === tc);
    if (!s) return;

    const tbody = document.getElementById('detail-student-info');
    if (tbody) {
        tbody.innerHTML =
            '<tr><th style="width:200px;text-align:right;background:var(--bg);border-right:1px solid var(--border);padding:8px;">Öğrencinin Adı Soyadı</th><td style="font-weight:700;padding:8px;">' + s.ad + ' ' + s.soyad + '</td></tr>' +
            '<tr><th style="text-align:right;background:var(--bg);border-right:1px solid var(--border);padding:8px;">Sınıfı</th><td style="padding:8px;">' + (s.sinif || '-') + '</td></tr>' +
            '<tr><th style="text-align:right;background:var(--bg);border-right:1px solid var(--border);padding:8px;">Öğrenci No</th><td style="padding:8px;">' + (s.no || '-') + '</td></tr>' +
            '<tr><th style="text-align:right;background:var(--bg);border-right:1px solid var(--border);padding:8px;">TC Kimlik No</th><td style="padding:8px;">' + s.tc + '</td></tr>' +
            '<tr><th style="text-align:right;background:var(--bg);border-right:1px solid var(--border);padding:8px;">Baba Adı Soyadı</th><td style="padding:8px;">' + (s.baba_adi || '-') + '</td></tr>' +
            '<tr><th style="text-align:right;background:var(--bg);border-right:1px solid var(--border);padding:8px;">Anne Adı Soyadı</th><td style="padding:8px;">' + (s.anne_adi || '-') + '</td></tr>' +
            '<tr><th style="text-align:right;background:var(--bg);border-right:1px solid var(--border);padding:8px;">Eğitim Türü</th><td style="padding:8px;">' + formatEgitimTuru(s.egitim_turu) + '</td></tr>';
    }

    // Not / Açıklama Alanı
    const notContainer = document.getElementById('detail-student-note-container');
    if (notContainer) {
        const escaped = (s.aciklama || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        notContainer.innerHTML =
            '<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px;margin-bottom:20px;">' +
            '  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
            '    <label style="font-size:14px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:8px;"><span style="font-size:18px;">📝</span> Öğrenci Hakkında Notlar</label>' +
            '    <button id="save-student-note-btn" class="btn btn-primary" style="padding:6px 16px;font-size:13px;" onclick="app.saveStudentAciklama()">💾 Kaydet</button>' +
            '  </div>' +
            '  <textarea id="student-aciklama-input" style="width:100%;min-height:100px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:14px;resize:vertical;line-height:1.6;" placeholder="Bu öğrenci hakkında notlarınızı buraya yazabilirsiniz... (örn: veli iletişim notu, özel durum, ödeme anlaşması vb.)">' + escaped + '</textarea>' +
            '</div>';
    }

    const pb = document.getElementById('detail-payments-body');
    if (pb) {
        pb.innerHTML = '';
        const payments = allPayments.filter(p => p.tc === tc).sort((a, b) => {
            const da = new Date(a.tarih);
            const db2 = new Date(b.tarih);
            return (isNaN(da) ? 0 : da) - (isNaN(db2) ? 0 : db2);
        });

        let total = 0;
        if (payments.length === 0) {
            pb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text2);">Kayıtlı ödeme bulunamadı.</td></tr>';
        } else {
            payments.forEach((p, index) => {
                const tutar = parseFloat(p.tutar) || 0;
                total += tutar;
                const bgClass = index % 2 !== 0 ? 'background:rgba(255,255,255,0.03);' : '';
                pb.innerHTML +=
                    '<tr style="' + bgClass + 'cursor:pointer;" onclick="app.showEditPayment(' + p.id + ')" title="Düzenlemek için tıklayın">' +
                    '<td style="text-align:center;">' + (index + 1) + '</td>' +
                    '<td>' + p.ay + (p.tur !== 'Ödeme' ? ' (' + p.tur + ')' : '') + (p.notlar ? ' <span style="color:var(--accent);font-size:10px;">[Not]</span>' : '') + '</td>' +
                    '<td>' + (p.tarih || '-') + '</td>' +
                    '<td>' + (p.dekont || '-') + '</td>' +
                    '<td style="text-align:right;font-weight:700;">' + tutar.toLocaleString('tr-TR') + ' ₺</td>' +
                    '</tr>';
            });
        }

        const totalEl = document.getElementById('detail-total-paid');
        if (totalEl) totalEl.innerHTML = total.toLocaleString('tr-TR') + ' ₺';
    }

    showPage('ogrenci-detay');
}

window.app = {`;

src = src.replace('window.app = {', newStudentDetailFunctions);

// ─── 3. Exports: showStudentDetail, openMatrixQuickAdd, saveStudentAciklama ───
src = src.replace(
    'showEditExpense, updateExpense\n};',
    'showEditExpense, updateExpense,\n    showStudentDetail, openMatrixQuickAdd, saveStudentAciklama\n};'
);

// ─── 4. currentDetailTc başlatma ─────────────────────────────────────────────
if (!src.includes('app.currentDetailTc')) {
    src = src.replace('window.app = {', 'window.app = {\n');
    // append after closing brace
    src += '\nwindow.app.currentDetailTc = "";\n';
}

fs.writeFileSync(filePath, src, 'utf8');
console.log('✅ patch_features.js başarıyla uygulandı.');
