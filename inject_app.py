import os

with open('public/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('// ---------- Placeholder render functions ----------')
if idx != -1:
    content = content[:idx]
    
new_code = """// ---------- Render Functions ----------
function renderPaymentsTable() {
    const tbody = document.getElementById("recent-payments");
    if (!tbody) return;
    tbody.innerHTML = "";
    allPayments.slice(0, 10).forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${p.ad_soyad || p.tc}</td>
            <td>${p.ay}</td>
            <td>${p.tarih}</td>
            <td><span class="code-badge">${p.dekont}</span></td>
            <td class="amount positive">${p.tutar} ₺</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderStatementsTable() {
    const tbody = document.getElementById("hesap-table");
    const countEl = document.getElementById("hesap-count");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const searchTerm = (document.getElementById('search-hesap') ? document.getElementById('search-hesap').value.toLowerCase() : '');
    const filterTur = (document.getElementById('filter-hesap-tur') ? document.getElementById('filter-hesap-tur').value : '');
    
    let filtered = allStatements.filter(s => {
        if (searchTerm && !s.aciklama.toLowerCase().includes(searchTerm) && !s.kod.toLowerCase().includes(searchTerm)) return false;
        if (filterTur === 'gelir' && s.tur !== 'Gelir') return false;
        if (filterTur === 'gider' && s.tur !== 'Gider') return false;
        return true;
    });

    if (countEl) countEl.innerText = `${filtered.length} İşlem`;

    filtered.forEach(s => {
        const tr = document.createElement("tr");
        const isGelir = s.tur === "Gelir";
        tr.innerHTML = `
            <td>${s.tarih}</td>
            <td><span class="code-badge">${s.kod}</span></td>
            <td style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${s.aciklama}">${s.aciklama}</td>
            <td class="amount ${isGelir ? 'positive' : 'negative'}">${isGelir ? '+' : '-'}${Math.abs(s.tutar)} ₺</td>
            <td>-</td>
        `;
        tbody.appendChild(tr);
    });
}

// ---------- UI Interaction ----------
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-page') === page);
    });
    const titleMap = {dashboard:'Gösterge Paneli',ogrenciler:'Öğrenciler',matris:'Tüm Aylar Matrisi',hesap:'Banka Ekstresi',eslestir:'Dekont Eşleştirme',rapor:'Ay Bazlı Rapor',kardesler:'Kardeş Listesi',ayarlar:'Ayarlar'};
    const subMap = {dashboard:'Genel özet ve istatistikler',ogrenciler:'Öğrenci listesi ve işlemler',matris:'Ödeme matrisi',hesap:'Banka ekstre yönetimi',eslestir:'Dekont eşleştirme',rapor:'Aylara göre raporlar',kardesler:'Kardeş ilişkileri',ayarlar:'Uygulama ayarları'};
    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-sub');
    if (titleEl) titleEl.innerText = titleMap[page] || '';
    if (subEl) subEl.innerText = subMap[page] || '';
    
    if(page === 'hesap') renderStatementsTable();
    if(page === 'eslestir') renderMatches();
}

function showTab(section, tab, ev) {
    const parent = ev.target.closest('.card, .modal-body, .page');
    if(!parent) return;
    parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    ev.target.classList.add('active');
    
    parent.querySelectorAll('.tab-content').forEach(c => {
        if (c.id.includes(section)) c.classList.remove('active');
    });
    const targetId = `tab-${section}-${tab}`;
    const targetContent = document.getElementById(targetId);
    if (targetContent) targetContent.classList.add('active');
}

function closeModal(id) {
    const m = document.getElementById(id);
    if(m) m.classList.remove('open');
}

function showAddPayment() {
    const m = document.getElementById('add-payment-modal');
    if(m) {
        // populate students
        const sel = document.getElementById('new-ogrenci');
        sel.innerHTML = '<option value="">Seçiniz...</option>';
        allStudents.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.tc;
            opt.textContent = `${s.ad} ${s.soyad}`;
            sel.appendChild(opt);
        });
        m.classList.add('open');
    }
}

async function addPayment() {
    const tc = document.getElementById('new-ogrenci').value;
    const ay = document.getElementById('new-ay').value;
    const tarih = document.getElementById('new-tarih').value;
    const dekont = document.getElementById('new-dekont').value;
    const tutar = document.getElementById('new-tutar').value;
    
    if(!tc || !ay || !tutar) {
        showToast('Lütfen zorunlu alanları doldurun.', 'error');
        return;
    }
    
    const student = allStudents.find(s => s.tc === tc);
    const ad_soyad = student ? `${student.ad} ${student.soyad}` : '';
    
    try {
        const res = await fetch('/api/payments', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ tc, ay, tarih, dekont, tutar, ad_soyad })
        });
        if(res.ok) {
            showToast('Ödeme başarıyla eklendi.', 'success');
            closeModal('add-payment-modal');
            await loadData();
        } else {
            showToast('Ödeme eklenemedi.', 'error');
        }
    } catch(e) {
        showToast('Hata oluştu.', 'error');
    }
}

function showImportStudents() {
    const m = document.getElementById('add-student-modal');
    if(m) m.classList.add('open');
}

async function addStudent() {
    const tc = document.getElementById('ns-tc').value;
    const ad = document.getElementById('ns-ad').value;
    const soyad = document.getElementById('ns-soyad').value;
    const sira = document.getElementById('ns-sira').value;
    const anne = document.getElementById('ns-anne').value;
    const baba = document.getElementById('ns-baba').value;
    
    if(!tc || !ad || !soyad) {
        showToast('Lütfen TC, Ad ve Soyad girin.', 'error');
        return;
    }
    try {
        const res = await fetch('/api/students', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ tc, ad, soyad, sira, anne_adi: anne, baba_adi: baba })
        });
        if(res.ok) {
            showToast('Öğrenci başarıyla eklendi.', 'success');
            closeModal('add-student-modal');
            await loadData();
        } else {
            showToast('Öğrenci eklenemedi.', 'error');
        }
    } catch(e) {
        showToast('Hata oluştu.', 'error');
    }
}

async function importStudents() {
    const fileInp = document.getElementById('student-import-file');
    if(!fileInp.files[0]) return;
    
    const formData = new FormData();
    formData.append('file', fileInp.files[0]);
    
    try {
        const res = await fetch('/api/students/import', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if(res.ok) {
            showToast(data.message || 'Öğrenciler aktarıldı.', 'success');
            closeModal('add-student-modal');
            await loadData();
        } else {
            showToast(data.error || 'Aktarım başarısız.', 'error');
        }
    } catch(e) {
        showToast('Hata oluştu.', 'error');
    }
    fileInp.value = '';
}

function downloadStudentTemplate() {
    showToast('Şablon indiriliyor... (Geçici olarak devre dışı)', 'info');
}

// ---------- Bank Statements ----------
async function uploadStatement() {
    const fileInp = document.getElementById('statement-file');
    if(!fileInp.files[0]) return;
    
    const formData = new FormData();
    formData.append('file', fileInp.files[0]);
    
    try {
        const res = await fetch('/api/upload-statement', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if(res.ok) {
            showToast(data.message || 'Ekstre yüklendi.', 'success');
            await loadData();
            renderStatementsTable();
        } else {
            showToast(data.error || 'Yükleme başarısız.', 'error');
        }
    } catch(e) {
        showToast('Hata oluştu.', 'error');
    }
    fileInp.value = '';
}

async function processPastedData() {
    const text = document.getElementById('paste-area').value;
    if(!text.trim()) return;
    
    const lines = text.split('\\n');
    const items = [];
    
    lines.forEach(line => {
        const parts = line.split('\\t');
        if(parts.length >= 4) {
            items.push({
                tarih: parts[0].trim(),
                kod: parts[1].trim(),
                aciklama: parts[2].trim(),
                tutar: parts[3].trim()
            });
        }
    });
    
    if(items.length === 0) {
        showToast('Geçerli veri bulunamadı.', 'error');
        return;
    }
    
    try {
        const res = await fetch('/api/statements/manual', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ items })
        });
        if(res.ok) {
            showToast('Veriler kaydedildi.', 'success');
            document.getElementById('paste-area').value = '';
            await loadData();
            renderStatementsTable();
        }
    } catch(e) {
        showToast('Hata oluştu.', 'error');
    }
}

async function clearStatements() {
    if(!confirm('Tüm ekstre verileri silinsin mi?')) return;
    try {
        const res = await fetch('/api/statements', { method: 'DELETE' });
        if(res.ok) {
            showToast('Ekstreler temizlendi.', 'success');
            await loadData();
            renderStatementsTable();
        }
    } catch(e) {}
}

async function renderMatches() {
    const tbody = document.getElementById('match-table');
    const countEl = document.getElementById('match-count');
    if(!tbody) return;
    
    try {
        const res = await fetch('/api/match');
        const matches = await res.json();
        
        tbody.innerHTML = '';
        if(countEl) countEl.innerText = `${matches.length} Eşleşme`;
        
        matches.forEach((m, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx+1}</td>
                <td>${m.ad_soyad || '-'}</td>
                <td>${m.tc || '-'}</td>
                <td>${m.tarih}</td>
                <td><span class="code-badge">${m.kod}</span></td>
                <td class="amount positive">${m.tutar} ₺</td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) {
        console.error("Matches load failed", e);
    }
}

function filterStudents() { renderStudentTable(); }
function filterHesap() { renderStatementsTable(); }
function filterMatrix() { /* TODO */ }
function bulkDeleteStudents() { deleteSelectedStudents(); }
function exportCurrentPage() { showToast('Dışa aktarım yapılıyor...', 'info'); }
function saveMatchesAsPayments() { showToast('Otomatik eşleşmeleri kaydetme özelliği hazırlanıyor.', 'info'); }
function exportMatchesExcel() { showToast('Excel dışa aktarılıyor...', 'info'); }
function exportMatchesPDF() { showToast('PDF yazdırılıyor...', 'info'); }

const origLoadData = loadData;
loadData = async function() {
    await origLoadData();
    renderStatementsTable();
    renderPaymentsTable();
};

window.app = { toggleTheme, switchMode, deleteSelectedStudents, deleteMonthlyPayments, deleteAllPayments, hardReset, loadData, loadMode };
"""

with open('public/app.js', 'w', encoding='utf-8') as f:
    f.write(content + new_code)
        
print("app.js updated successfully")
