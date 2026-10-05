/**
 * app.js – Front‑end logic for Zübeyde Hanım Çocuk Kulübü Aidat Takip Sistemi
 * Handles theme, mode toggle, data loading, rendering, and KVKK compliance.
 */

// ---------- Global mode UI helpers ----------
function updateGlobalHeader() {
    const titleEl = document.getElementById('global-title');
    if (!titleEl) return;

    let okulAdi = currentSettings.school_name ? currentSettings.school_name.trim() : "Zübeyde Hanım";

    if (currentMode === 'kulup') {
        titleEl.innerText = `${okulAdi} Çocuk Kulübü`;
    } else {
        titleEl.innerText = `${okulAdi} Uygulama Anaokulu Döner Sermaye İşletmesi`;
    }

    updateDynamicLabels();
}

function updateDynamicLabels() {
    const isKulup = currentMode === 'kulup';

    const lblSabahci = document.getElementById('label-ucret-sabahci');
    const lblTam = document.getElementById('label-ucret-tamgun');
    const lblSabahci2 = document.getElementById('label-ucret-sabahci-2');
    const lblTam2 = document.getElementById('label-ucret-tam-gun-2');

    if (lblSabahci) lblSabahci.innerText = isKulup ? "1. Dönem İndirimli (₺)" : "1. Dönem Sabahçı (₺)";
    if (lblTam) lblTam.innerText = isKulup ? "1. Dönem Kulüp (₺)" : "1. Dönem Tam Gün (₺)";
    if (lblSabahci2) lblSabahci2.innerText = isKulup ? "2. Dönem İndirimli (₺)" : "2. Dönem Sabahçı (₺)";
    if (lblTam2) lblTam2.innerText = isKulup ? "2. Dönem Kulüp (₺)" : "2. Dönem Tam Gün (₺)";

    const selects = ['ns-egitim', 'edit-egitim'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const val = el.value;
            el.innerHTML = isKulup
                ? `<option value="KULÜP">Kulüp</option><option value="İNDİRİMLİ">İndirimli</option>`
                : `<option value="TAM GÜN">Tam Gün</option><option value="SABAHÇI">Sabahçı</option><option value="ÖĞLECİ">Öğleci</option>`;

            if (val === 'SABAHÇI' && isKulup) el.value = 'İNDİRİMLİ';
            else if (val === 'TAM GÜN' && isKulup) el.value = 'KULÜP';
            else if (val === 'İNDİRİMLİ' && !isKulup) el.value = 'SABAHÇI';
            else if (val === 'KULÜP' && !isKulup) el.value = 'TAM GÜN';
            else {
                if (!el.querySelector(`option[value="${val}"]`)) {
                    el.value = isKulup ? 'KULÜP' : 'TAM GÜN';
                } else {
                    el.value = val;
                }
            }
        }
    });
}

function formatEgitimTuru(tur) {
    if (currentMode === 'kulup') {
        if (tur === 'SABAHÇI' || tur === 'İNDİRİMLİ') return 'İNDİRİMLİ';
        if (tur === 'TAM GÜN' || tur === 'KULÜP') return 'KULÜP';
    } else {
        if (tur === 'İNDİRİMLİ') return 'SABAHÇI';
        if (tur === 'KULÜP') return 'TAM GÜN';
    }
    return tur || (currentMode === 'kulup' ? 'KULÜP' : 'TAM GÜN');
}

function getExpectedFee(student, monthName) {
    if (!student) return 0;
    const isDiscounted = student.egitim_turu === 'SABAHÇI' || student.egitim_turu === 'İNDİRİMLİ';

    // Dönem 1: Temmuz - Aralık
    const p1Months = ['TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
    const isP1 = p1Months.includes(monthName);

    if (isP1) {
        return isDiscounted ? parseFloat(currentSettings.ucret_sabahci || 0) : parseFloat(currentSettings.ucret_tam_gun || 0);
    } else {
        // Dönem 2: Ocak - Haziran
        // Eğer 2. dönem ücretleri girilmemişse 1. dönem ücretlerini kullan
        const s2 = currentSettings.ucret_sabahci_2 ? parseFloat(currentSettings.ucret_sabahci_2) : parseFloat(currentSettings.ucret_sabahci || 0);
        const t2 = currentSettings.ucret_tam_gun_2 ? parseFloat(currentSettings.ucret_tam_gun_2) : parseFloat(currentSettings.ucret_tam_gun || 0);
        return isDiscounted ? s2 : t2;
    }
}

function mergePayments(pays) {
    if (!pays || pays.length === 0) return null;
    if (pays.length === 1) return pays[0];
    const total = pays.reduce((sum, p) => sum + parseFloat(p.tutar || 0), 0);
    return {
        ...pays[0],
        tutar: total,
        isMultiple: true,
        count: pays.length,
        originalPayments: pays
    };
}

function getEffectivePayment(tc, month) {
    const matching = allPayments.filter(pay => pay.tc === tc && pay.ay === month);
    if (matching.length > 0) return mergePayments(matching);

    // Bridging logic
    if (month === 'AĞUSTOS') {
        const bridge = allPayments.filter(pay => pay.tc === tc && pay.ay === 'EYLÜL');
        if (bridge.length > 0) return mergePayments(bridge);
    } else if (month === 'EYLÜL') {
        const bridge = allPayments.filter(pay => pay.tc === tc && pay.ay === 'AĞUSTOS');
        if (bridge.length > 0) return mergePayments(bridge);
    }
    return null;
}

function getFamilyPaymentInfo(student, month, customPaymentGetter = null, customSiblingGetter = null) {
    const payGetter = customPaymentGetter || getEffectivePayment;
    const sibGetter = customSiblingGetter || getSiblingLogic;

    let expected = getExpectedFee(student, month);
    let p = payGetter(student.tc, month);
    let paid = p ? parseFloat(p.tutar || 0) : 0;

    // Kardeş indirimi ve aile bazlı ödeme takibi sadece KULÜP modunda geçerlidir.
    // DÖSE (Döner Sermaye) modunda her öğrenci kendi ücretinden tam sorumludur.

    const siblings = sibGetter(student);
    if (siblings.length === 0) {
        return { expected, paid, diff: paid - expected, isFamily: false, bridged: !!(p && p.ay !== month), p };
    }

    const family = [student, ...siblings];
    let familyExpected = 0;

    // Kulüp modunda kardeş indirimi: En büyük ücret tam, diğerleri %50 indirimli.
    let fees = family.map(f => getExpectedFee(f, month)).sort((a, b) => b - a);
    if (currentMode === 'kulup') {
        familyExpected = fees[0];
        for (let i = 1; i < fees.length; i++) familyExpected += fees[i] * 0.5;
    } else {
        familyExpected = family.reduce((sum, f) => sum + getExpectedFee(f, month), 0);
    }

    let familyPaid = 0;
    family.forEach(f => {
        let sp = payGetter(f.tc, month);
        if (sp) familyPaid += parseFloat(sp.tutar || 0);
    });

    return { expected: familyExpected, paid: familyPaid, diff: familyPaid - familyExpected, isFamily: true, bridged: !!(p && p.ay !== month), p };
}

function updateHeaderLogo() {
    const logo = document.getElementById('header-logo');
    const name = document.getElementById('header-name');
    if (!logo || !name) return;

    // Check if custom settings exist
    if (currentSettings.school_logo) {
        if (currentSettings.school_logo.startsWith('data:image/')) {
            logo.innerHTML = `<img src="${currentSettings.school_logo}" style="width:100%; height:100%; object-fit:contain; border-radius:6px;">`;
        } else {
            logo.textContent = currentSettings.school_logo;
        }
    } else {
        logo.textContent = currentMode === 'kulup' ? '🏫' : '💰';
    }

    let okulAdi = currentSettings.school_name ? currentSettings.school_name.trim() : "Zübeyde Hanım";

    if (currentMode === 'kulup') {
        name.innerHTML = `${okulAdi}<br>Çocuk Kulübü Aidat Takibi`;
    } else {
        name.innerHTML = `${okulAdi}<br>Döner Sermaye Aidat Takibi`;
    }
}

// ---------- Global state ----------
let allStudents = [];
let allPayments = [];
let allStatements = [];
let allExpenses = [];
let appReady = false;
let pendingMatches = [];
let pendingExpenses = [];
let currentSettings = { ucret_sabahci: 0, ucret_tam_gun: 0 };
let currentMode = "kulup";
let sortState = {
    matrix: { key: 'ad', dir: 'asc' },
    raporListe: { key: 'id', dir: 'asc' },
    raporOgrenci: { key: 'ad', dir: 'asc' },
    students: { key: 'sira', dir: 'asc' }
};

// ---------- Theme handling ----------
function initTheme() {
    const savedTheme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);
}
function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    updateThemeIcon(next);
}
function updateThemeIcon(theme) {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    // Doğru emoji kodları
    btn.textContent = theme === "light" ? "☀️" : "🌙";
}

// ---------- Mode handling ----------
async function loadMode() {
    try {
        const res = await fetch("/api/current-mode");
        const data = await res.json();
        if (data.mode) {
            currentMode = data.mode;
            document.body.setAttribute('data-mode', currentMode);
            // set UI toggle accordingly (both toggles if present)
            const globalToggle = document.getElementById("global-mode-toggle");
            const dashboardToggle = document.getElementById("mode-toggle");
            if (globalToggle) globalToggle.checked = currentMode === "doner";
            if (dashboardToggle) dashboardToggle.checked = currentMode === "doner";
            // update UI elements specific to mode
            updateGlobalHeader();
            updateHeaderLogo();
        }
    } catch (e) {
        console.error("Failed to load mode", e);
    }
}
async function switchMode(ev) {
    // If event is passed, use its target; otherwise check both toggles
    let newMode;
    if (ev && ev.target) {
        newMode = ev.target.checked ? "doner" : "kulup";
    } else {
        const globalToggle = document.getElementById('global-mode-toggle');
        const dashboardToggle = document.getElementById('mode-toggle');
        newMode = (globalToggle && globalToggle.checked) || (dashboardToggle && dashboardToggle.checked) ? "doner" : "kulup";
    }
    if (newMode === currentMode) return; // no change
    
    // Mod değiştirirken verilerin temizlenmesi loadData tarafından yapılacak.
    // Hemen temizlemek UI'da boş tablo görünmesine neden oluyor.
    
    document.body.setAttribute('data-mode', newMode);
    // UI'da verilerin temizlendiğini yansıtmak için boş tabloları render et
    if (typeof renderAll === 'function') renderAll(); 
    
    try {
        const res = await fetch("/api/switch-mode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: newMode })
        });
        const data = await res.json();
        if (res.ok) {
            currentMode = newMode;
            showToast(`Mod ${newMode === 'kulup' ? 'Kulüp' : 'DÖSE'} olarak değiştirildi.`, "success");

            // Sync all toggles
            const globalToggle = document.getElementById('global-mode-toggle');
            const dashboardToggle = document.getElementById('mode-toggle');
            if (globalToggle) globalToggle.checked = currentMode === "doner";
            if (dashboardToggle) dashboardToggle.checked = currentMode === "doner";
            // refresh UI that depends on mode
            updateGlobalHeader();
            // load settings for the new mode before data so fees are correct
            await loadSettings();
            updateHeaderLogo();
            // reload data because DB file changed
            await loadData();

            // Mod değişiminden sonra dashboard'a dönmek, kafa karışıklığını önler
            // Özellikle eşleştirme sayfasındaysak veriler değişeceği için dönmek en iyisi.
            const currentPage = document.querySelector('.page.active')?.id?.replace('page-', '');
            if (currentPage === 'eslestir' || currentPage === 'ogrenci-detay') {
                showPage('dashboard');
            } else {
                renderAll();
            }
        } else {
            showToast(data.error || "Mod değiştirilemedi.", "error");
            // revert UI toggle to previous state
            const globalToggle = document.getElementById('global-mode-toggle');
            const dashboardToggle = document.getElementById('mode-toggle');
            if (globalToggle) globalToggle.checked = currentMode === "doner";
            if (dashboardToggle) dashboardToggle.checked = currentMode === "doner";
        }
    } catch (e) {
        console.error(e);
        showToast("Mod değiştirirken hata oluştu.", "error");
    }
}

// ---------- Data loading ----------
async function loadData() {
    try {
        console.log('[APP] Veriler yükleniyor...');
        const t = new Date().getTime();
        
        const fetchJSON = async (url) => {
            const r = await fetch(url);
            if (!r.ok) throw new Error(`${url} returned ${r.status}`);
            return r.json();
        };

        const [studentsData, paymentsData, expensesData, settingsData, statementsData] = await Promise.all([
            fetchJSON(`/api/students?t=${t}`),
            fetchJSON(`/api/payments?t=${t}`),
            fetchJSON(`/api/expenses?t=${t}`),
            fetchJSON(`/api/settings?t=${t}`),
            fetchJSON(`/api/statements?t=${t}`)
        ]);

        allStudents = Array.isArray(studentsData) ? studentsData : [];
        allPayments = Array.isArray(paymentsData) ? paymentsData : [];
        allExpenses = Array.isArray(expensesData) ? expensesData : [];
        allSettings = settingsData || {};
        allStatements = Array.isArray(statementsData) ? statementsData : [];

        console.log(`[APP] Veri yükleme tamamlandı: ${allStudents.length} öğrenci, ${allPayments.length} ödeme, ${allExpenses.length} gider.`);
        
        // Refresh UI
        renderAll();

        // Otomatik eşleştirme aktifse çalıştır
        if (window.autoSaveMatchesActive) {
            window.autoSaveMatchesActive = false;
            if (typeof renderMatches === 'function') {
                await renderMatches(); 
                await autoSaveAllMatchedData();
            }
        }

    } catch (e) {
        console.error('[APP-LOAD-ERROR]', e);
        showToast('Veriler yüklenirken bir hata oluştu: ' + e.message, 'error');
    }
}

function renderAll() {
    const activePage = document.querySelector('.page.active');
    const pageId = activePage ? activePage.id : '';

    console.log(`[RENDER] Refreshing UI (Active Page: ${pageId})`);

    // Global stats always update
    updateStats();
    setDefaultMonths();

    // Context-sensitive rendering
    if (pageId === 'page-dashboard') {
        renderDashboardStats();
        renderDashboardUnpaid();
    } else if (pageId === 'page-ogrenciler') {
        renderStudentTable();
    } else if (pageId === 'page-matris') {
        renderMatrix();
    } else if (pageId === 'page-rapor') {
        renderRapor();
    } else if (pageId === 'page-beklenen') {
        renderExpectedPayments();
    } else if (pageId === 'page-eslestir') {
        renderMatches();
    } else if (pageId === 'page-ekstre') {
        renderStatementsTable();
    } else if (pageId === 'page-giderler') {
        renderExpenses();
    }
}

function updateStats() {
    const footerStats = document.getElementById('sidebar-stats');
    if (footerStats) {
        let html = `<span style="color:var(--accent)">●</span> ${currentMode === 'kulup' ? 'Kulüp' : 'DÖSE'}<br>${allStudents.length} Öğrenci | ${allExpenses.length} Gider`;
        if (allSettings && !allSettings.kvkk_accepted) {
            html += `<br><span style="color:var(--warn); font-size:10px; cursor:pointer" onclick="app.showPage('ayarlar')">⚠️ KVKK Onayı Bekleniyor</span>`;
        }
        footerStats.innerHTML = html;
    }
}

// ---------- UI helpers ----------
function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.right = "20px";
    toast.style.padding = "12px 20px";
    toast.style.background = type === "error" ? "#f44336" : "#4caf50";
    toast.style.color = "white";
    toast.style.borderRadius = "4px";
    toast.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ---------- Student table rendering (simplified) ----------
function renderStudentTable() {
    const tbody = document.getElementById("student-table");
    const countEl = document.getElementById("student-count");
    const theadTr = document.querySelector("#page-ogrenciler thead tr");
    if (!tbody) return;

    const searchTerm = (document.getElementById('search-ogrenci') ? document.getElementById('search-ogrenci').value.toLowerCase() : '');

    const sortIcon = (key) => {
        if (sortState.students.key !== key) return '↕️';
        return sortState.students.dir === 'asc' ? '🔼' : '🔽';
    };

    if (theadTr) {
        theadTr.innerHTML = `
            <th style="width:40px"><input type="checkbox" id="select-all" onclick="app.toggleSelectAll()"></th>
            <th onclick="app.handleSort('students', 'sira')" style="cursor:pointer">Sıra ${sortIcon('sira')}</th>
            <th onclick="app.handleSort('students', 'no')" style="cursor:pointer">No ${sortIcon('no')}</th>
            <th onclick="app.handleSort('students', 'ad')" style="cursor:pointer">Ad Soyad ${sortIcon('ad')}</th>
            <th onclick="app.handleSort('students', 'sinif')" style="cursor:pointer">Sınıf ${sortIcon('sinif')}</th>
            <th onclick="app.handleSort('students', 'tc')" style="cursor:pointer">TC No ${sortIcon('tc')}</th>
            <th>Veli Bilgisi</th>
            <th onclick="app.handleSort('students', 'egitim')" style="cursor:pointer">Tür ${sortIcon('egitim')}</th>
            <th onclick="app.handleSort('students', 'total')" style="cursor:pointer">Topl.Öd. ${sortIcon('total')}</th>
            <th style="width:80px">İşlem</th>
        `;
    }

    let studentData = allStudents.filter(st => {
        const fullName = `${st.ad || ''} ${st.soyad || ''}`.toLowerCase();
        return !searchTerm || fullName.includes(searchTerm) || (st.tc || '').includes(searchTerm);
    }).map(st => {
        const studentPayments = allPayments.filter(p => p.tc === st.tc);
        const totalPaid = studentPayments.reduce((sum, p) => sum + parseFloat(p.tutar || 0), 0);
        return { ...st, totalPaid, fullName: `${st.ad} ${st.soyad}` };
    });

    // Sıralama uygula
    studentData.sort((a, b) => {
        let key = sortState.students.key;
        let valA, valB;
        if (key === 'ad') { valA = a.fullName; valB = b.fullName; }
        else if (key === 'total') { valA = a.totalPaid; valB = b.totalPaid; }
        else if (key === 'egitim') { valA = a.egitim_turu; valB = b.egitim_turu; }
        else if (key === 'no') { valA = a.no; valB = b.no; }
        else if (key === 'sinif') { valA = a.sinif; valB = b.sinif; }
        else { valA = a[key]; valB = b[key]; }

        if (typeof valA === 'string') return sortState.students.dir === 'asc' ? valA.localeCompare(valB, 'tr') : valB.localeCompare(valA, 'tr');
        return sortState.students.dir === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });

    if (countEl) countEl.innerText = `${studentData.length} Öğrenci`;

    tbody.innerHTML = "";
    studentData.forEach((st, index) => {
        const tr = document.createElement("tr");
        const veli = [st.anne_adi, st.baba_adi].filter(Boolean).join(' / ') || '-';

        const studentPayments = allPayments.filter(p => p.tc === st.tc);
        let lastMonth = '-';
        let lastDate = '-';
        if (studentPayments.length > 0) {
            const sorted = [...studentPayments].sort((a, b) => {
                const da = a.tarih.split('.').reverse().join('-');
                const db = b.tarih.split('.').reverse().join('-');
                return db.localeCompare(da);
            });
            lastMonth = sorted[0].ay;
            lastDate = sorted[0].tarih;
        }

        const egitimLabel = formatEgitimTuru(st.egitim_turu);
        const isDiscounted = egitimLabel === 'İNDİRİMLİ' || egitimLabel === 'SABAHÇI';

        tr.innerHTML = `
            <td><input type="checkbox" class="student-checkbox" data-tc="${st.tc}"></td>
            <td>${st.sira || (index + 1)}</td>
            <td>${st.no || '-'}</td>
            <td style="font-weight:600; ${isDiscounted ? 'color:var(--accent2); font-style:italic;' : ''}">${st.ad || ''} ${st.soyad || ''}</td>
            <td style="font-weight:600; color:var(--primary)">${st.sinif || '-'}</td>
            <td>${st.tc || '-'}</td>
            <td>${veli}</td>
            <td><span class="badge ${isDiscounted ? 'badge-matched' : (egitimLabel === 'ÖĞLECİ' ? 'badge-partial' : 'badge-paid')}">${egitimLabel}</span></td>
            <td style="font-weight:600; color:var(--accent)">${st.totalPaid} ₺</td>
            <td>
                <div style="display:flex; gap:6px; align-items:center">
                    <button class="btn" style="padding:6px; font-size:12px; background:rgba(255,255,255,0.05); border:1px solid var(--border)" onclick="app.showStudentDetail('${st.tc}')" title="Detaylar">✏️</button>
                    <button class="btn" style="padding:6px; font-size:12px; background:rgba(255,77,77,0.1); border:1px solid rgba(255,77,77,0.2); color:#ff4d4d" onclick="app.deleteStudent('${st.tc}')" title="Sil">🗑</button>
                </div>
            </td>
        `;
        if (isDiscounted) tr.style.backgroundColor = 'rgba(56, 139, 253, 0.05)';
        tbody.appendChild(tr);
    });
}

function toggleSelectAll() {
    const master = document.getElementById("select-all");
    const checked = master && master.checked;
    document.querySelectorAll('#student-table input[type="checkbox"]').forEach(cb => {
        cb.checked = checked;
    });
}
function getSelectedTCs() {
    const tcs = [];
    document.querySelectorAll('#student-table input.student-checkbox').forEach(cb => {
        if (cb.checked && cb.dataset.tc) tcs.push(cb.dataset.tc);
    });
    return tcs;
}
async function deleteSelectedStudents() {
    const tcs = getSelectedTCs();
    if (tcs.length === 0) {
        showToast("Silinecek öğrenci seçilmedi.", "error");
        return;
    }

    showDangerModal(
        `Seçilen <b>${tcs.length}</b> öğrenciyi ve bu öğrencilere ait tüm geçmiş ödemeleri silmek istediğinize emin misiniz?<br><br><b>Bu işlem geri alınamaz!</b>`,
        async () => {
            try {
                const res = await fetch('/api/students/bulk', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tcs })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(`${data.count} öğrenci silindi.`, "success");
                    await loadData();
                } else {
                    showToast(data.error || 'Silme başarısız.', 'error');
                }
            } catch (e) {
                console.error(e);
                showToast('Silme işlemi sırasında hata.', 'error');
            }
        }
    );
}

async function deleteStudent(tc) {
    if (!tc) return;
    showDangerModal(
        `Bu öğrenciyi ve tüm ödeme kayıtlarını <b>kalıcı olarak</b> silmek istediğinize emin misiniz?<br><br><small>Bu işlem geri alınamaz.</small>`,
        async () => {
            try {
                const res = await fetch(`/api/students/${tc}`, { method: 'DELETE' });
                const data = await res.json();
                if (res.ok) {
                    showToast('Öğrenci silindi.', 'success');
                    await loadData();
                } else {
                    showToast(data.error || 'Silme başarısız.', 'error');
                }
            } catch (e) {
                console.error(e);
                showToast('Silme hatası.', 'error');
            }
        }
    );
}

function showDangerModal(text, onConfirm) {
    const modalText = document.getElementById('danger-modal-text');
    if (modalText) modalText.innerHTML = text;

    const btn = document.getElementById('danger-confirm-btn');
    if (btn) {
        // Remove old listeners
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.onclick = async () => {
            app.closeModal('danger-modal');
            await onConfirm();
        };
    }
    openModal('danger-modal');
}

// ---------- Payment deletion ----------
async function deleteMonthlyPayments() {
    const select = document.getElementById('delete-month-select');
    const month = select ? select.value : '';
    if (!month) {
        showToast('Silinecek ay seçilmedi.', 'error');
        return;
    }
    showDangerModal(
        `<b>${month}</b> ayına ait tüm ödeme kayıtlarını silmek istediğinize emin misiniz?<br><br>Bu işlem geri alınamaz!`,
        async () => {
            try {
                const res = await fetch(`/api/payments/month/${encodeURIComponent(month)}`, { method: 'DELETE' });
                const data = await res.json();
                if (res.ok) {
                    showToast(`${data.changes} ödeme silindi.`, 'success');
                    await loadData();
                } else {
                    showToast(data.error || 'Silme başarısız.', 'error');
                }
            } catch (e) {
                console.error(e);
                showToast('Silme sırasında hata.', 'error');
            }
        }
    );
}
async function deleteAllPayments() {
    showDangerModal(
        `Sistemdeki <b>TÜM</b> ödeme kayıtlarını (dekontlar, tutarlar vb.) silmek üzeresiniz.<br><br>Öğrenci listesi etkilenmez ancak tüm ödeme geçmişi <b>kalıcı olarak silinecektir.</b><br><br>Devam edilsin mi?`,
        async () => {
            try {
                const res = await fetch('/api/payments/all-records', { method: 'DELETE' });
                const data = await res.json();
                if (res.ok) {
                    showToast(`${data.changes} ödeme silindi.`, 'success');
                    await loadData();
                } else {
                    showToast(data.error || 'Silme başarısız.', 'error');
                }
            } catch (e) {
                console.error(e);
                showToast('Silme sırasında hata.', 'error');
            }
        }
    );
}

// ---------- Hard reset ----------
async function hardReset() {
    const pwdInput = document.getElementById('hard-reset-password');
    const password = pwdInput ? pwdInput.value : '';
    if (!password) { showToast('Şifre girilmedi.', 'error'); return; }

    showDangerModal(
        `<span style="color:#ff4d4d; font-size:18px; font-weight:800">💣 DİKKAT!</span><br><br>Bu işlem <b>TÜM</b> verileri (Öğrenciler, Ödemeler, Ayarlar vb.) kalıcı olarak silecek ve sistemi ilk kurulum haline getirecektir.<br><br><b>GERİ DÖNÜŞÜ YOKTUR!</b> Devam etmek istiyor musunuz?`,
        async () => {
            try {
                const res = await fetch('/api/hard-reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast('Veritabanı sıfırlandı.', 'success');
                    if (pwdInput) pwdInput.value = '';
                    await loadData();
                } else {
                    showToast(data.error || 'Hard reset başarısız.', 'error');
                }
            } catch (e) {
                console.error(e);
                showToast('Hata oluştu.', 'error');
            }
        }
    );
}

// ---------- Initialization ----------
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadMode();
    loadData().then(() => {
        // Explicitly close all modals on startup to be absolutely safe
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
        
        // Trigger KVKK check
        checkKVKK();
        
        // Hide splash screen after a short delay
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) splash.classList.add('fade-out');
            appReady = true;
            console.log('[APP] Sistem hazır, otomatik tetiklemeler artık aktif.');
            checkOnboarding();
        }, 1500);
    });

    // Close modals on outside click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('open');
        }
    });

    const yearEl = document.getElementById('sidebar-year');
    if (yearEl) yearEl.innerText = `${new Date().getFullYear()} - Aidat Takip`;
});

// ---------- Render Functions ----------
function renderPaymentsTable() {
    const tbody = document.getElementById("recent-payments");
    if (!tbody) return;
    tbody.innerHTML = "";

    // Mükerrer dekont tespiti
    const dekontCounts = {};
    allPayments.forEach(p => {
        if (p.dekont && p.dekont.trim() !== '') {
            const d = p.dekont.trim().toUpperCase();
            dekontCounts[d] = (dekontCounts[d] || 0) + 1;
        }
    });

    const sortedPayments = [...allPayments].sort((a, b) => {
        const dateA = a.tarih ? a.tarih.split('.').reverse().join('-') : '0000-00-00';
        const dateB = b.tarih ? b.tarih.split('.').reverse().join('-') : '0000-00-00';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.id || 0) - (a.id || 0);
    });

    const recent = sortedPayments.slice(0, 15);
    recent.forEach(p => {
        const student = allStudents.find(s => s.tc === p.tc);
        let statusColor = 'var(--positive)';
        let statusTitle = 'Tam Ödeme';

        if (student) {
            const info = getFamilyPaymentInfo(student, p.ay);
            if (info.expected > 0 && p.tur === 'Ödeme') {
                if (info.diff < 0) {
                    statusColor = 'var(--warn)';
                    statusTitle = `Eksik Ödeme (Beklenen Aile Toplamı: ${info.expected} ₺)`;
                } else if (info.diff > 0) {
                    statusColor = 'var(--accent2)';
                    statusTitle = `Fazla Ödeme (Beklenen Aile Toplamı: ${info.expected} ₺)`;
                } else if (info.isFamily) {
                    statusTitle = 'Tam Ödeme (Aile Kardeş İndirimi)';
                }
            } else if (p.tur === 'Raporlu' || p.tur === 'İzinli') {
                statusColor = 'var(--warn)';
                statusTitle = p.tur;
            }
        } else {
            if (p.tur === 'Raporlu' || p.tur === 'İzinli') {
                statusColor = 'var(--warn)';
                statusTitle = p.tur;
            }
        }

        const isDuplicate = p.dekont && p.dekont.trim() !== '' && dekontCounts[p.dekont.trim().toUpperCase()] > 1;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${p.ad_soyad || p.tc}</td>
            <td>${p.ay}</td>
            <td>${p.tarih}</td>
            <td><span class="code-badge ${isDuplicate ? 'duplicate' : ''}" ${isDuplicate ? 'title="Bu dekont numarası birden fazla kullanılmış!"' : ''}>${p.dekont}</span></td>
            <td class="amount" style="color:${statusColor}; font-weight:700" title="${statusTitle}">${p.tutar} ₺</td>
            <td>
                <button class="btn" style="padding:2px 6px; font-size:10px" onclick="app.showEditPayment(${p.id})">✏️</button>
                <button class="btn btn-danger" style="padding:2px 6px; font-size:10px" onclick="app.deletePayment(${p.id})">🗑</button>
            </td>
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

    const existingExpenseDekonts = new Set(allExpenses.map(e => e.dekont));

    filtered.forEach(s => {
        const tr = document.createElement("tr");
        const isGelir = s.tur === "Gelir";
        const isSaved = existingExpenseDekonts.has(s.kod);

        tr.innerHTML = `
            <td>${s.tarih}</td>
            <td><span class="code-badge">${s.kod}</span></td>
            <td style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${s.aciklama}">${s.aciklama}</td>
            <td class="amount ${isGelir ? 'positive' : 'negative'}">${isGelir ? '+' : '-'}${Math.abs(s.tutar)} ₺</td>
            <td>
                ${!isGelir ? (isSaved ? '<span style="color:var(--accent); font-weight:600">KAYDEDİLDİ</span>' : `<button class="btn btn-primary" style="padding:4px 8px; font-size:11px" onclick="app.saveStatementAsExpense(${JSON.stringify(s).replace(/"/g, '&quot;')})">Gider Kaydet</button>`) : '-'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function showAddExpense() {
    openModal('add-expense-modal');
}

function renderExpenses() {
    const tbody = document.getElementById("expense-list-body");
    const totalEl = document.getElementById("expense-total-amount");
    const monthFilterEl = document.getElementById("expense-month-filter");
    const searchFilter = document.getElementById('expense-search') ? document.getElementById('expense-search').value.toLocaleUpperCase('tr-TR') : '';
    const catFilter = document.getElementById('expense-cat-filter') ? document.getElementById('expense-cat-filter').value : 'all';
    const sortVal = document.getElementById('expense-sort') ? document.getElementById('expense-sort').value : 'date-desc';

    if (!tbody) return;

    const selectedMonth = monthFilterEl ? monthFilterEl.value : 'all';

    let filtered = allExpenses.filter(e => {
        const matchesMonth = (selectedMonth === 'all' || e.ay === selectedMonth);
        const matchesCat = (catFilter === 'all' || e.kategori === catFilter);
        const text = `${e.aciklama} ${e.dekont} ${e.kategori}`.toLocaleUpperCase('tr-TR');
        const matchesSearch = text.includes(searchFilter);
        return matchesMonth && matchesCat && matchesSearch;
    });

    // Sorting
    filtered.sort((a, b) => {
        if (sortVal === 'datedesc' || sortVal === 'dateasc') {
            const parseDate = (dStr) => {
                if (!dStr || !dStr.includes('.')) return new Date(2000, 0, 1);
                const parts = dStr.split('.');
                if (parts.length < 3) return new Date(2000, 0, 1);
                return new Date(parts[2], parts[1] - 1, parts[0]);
            };
            const dateA = parseDate(a.tarih);
            const dateB = parseDate(b.tarih);
            return sortVal === 'datedesc' ? dateB - dateA : dateA - dateB;
        }
        if (sortVal === 'amountdesc') return (b.tutar || 0) - (a.tutar || 0);
        if (sortVal === 'amountasc') return (a.tutar || 0) - (b.tutar || 0);
        if (sortVal === 'catasc') return (a.kategori || '').localeCompare(b.kategori || '');
        return 0;
    });

    tbody.innerHTML = "";
    let total = 0;

    filtered.forEach(e => {
        total += (e.tutar || 0);
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${e.tarih}</td>
            <td><span class="badge" style="background:rgba(0,0,0,0.05); border:1px solid var(--border)">${e.kategori}</span></td>
            <td>${e.aciklama}</td>
            <td>${e.dekont || '-'}</td>
            <td style="font-weight:700; color:var(--danger)">${e.tutar} ₺</td>
            <td>
                <button class="btn btn-primary" style="padding:4px 8px; font-size:11px" onclick="app.showEditExpense(${e.id})" title="Düzenle">✏️</button>
                <button class="btn btn-danger" style="padding:4px 8px; font-size:11px" onclick="app.deleteExpense(${e.id})" title="Sil">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (totalEl) totalEl.innerText = total.toLocaleString('tr-TR') + ' ₺';
}

function showEditExpense(id) {
    const exp = allExpenses.find(e => e.id === id);
    if (!exp) return;

    document.getElementById('edit-expense-id').value = exp.id;
    document.getElementById('edit-expense-ay').value = exp.ay;
    document.getElementById('edit-expense-tutar').value = exp.tutar;
    document.getElementById('edit-expense-kategori').value = exp.kategori;
    document.getElementById('edit-expense-aciklama').value = exp.aciklama;
    document.getElementById('edit-expense-dekont').value = exp.dekont;

    // Tarih formatı (DD.MM.YYYY -> YYYY-MM-DD)
    if (exp.tarih && exp.tarih.includes('.')) {
        const [d, m, y] = exp.tarih.split('.');
        document.getElementById('edit-expense-tarih').value = `${y}-${m}-${d}`;
    } else {
        document.getElementById('edit-expense-tarih').value = '';
    }

    openModal('edit-expense-modal');
}

async function updateExpense() {
    const id = document.getElementById('edit-expense-id').value;
    const ay = document.getElementById('edit-expense-ay').value;
    const tarihRaw = document.getElementById('edit-expense-tarih').value;
    const tutar = document.getElementById('edit-expense-tutar').value;
    const kategori = document.getElementById('edit-expense-kategori').value;
    const aciklama = document.getElementById('edit-expense-aciklama').value;
    const dekont = document.getElementById('edit-expense-dekont').value;

    let tarih = tarihRaw;
    if (tarih && tarih.includes('-')) {
        const [y, m, d] = tarih.split('-');
        tarih = `${d}.${m}.${y}`;
    }

    try {
        const res = await fetch(`/api/gider-guncelle/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ay, aciklama, tarih, dekont, tutar: parseFloat(tutar), kategori })
        });
        if (res.ok) {
            showToast('Gider güncellendi.', 'success');
            closeModal('edit-expense-modal');
            await loadData();
        } else {
            const errData = await res.json();
            showToast('Hata: ' + (errData.error || 'Güncellenemedi'), 'error');
        }
    } catch (e) {
        showToast('Hata: ' + e.message, 'error');
    }
}

async function addExpense() {
    const ay = document.getElementById('expense-ay').value;
    const tarihRaw = document.getElementById('expense-tarih').value;
    const tutar = document.getElementById('expense-tutar').value;
    const kategori = document.getElementById('expense-kategori').value;
    const aciklama = document.getElementById('expense-aciklama').value;
    const dekont = document.getElementById('expense-dekont').value;

    if (!tutar || !aciklama) {
        showToast('Lütfen tutar ve açıklama girin.', 'error');
        return;
    }

    let tarih = tarihRaw;
    if (tarih && tarih.includes('-')) {
        const [y, m, d] = tarih.split('-');
        tarih = `${d}.${m}.${y}`;
    }

    try {
        const res = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ay, aciklama, tarih, dekont, tutar: parseFloat(tutar), kategori })
        });
        if (res.ok) {
            showToast('Gider başarıyla kaydedildi.', 'success');
            closeModal('add-expense-modal');
            // Reset form
            document.getElementById('expense-tutar').value = '';
            document.getElementById('expense-aciklama').value = '';
            document.getElementById('expense-dekont').value = '';
            await loadData();
        }
    } catch (e) {
        showToast('Hata: ' + e.message, 'error');
    }
}

function showPasswordModal(text, onConfirm) {
    const modalText = document.getElementById('password-modal-text');
    if (modalText) modalText.innerHTML = text;

    const input = document.getElementById('password-modal-input');
    if (input) input.value = '';

    const btn = document.getElementById('password-confirm-btn');
    if (btn) {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.onclick = async () => {
            const password = document.getElementById('password-modal-input')?.value?.trim();
            if (!password) {
                showToast('Lütfen şifre girin!', 'error');
                return;
            }
            app.closeModal('password-modal');
            await onConfirm(password);
        };
    }
    openModal('password-modal');
}

async function deleteExpense(id) {
    showDangerModal('Bu gider kaydını silmek istediğinize emin misiniz?', async () => {
        try {
            const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Gider silindi.', 'success');
                await loadData();
            }
        } catch (e) {
            showToast('Silme hatası.', 'error');
        }
    });
}

async function deleteAllExpenses() {
    showPasswordModal(
        'DİKKAT: Mevcut moddaki TÜM gider kayıtları kalıcı olarak silinecektir!<br><br>Bu işlem geri alınamaz. Onaylamak için yönetici şifresini girin:',
        async (password) => {
            showLoading('Giderler siliniyor...');
            try {
                console.log('[UI] Sending bulk delete request for expenses...');
                const res = await fetch('/api/expenses/all-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                const result = await res.json();
                if (res.ok && result.success) {
                    showToast('Tüm gider kayıtları başarıyla silindi.', 'success');
                    await loadData();
                    if (typeof renderExpenses === 'function') renderExpenses();
                } else {
                    showToast('Silme işlemi başarısız oldu: ' + (result.error || 'Bilinmeyen hata'), 'error');
                }
            } catch (e) {
                console.error('[UI-ERROR] Delete Expenses Error:', e);
                showToast('Bir hata oluştu: ' + e.message, 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

function exportExpensesExcel() {
    if (allExpenses.length === 0) {
        showToast('Dışa aktarılacak veri bulunamadı.', 'error');
        return;
    }
    
    const month = document.getElementById('expense-month-filter').value;
    const cat = document.getElementById('expense-cat-filter').value;
    
    // Filtrelenmiş veriyi al (mevcut görünümle uyumlu olsun)
    const filtered = allExpenses.filter(e => {
        const matchesMonth = (month === 'all' || e.ay === month);
        const matchesCat = (cat === 'all' || e.kategori === cat);
        return matchesMonth && matchesCat;
    });

    if (filtered.length === 0) {
        showToast('Seçili kriterlere uygun veri bulunamadı.', 'error');
        return;
    }

    const data = filtered.map(e => ({
        'Ay': e.ay,
        'Tarih': e.tarih,
        'Kategori': e.kategori,
        'Açıklama': e.aciklama,
        'Dekont/Fiş': e.dekont,
        'Tutar (₺)': e.tutar
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Giderler");
    const filename = `Giderler_${currentMode}_${month}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast('Excel dosyası indiriliyor...', 'success');
}

function exportExpensesPDF() {
    if (allExpenses.length === 0) {
        showToast('Yazdırılacak veri bulunamadı.', 'error');
        return;
    }

    const month = document.getElementById('expense-month-filter').value;
    const cat = document.getElementById('expense-cat-filter').value;
    const title = `${currentMode === 'kulup' ? 'KULÜP' : 'DÖSE'} GİDER RAPORU - ${month === 'all' ? 'Tüm Aylar' : month}`;

    const filtered = allExpenses.filter(e => {
        const matchesMonth = (month === 'all' || e.ay === month);
        const matchesCat = (cat === 'all' || e.kategori === cat);
        return matchesMonth && matchesCat;
    });

    if (filtered.length === 0) {
        showToast('Seçili kriterlere uygun veri bulunamadı.', 'error');
        return;
    }

    const totalAmount = filtered.reduce((sum, e) => sum + parseFloat(e.tutar || 0), 0);

    let rowsHtml = filtered.map((e, index) => `
        <tr>
            <td style="text-align:center">${index + 1}</td>
            <td>${e.ay}</td>
            <td>${e.tarih}</td>
            <td>${e.kategori}</td>
            <td>${e.aciklama}</td>
            <td style="text-align:right; font-weight:600">${e.tutar.toLocaleString('tr-TR')} ₺</td>
        </tr>
    `).join('');

    const content = `
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: sans-serif; padding: 20px; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
                th { background-color: #f2f2f2; font-weight: bold; }
                h2 { text-align: center; margin-bottom: 5px; }
                .meta { text-align: center; font-size: 11px; color: #666; margin-bottom: 20px; }
                .total-row { background-color: #f9f9f9; font-weight: bold; font-size: 13px; }
                @media print { 
                    @page { margin: 1cm; } 
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h2>${title}</h2>
            <div class="meta">Oluşturma Tarihi: ${new Date().toLocaleString('tr-TR')}</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:30px">#</th>
                        <th style="width:80px">Ay</th>
                        <th style="width:80px">Tarih</th>
                        <th style="width:100px">Kategori</th>
                        <th>Açıklama</th>
                        <th style="width:100px; text-align:right">Tutar</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                    <tr class="total-row">
                        <td colspan="5" style="text-align:right">GENEL TOPLAM:</td>
                        <td style="text-align:right">${totalAmount.toLocaleString('tr-TR')} ₺</td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
    `;

    safePrintContent(content);
    showToast('Yazdırma penceresi hazırlanıyor...', 'success');
}

// ---------- UI Interaction ----------
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-page') === page);
    });
    const titleMap = { dashboard: 'Gösterge Paneli', ogrenciler: 'Öğrenciler', matris: 'Tüm Aylar Matrisi', hesap: 'Banka Ekstresi', eslestir: 'Dekont Eşleştirme', rapor: 'Ay Bazlı Rapor', beklenen: 'Ödeme Beklenen', kardesler: 'Kardeş Listesi', ayarlar: 'Ayarlar', kilavuz: 'Kullanım Kılavuzu', giderler: 'Gider Takibi', 'ogrenci-detay': 'Öğrenci Detayı' };
    const subMap = { dashboard: 'Genel özet ve istatistikler', ogrenciler: 'Öğrenci listesi ve işlemler', matris: 'Ödeme matrisi', hesap: 'Banka ekstre yönetimi', eslestir: 'Dekont eşleştirme', rapor: 'Aylara göre raporlar', beklenen: 'Ödeme bekleyen öğrenciler', kardesler: 'Kardeş ilişkileri', ayarlar: 'Uygulama ayarları', kilavuz: 'Sistem nasıl kullanılır?', giderler: 'Aylık harcama ve gider yönetimi', 'ogrenci-detay': 'Öğrenci ödeme geçmişi ve detayları' };
    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-sub');
    if (titleEl) titleEl.innerText = titleMap[page] || '';
    if (subEl) subEl.innerText = subMap[page] || '';
    // Modal ve yükleme engellerini temizle (CSS sınıfları üzerinden)
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.loading-overlay').forEach(l => l.classList.remove('active'));
    
    // Inline style çakışmalarını temizle
    document.querySelectorAll('.modal-overlay, .loading-overlay').forEach(el => {
        el.style.display = ''; 
    });

    if (page === 'ogrenciler') renderStudentTable();
    if (page === 'hesap') renderStatementsTable();
    if (page === 'eslestir') renderMatches();
    if (page === 'matris') renderMatrix();
    if (page === 'kardesler') renderSiblingList();
    if (page === 'rapor') renderRapor();
    if (page === 'beklenen') renderExpectedPayments();
    if (page === 'giderler') renderExpenses();
    if (page === 'ayarlar') {
        setTimeout(loadSettings, 100); 
    }
    if (page === 'dashboard') {
        renderDashboardStats();
        renderDashboardUnpaid();
    }
    
    hideLoading();
}

function showTab(section, tab, ev) {
    const parent = ev.target.closest('.card, .modal-body, .page');
    if (!parent) return;
    parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    ev.target.classList.add('active');

    parent.querySelectorAll('.tab-content').forEach(c => {
        if (c.id.includes(section)) c.classList.remove('active');
    });
    const targetId = `tab${section}${tab}`;
    const targetContent = document.getElementById(targetId);
    if (targetContent) targetContent.classList.add('active');
}

function closeModal(id) {
    console.log('[MODAL] Kapatma isteği:', id);
    const m = document.getElementById(id);
    if (m) {
        m.classList.remove('open');
    } else {
        console.error('[MODAL] Kapatılamadı, ID bulunamadı:', id);
    }
}

// ---------- Onboarding / Tour ----------
let currentOnboardingStep = 0;

function checkOnboarding() {
    // Sadece öğrencisi olmayan ve aidat belirlememiş ilk kurulumlar için çalışsın
    const hasFees = currentSettings.ucret_sabahci || currentSettings.ucret_tam_gun || currentSettings.ucret_sabahci_2 || currentSettings.ucret_tam_gun_2;
    const hasStudents = allStudents && allStudents.length > 0;
    
    if (!hasFees && !hasStudents) {
        startOnboarding();
    }
}

function startOnboarding() {
    currentOnboardingStep = 1;
    showPage('ayarlar');
    
    setTimeout(() => {
        const feesContainer = document.getElementById('onboarding-fees-container');
        if (feesContainer) {
            feesContainer.classList.add('onboarding-highlight');
            showOnboardingTooltip(feesContainer, '👋 Sisteme hoş geldiniz!<br><br>İlk olarak 1. Dönem ve 2. Dönem aidat ücretlerini belirleyin. İşiniz bitince aşağıdaki <b>"Ayarları Kaydet"</b> butonuna basmayı unutmayın.', 'bottom', false);
            
            const saveBtn = document.getElementById('save-settings-btn');
            if (saveBtn) {
                saveBtn.style.position = 'relative';
                saveBtn.style.zIndex = '100000';
            }
        }
    }, 500);
}

window.advanceOnboarding = function() {
    if (currentOnboardingStep === 1) {
        // Step 1 done
        const feesContainer = document.getElementById('onboarding-fees-container');
        if (feesContainer) feesContainer.classList.remove('onboarding-highlight');
        
        const saveBtn = document.getElementById('save-settings-btn');
        if (saveBtn) {
            saveBtn.style.zIndex = '';
        }
        
        removeOnboardingTooltip();
        
        // Go to step 2
        currentOnboardingStep = 2;
        showPage('ogrenciler');
        
        setTimeout(() => {
            const addBtn = document.querySelector('button[onclick="app.showImportStudents()"]') || document.querySelector('#page-ogrenciler .btn-primary');
            if (addBtn) {
                addBtn.classList.add('onboarding-highlight');
                showOnboardingTooltip(addBtn, 'Harika! 🎉 Aidat ayarlarınız kaydedildi.<br><br>Şimdi <b>"Öğrenci Ekle"</b> butonuna tıklayarak yeni bir öğrenci ekleyebilir veya toplu liste aktarabilirsiniz.', 'bottom');
            }
        }, 500);
    } else if (currentOnboardingStep === 2) {
        // Step 2 done
        const addBtn = document.querySelector('button[onclick="app.showImportStudents()"]') || document.querySelector('#page-ogrenciler .btn-primary');
        if (addBtn) addBtn.classList.remove('onboarding-highlight');
        removeOnboardingTooltip();
        currentOnboardingStep = 0; // finished
    }
};

function showOnboardingTooltip(element, text, position, showButton = true) {
    removeOnboardingTooltip();
    const tooltip = document.createElement('div');
    tooltip.id = 'onboarding-tooltip';
    
    let btnHtml = '';
    if (showButton) {
        btnHtml = `<button onclick="window.advanceOnboarding()" class="btn btn-primary" style="margin-top: 15px; width: 100%; font-size: 13px; padding: 10px; font-weight: bold;">Tamam, Anladım</button>`;
    }
    
    tooltip.innerHTML = `
        <p style="margin: 0; font-size: 14px; font-weight: 500; line-height: 1.5;">${text}</p>
        ${btnHtml}
    `;
    tooltip.style.cssText = `
        position: absolute;
        z-index: 100002;
        background: var(--surface);
        border: 2px solid var(--accent);
        padding: 20px;
        border-radius: 12px;
        color: var(--text);
        width: 320px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        pointer-events: auto;
    `;
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    if (position === 'bottom') {
        tooltip.style.top = (rect.bottom + window.scrollY + 15) + 'px';
        tooltip.style.left = (rect.left + window.scrollX) + 'px';
        
        if (rect.left + 320 > window.innerWidth) {
            tooltip.style.left = (window.innerWidth - 340) + 'px';
        }
    }
}

function removeOnboardingTooltip() {
    const existing = document.getElementById('onboarding-tooltip');
    if (existing) existing.remove();
}


function checkKVKK() {
    const accepted = localStorage.getItem('kvkk_accepted');
    const modal = document.getElementById('kvkk-modal');
    if (!accepted && modal) {
        modal.classList.add('open');
        const body = document.getElementById('kvkk-body');
        const btn = document.getElementById('kvkk-accept-btn');
        const info = document.getElementById('kvkk-scroll-info');

        const checkScroll = () => {
            const isAtBottom = Math.ceil(body.scrollTop + body.clientHeight) >= body.scrollHeight - 10;
            const isNotScrollable = body.scrollHeight <= body.clientHeight;
            
            if (isAtBottom || isNotScrollable) {
                btn.disabled = false;
                if (info) info.style.display = 'none';
            }
        };

        body.onscroll = checkScroll;
        // Initial check in case it's already at bottom or not scrollable
        setTimeout(checkScroll, 100);
    } else if (modal) {
        modal.classList.remove('open');
    }
}

function acceptKVKK() {
    localStorage.setItem('kvkk_accepted', 'true');
    const modal = document.getElementById('kvkk-modal');
    if (modal) modal.classList.remove('open');
    showToast('KVKK şartlarını kabul ettiniz.', 'success');
}

function openModal(id) {
    console.log('[MODAL] Açma isteği:', id);
    const m = document.getElementById(id);
    if (m) {
        m.classList.add('open');
        console.log('[MODAL] Açıldı:', id);
    } else {
        console.error('[MODAL] Açılamadı, ID bulunamadı:', id);
    }
}

function showAddPayment() {
    const m = document.getElementById('add-payment-modal');
    if (m) {
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

function showAddPaymentWithData(s) {
    showAddPayment();
    // Fill the fields
    const ay = getMonthName(s.tarih);
    const m = document.getElementById('new-ay');
    if (m) m.value = ay;
    
    const t = document.getElementById('new-tarih');
    if (t) {
        // DD.MM.YYYY -> YYYY-MM-DD
        const parts = s.tarih.split('.');
        if (parts.length === 3) t.value = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    
    const d = document.getElementById('new-dekont');
    if (d) d.value = s.kod;
    
    const tutar = document.getElementById('new-tutar');
    if (tutar) tutar.value = s.tutar;
}

async function addPayment() {
    const tc = document.getElementById('new-ogrenci').value;
    const ay = document.getElementById('new-ay').value;
    const tur = document.getElementById('new-tur').value;
    const tarih = document.getElementById('new-tarih').value;
    const dekont = document.getElementById('new-dekont').value;
    const tutar = document.getElementById('new-tutar').value;
    const notlar = document.getElementById('new-notlar').value;

    if (!tc || !ay) {
        showToast('Lütfen Öğrenci ve Ay seçin.', 'error');
        return;
    }

    // YYYY-MM-DD -> DD.MM.YYYY
    let formattedTarih = tarih;
    if (tarih && tarih.includes('-')) {
        const parts = tarih.split('-');
        formattedTarih = `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    const student = allStudents.find(s => s.tc === tc);
    const ad_soyad = student ? `${student.ad} ${student.soyad}` : '';

    try {
        console.log('[APP-ADD-PAYMENT] Sending:', { tc, ay, tarih: formattedTarih, dekont, tutar, ad_soyad, tur });
        const res = await fetch('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tc, ay, tarih: formattedTarih, dekont, tutar: Number(tutar) || 0, ad_soyad, tur, notlar })
        });

        if (res.ok) {
            const data = await res.json();
            showToast(data.message || 'İşlem başarıyla tamamlandı.', 'success');
            closeModal('add-payment-modal');
            await loadData();
        } else {
            const errorData = await res.json().catch(() => ({}));

            // Eğer dekont zaten varsa soralım
            if (res.status === 409 && errorData.error === 'exists') {
                if (confirm(`${errorData.message}\n${errorData.details}\n\nBu kaydı güncellemek ister misiniz?`)) {
                    // Force true ile tekrar gönder
                    const forceRes = await fetch('/api/payments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tc, ay, tarih: formattedTarih, dekont, tutar: Number(tutar) || 0, ad_soyad, tur, notlar, force: true })
                    });
                    if (forceRes.ok) {
                        showToast('Kayıt zorlanarak güncellendi.', 'success');
                        closeModal('add-payment-modal');
                        await loadData();
                    } else {
                        showToast('Güncelleme sırasında hata oluştu.', 'error');
                    }
                    return;
                }
            } else {
                showToast(`Ödeme eklenemedi: ${errorData.message || errorData.error || 'Server Hatası'}`, 'error');
            }
        }
    } catch (e) {
        console.error('[APP-ADD-PAYMENT-NETWORK-ERROR]', e);
        showToast('Hata oluştu. İnternet bağlantınızı kontrol edin.', 'error');
    }
}

function showEditPayment(id) {
    const p = allPayments.find(pay => pay.id === id);
    if (!p) return;

    const m = document.getElementById('edit-payment-modal');
    if (!m) return;

    // Populate students list in edit modal
    const sel = document.getElementById('edit-payment-ogrenci');
    sel.innerHTML = '';
    allStudents.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.tc;
        opt.textContent = `${s.ad} ${s.soyad}`;
        if (s.tc === p.tc) opt.selected = true;
        sel.appendChild(opt);
    });

    document.getElementById('edit-payment-id').value = p.id;
    document.getElementById('edit-payment-ay').value = p.ay;
    document.getElementById('edit-payment-tur').value = p.tur || 'Ödeme';

    // Tarih formatı dönüşümü (DD.MM.YYYY -> YYYY-MM-DD)
    if (p.tarih && p.tarih.includes('.')) {
        const parts = p.tarih.split('.');
        if (parts.length === 3) {
            document.getElementById('edit-payment-tarih').value = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    } else {
        document.getElementById('edit-payment-tarih').value = p.tarih;
    }

    document.getElementById('edit-payment-dekont').value = p.dekont || '';
    document.getElementById('edit-payment-tutar').value = p.tutar || 0;
    document.getElementById('edit-payment-notlar').value = p.notlar || '';

    m.classList.add('open');
}

async function updatePayment() {
    const id = document.getElementById('edit-payment-id').value;
    const tc = document.getElementById('edit-payment-ogrenci').value;
    const ay = document.getElementById('edit-payment-ay').value;
    const tur = document.getElementById('edit-payment-tur').value;
    let tarih = document.getElementById('edit-payment-tarih').value;
    const dekont = document.getElementById('edit-payment-dekont').value;
    const tutar = document.getElementById('edit-payment-tutar').value;
    const notlar = document.getElementById('edit-payment-notlar').value;

    // YYYY-MM-DD -> DD.MM.YYYY
    if (tarih && tarih.includes('-')) {
        const parts = tarih.split('-');
        tarih = `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    const student = allStudents.find(s => s.tc === tc);
    const ad_soyad = student ? `${student.ad} ${student.soyad}` : '';

    try {
        const res = await fetch(`/api/payments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tc, ay, tarih, dekont, tutar: Number(tutar) || 0, ad_soyad, tur, notlar })
        });

        if (res.ok) {
            showToast('Ödeme güncellendi.', 'success');
            closeModal('edit-payment-modal');
            await loadData();
        } else {
            const err = await res.json();
            showToast('Güncellenemedi: ' + (err.error || 'Hata'), 'error');
        }
    } catch (e) {
        showToast('Hata oluştu.', 'error');
    }
}

async function deletePayment(id) {
    showDangerModal('Bu ödeme kaydı silinecek. Emin misiniz?', async () => {
        try {
            const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Ödeme silindi.', 'success');
                await loadData();
            } else {
                showToast('Silinemedi.', 'error');
            }
        } catch (e) {
            showToast('Hata oluştu.', 'error');
        }
    });
}

function showImportStudents() {
    if (typeof window.advanceOnboarding === 'function' && currentOnboardingStep === 2) {
        window.advanceOnboarding();
    }

    // KVKK Check
    const kvkkAccepted = localStorage.getItem('kvkk_accepted');
    if (!kvkkAccepted) {
        showToast('Lütfen önce KVKK şartlarını kabul edin.', 'error');
        checkKVKK();
        return;
    }

    // Robust guard against automatic opening during startup
    if (!appReady) {
        console.warn('[APP] showImportStudents engellendi: Uygulama henüz hazır değil.');
        return;
    }
    
    console.log('[APP] showImportStudents çağrıldı.');
    const m = document.getElementById('add-student-modal');
    if (m) {
        m.classList.add('open');
        // Toplu tabını seçelim
        const bulkBtn = m.querySelector('.tab-btn[onclick*="bulk"]');
        if (bulkBtn) {
            // Slight delay to ensure DOM is ready for click
            setTimeout(() => bulkBtn.click(), 50);
        }
    }
}

async function addStudent() {
    const tc = document.getElementById('ns-tc').value;
    const ad = document.getElementById('ns-ad').value;
    const soyad = document.getElementById('ns-soyad').value;
    const sira = document.getElementById('ns-sira').value;
    const anne = document.getElementById('ns-anne').value;
    const baba = document.getElementById('ns-baba').value;
    const egitim = document.getElementById('ns-egitim').value;
    const giris = document.getElementById('ns-giris').value;
    const cikis = document.getElementById('ns-cikis').value;

    if (!tc || !ad || !soyad) {
        showToast('Lütfen TC, Ad ve Soyad girin.', 'error');
        return;
    }
    try {
        const res = await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tc, ad, soyad, sira, anne_adi: anne, baba_adi: baba, egitim_turu: egitim, giris_tarihi: giris, cikis_tarihi: cikis })
        });
        if (res.ok) {
            showToast('Öğrenci başarıyla eklendi.', 'success');
            closeModal('add-student-modal');
            await loadData();
        } else {
            const err = await res.json().catch(() => ({}));
            showToast(err.message || 'Öğrenci eklenemedi.', 'error');
        }
    } catch (e) {
        showToast('Hata oluştu: ' + e.message, 'error');
    }
}

function showEditStudent(tc) {
    const st = allStudents.find(s => s.tc === tc);
    if (!st) return;

    document.getElementById('edit-old-tc').value = st.tc;
    document.getElementById('edit-tc').value = st.tc;
    document.getElementById('edit-sira').value = st.sira || '';
    document.getElementById('edit-no').value = st.no || '';
    document.getElementById('edit-sinif').value = st.sinif || '';
    document.getElementById('edit-ad').value = st.ad || '';
    document.getElementById('edit-soyad').value = st.soyad || '';
    document.getElementById('edit-anne').value = st.anne_adi || '';
    document.getElementById('edit-baba').value = st.baba_adi || '';
    document.getElementById('edit-egitim').value = st.egitim_turu || 'TAM GÜN';
    document.getElementById('edit-giris').value = st.giris_tarihi || '';
    document.getElementById('edit-cikis').value = st.cikis_tarihi || '';

    document.getElementById('edit-student-modal').classList.add('open');
}

async function updateStudent() {
    const oldTc = document.getElementById('edit-old-tc').value;
    const tc = document.getElementById('edit-tc').value;
    const no = document.getElementById('edit-no').value;
    const sinif = document.getElementById('edit-sinif').value;
    const ad = document.getElementById('edit-ad').value;
    const soyad = document.getElementById('edit-soyad').value;
    const anne = document.getElementById('edit-anne').value;
    const baba = document.getElementById('edit-baba').value;
    const egitim = document.getElementById('edit-egitim').value;
    const giris = document.getElementById('edit-giris').value;
    const cikis = document.getElementById('edit-cikis').value;
    const sira = document.getElementById('edit-sira').value;

    if (!tc || !ad || !soyad) {
        showToast('Lütfen TC, Ad ve Soyad girin.', 'error');
        return;
    }

    try {
        const res = await fetch(`/api/students/update_student`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldTc, tc, ad, soyad, sira, no, sinif, anne_adi: anne, baba_adi: baba, egitim_turu: egitim, giris_tarihi: giris, cikis_tarihi: cikis })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Öğrenci başarıyla güncellendi.', 'success');
            closeModal('edit-student-modal');
            await loadData();
        } else {
            showToast(data.error || 'Güncelleme başarısız.', 'error');
        }
    } catch (e) {
        showToast('Hata oluştu: ' + e.message, 'error');
    }
}

async function importStudents() {
    if (window.ImportHandler) {
        await window.ImportHandler.start('students');
        closeModal('add-student-modal');
    } else {
        showToast('Aktarım sistemi başlatılamadı.', 'error');
    }
}

function downloadStudentTemplate() {
    try {
        if (typeof XLSX === 'undefined') {
            console.error('XLSX library not found');
            showToast('Excel kütüphanesi yüklenemedi. Lütfen internet bağlantınızı kontrol edin veya programı yeniden başlatın.', 'error');
            return;
        }
        const ws = XLSX.utils.aoa_to_sheet([
            ["Sira", "Numara", "Ad", "Soyad", "TC", "Sınıf", "Anne Adi", "Baba Adi", "Ogrenim Sekli", "Giris Tarihi", "Cikis Tarihi"],
            [1, "101", "Ali", "Yılmaz", "12345678901", "1/A", "Ayşe", "Mehmet", "TAM GÜN", "2023-09-01", ""],
            [2, "102", "Ayşe", "Kaya", "98765432101", "1/B", "Fatma", "Ali", "SABAHÇI", "2023-09-01", ""]
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ogrenciler");
        XLSX.writeFile(wb, "Ogrenci_Sablonu.xlsx");
        showToast('Şablon indirildi.', 'success');
    } catch (e) {
        console.error('Şablon indirme hatası:', e);
        showToast('Şablon oluşturulurken bir hata oluştu: ' + e.message, 'error');
    }
}

async function uploadStatement() {
    if (allStudents.length === 0) {
        showToast('Banka ekstresi yüklemeden önce öğrenci eklemelisiniz.', 'error');
        return;
    }
    if (window.ImportHandler) {
        window.autoSaveMatchesActive = true;
        await window.ImportHandler.start('statements');
    } else {
        showToast('Aktarım sistemi başlatılamadı.', 'error');
    }
}

async function processPastedData() {
    if (allStudents.length === 0) {
        showToast('Banka ekstresi yüklemeden önce öğrenci eklemelisiniz.', 'error');
        return;
    }
    const text = document.getElementById('paste-area').value;
    if (!text.trim()) return;

    const lines = text.split('\n');
    const items = [];

    lines.forEach(line => {
        const parts = line.split('\t');
        if (parts.length >= 4) {
            items.push({
                tarih: parts[0].trim(),
                kod: parts[1].trim(),
                aciklama: parts[2].trim(),
                tutar: parts[3].trim()
            });
        }
    });

    if (items.length === 0) {
        showToast('Geçerli veri bulunamadı.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/statements/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });
        if (res.ok) {
            showToast('Veriler kaydedildi.', 'success');
            document.getElementById('paste-area').value = '';
            window.autoSaveMatchesActive = true;
            await loadData();
            renderStatementsTable();
        }
    } catch (e) {
        showToast('Hata oluştu.', 'error');
    }
}

async function clearStatements() {
    const month = document.getElementById('clear-statement-month').value;
    const msg = month === 'all'
        ? '<b>TÜM</b> ekstre verilerini kalıcı olarak silmek istediğinize emin misiniz?'
        : `<b>${month}. ay</b> ekstre verilerini silmek istediğinize emin misiniz?`;

    showDangerModal(msg, async () => {
        try {
            const url = month === 'all' ? '/api/statements' : `/api/statements?month=${month}`;
            const res = await fetch(url, { method: 'DELETE' });
            if (res.ok) {
                showToast('Ekstreler temizlendi.', 'success');
                await loadData();
                renderStatementsTable();
            }
        } catch (e) {
            console.error(e);
            showToast('Ekstre silme sırasında hata oluştu.', 'error');
        }
    });
}



function getMonthName(dateStr) {
    if (!dateStr) return 'BİLİNMİYOR';
    const parts = dateStr.split(/[./-]/);
    if (parts.length >= 2) {
        const m = parts[1];
        const names = { '01': 'OCAK', '02': 'ŞUBAT', '03': 'MART', '04': 'NİSAN', '05': 'MAYIS', '06': 'HAZİRAN', '07': 'TEMMUZ', '08': 'AĞUSTOS', '09': 'EYLÜL', '10': 'EKİM', '11': 'KASIM', '12': 'ARALIK' };
        return names[m] || 'BİLİNMİYOR';
    }
    return 'BİLİNMİYOR';
}

function showLoading(text) {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    if (overlay) {
        if (text) loadingText.innerText = text;
        overlay.style.display = 'flex';
        // Fail-safe: allow dismissing stuck overlay by clicking it
        overlay.onclick = () => hideLoading();
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.onclick = null;
    }
}

function simplifyString(str) {
    if (!str) return '';
    return str.toLocaleUpperCase('tr-TR')
        .replace(/İ/g, 'I')
        .replace(/Ğ/g, 'G')
        .replace(/Ü/g, 'U')
        .replace(/Ş/g, 'S')
        .replace(/Ö/g, 'O')
        .replace(/Ç/g, 'C')
        .replace(/I/g, 'I')
        .replace(/[^A-Z0-9]/g, '');
}

async function renderMatches() {
    const tbody = document.getElementById('match-table');
    const tbodyExp = document.getElementById('match-expense-table');
    const tbodyUnmatched = document.getElementById('matchunmatchedtable');
    const countEl = document.getElementById('match-count');
    const countElExp = document.getElementById('match-expense-count');
    const countElUnmatched = document.getElementById('matchunmatchedcount');
    const monthFilter = document.getElementById('match-month-filter') ? document.getElementById('match-month-filter').value : 'all';
    const unmatchedMonthFilter = document.getElementById('match-unmatched-month-filter')?.value || 'all';
    const unmatchedSearch = (document.getElementById('match-unmatched-search')?.value || '').toLocaleUpperCase('tr-TR');

    if (!tbody || !tbodyExp) return;

    showLoading('Eşleştirmeler hesaplanıyor, lütfen bekleyin...');
    // Allow UI to render the overlay
    await new Promise(r => setTimeout(r, 50));

    try {
        const existingDekonts = new Set(allPayments.map(p => (p.dekont || '').trim()));
        const existingExpenseDekonts = new Set(allExpenses.map(e => (e.dekont || '').trim()));

        pendingMatches = [];
        pendingExpenses = [];
        const unmatchedIncome = [];

        // Pre-calculate normalized student data to speed up loop
        const normalizedStudents = allStudents.map(st => {
            const ad = (st.ad || '').trim();
            const soyad = (st.soyad || '').trim();
            return {
                ...st,
                simpleName: simplifyString(ad + soyad),
                simpleAd: simplifyString(ad),
                simpleSoyad: simplifyString(soyad),
                upperAnne: (st.anne_adi || '').toLocaleUpperCase('tr-TR'),
                upperBaba: (st.baba_adi || '').toLocaleUpperCase('tr-TR'),
                simpleAnne: simplifyString(st.anne_adi),
                simpleBaba: simplifyString(st.baba_adi),
                cleanTc: (st.tc || '').replace(/\D/g, '')
            };
        });

        allStatements.forEach(s => {
            const parts = (s.tarih || '').split(/[./-]/);
            const sMonth = (parts.length >= 2) ? parts[1] : null;

            if (s.tur === 'Gelir') {
                const sKod = (s.kod || '').trim();
                if (sKod !== '' && existingDekonts.has(sKod)) return;

                const desc = (s.aciklama || '').toLocaleUpperCase('tr-TR');
                const simpleDesc = simplifyString(s.aciklama);
                let matchedStudent = null;

                for (let st of normalizedStudents) {
                    // 1. TC No ile tam eşleşme (en güvenilir)
                    if (st.cleanTc.length > 8 && simpleDesc.includes(st.cleanTc)) {
                        matchedStudent = st;
                        break;
                    }

                    // 2. Ad Soyad (Boşluksuz/Karaktersiz) eşleşme
                    if (st.simpleName.length > 5 && simpleDesc.includes(st.simpleName)) {
                        matchedStudent = st;
                        break;
                    }

                    // 3. Soyad + Ad (Ters sıra) eşleşme
                    const reverseName = st.simpleSoyad + st.simpleAd;
                    if (st.simpleSoyad.length > 2 && st.simpleAd.length > 2 && simpleDesc.includes(reverseName)) {
                        matchedStudent = st;
                        break;
                    }

                    // 4. Veli adı + Soyadı eşleşme
                    if (st.simpleSoyad.length > 3) {
                        if (st.simpleAnne.length > 3 && simpleDesc.includes(st.simpleAnne) && simpleDesc.includes(st.simpleSoyad)) {
                            matchedStudent = st;
                            break;
                        }
                        if (st.simpleBaba.length > 3 && simpleDesc.includes(st.simpleBaba) && simpleDesc.includes(st.simpleSoyad)) {
                            matchedStudent = st;
                            break;
                        }
                    }
                }

                if (matchedStudent) {
                    // Global filtreye uyuyorsa ekle
                    if (monthFilter === 'all' || sMonth === monthFilter) {
                        pendingMatches.push({ statement: s, student: matchedStudent });
                    }
                } else {
                    // Unmatched filtreye uyuyorsa ekle
                    if (unmatchedMonthFilter === 'all' || sMonth === unmatchedMonthFilter) {
                        unmatchedIncome.push(s);
                    }
                }
            } else if (s.tur === 'Gider') {
                const sKod = (s.kod || '').trim();
                if (sKod !== '' && existingExpenseDekonts.has(sKod)) return;
                
                // Global filtreye uyuyorsa ekle
                if (monthFilter === 'all' || sMonth === monthFilter) {
                    pendingExpenses.push(s);
                }
            }
        });

        // Otomatik kayıt modundaysak burada render işlemini atla
        if (window.autoSaveMatchesActive) {
            return;
        }

        // Render Students
        tbody.innerHTML = '';
        if (countEl) countEl.innerText = `${pendingMatches.length} Eşleşme`;
        pendingMatches.forEach((m, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td>${m.student.ad} ${m.student.soyad}</td>
                <td>${m.student.tc || '-'}</td>
                <td>${m.statement.tarih}</td>
                <td><span class="code-badge">${m.statement.kod}</span></td>
                <td class="amount positive">${m.statement.tutar} ₺</td>
            `;
            tbody.appendChild(tr);
        });

        // Render Expenses
        tbodyExp.innerHTML = '';
        if (countElExp) countElExp.innerText = `${pendingExpenses.length} İşlem`;
        pendingExpenses.forEach((s, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td>${s.tarih}</td>
                <td style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${s.aciklama}">${s.aciklama}</td>
                <td><span class="code-badge">${s.kod}</span></td>
                <td class="amount negative">${s.tutar} ₺</td>
                <td>
                    <button class="btn btn-primary" style="padding:4px 8px; font-size:11px" onclick="app.saveStatementAsExpense(${JSON.stringify(s).replace(/"/g, '&quot;')})">Gider Kaydet</button>
                </td>
            `;
            tbodyExp.appendChild(tr);
        });

        // Render Unmatched Income
        if (tbodyUnmatched) {
            tbodyUnmatched.innerHTML = '';
            
            let filteredUnmatched = unmatchedIncome;
            if (unmatchedSearch) {
                filteredUnmatched = unmatchedIncome.filter(s => 
                    (s.aciklama || '').toLocaleUpperCase('tr-TR').includes(unmatchedSearch) ||
                    (s.kod || '').toLocaleUpperCase('tr-TR').includes(unmatchedSearch) ||
                    (s.tarih || '').includes(unmatchedSearch)
                );
            }

            if (countElUnmatched) countElUnmatched.innerText = `${filteredUnmatched.length} İşlem`;
            filteredUnmatched.forEach((s, idx) => {
                const tr = document.createElement('tr');
                tr.style.background = 'rgba(56, 139, 253, 0.08)';
                tr.innerHTML = `
                    <td>${idx + 1}</td>
                    <td>${s.tarih}</td>
                    <td style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${s.aciklama}">${s.aciklama}</td>
                    <td><span class="code-badge">${s.kod}</span></td>
                    <td class="amount positive">${s.tutar} ₺</td>
                    <td>
                        <button class="btn" style="padding:4px 8px; font-size:11px; background:var(--accent); color:white" onclick="app.showAddPaymentWithData(${JSON.stringify(s).replace(/"/g, '&quot;')})">Manuel Ekle</button>
                    </td>
                `;
                tbodyUnmatched.appendChild(tr);
            });
        }
    } catch (e) {
        console.error('[RENDER-MATCHES-ERROR]', e);
        showToast('Eşleştirmeler hesaplanırken hata oluştu.', 'error');
    } finally {
        hideLoading();
    }
}

async function saveMatchesAsPayments() {
    if (pendingMatches.length === 0) {
        showToast('Kaydedilecek eşleşme yok.', 'info');
        return;
    }
    if (!confirm(`${pendingMatches.length} adet otomatik eşleşme sisteme ödeme olarak kaydedilecek. Emin misiniz?`)) return;

    const payload = pendingMatches.map(m => ({
        ay: getMonthName(m.statement.tarih),
        tc: m.student.tc,
        ad_soyad: `${m.student.ad} ${m.student.soyad}`,
        tarih: m.statement.tarih,
        dekont: m.statement.kod,
        tutar: m.statement.tutar
    }));

    try {
        const res = await fetch('/api/payments/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payments: payload })
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message || `${data.count} ödeme başarıyla kaydedildi.`, 'success');
        } else {
            showToast(data.error || 'Kaydedilirken hata oluştu.', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Sunucu bağlantı hatası.', 'error');
    }

    await loadData();
    renderMatches();
}

async function saveStatementAsExpense(s) {
    if (!confirm('Bu işlemi gider olarak kaydetmek istiyor musunuz?')) return;

    const ay = getMonthName(s.tarih);
    const payload = {
        ay,
        aciklama: s.aciklama,
        tarih: s.tarih,
        dekont: s.kod,
        tutar: Math.abs(s.tutar),
        kategori: 'Banka'
    };

    try {
        const res = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showToast('Gider kaydedildi.', 'success');
            await loadData();
        }
    } catch (e) {
        showToast('Hata oluştu.', 'error');
    }
    renderMatches();
}

async function saveAllStatementExpenses() {
    if (pendingExpenses.length === 0) {
        showToast('Kaydedilecek gider bulunamadı.', 'info');
        return;
    }

    if (!confirm(`${pendingExpenses.length} adet gider kaydı oluşturulacak. Onaylıyor musunuz?`)) return;

    const expensesToSave = pendingExpenses.map(s => ({
        ay: getMonthName(s.tarih),
        aciklama: s.aciklama,
        tarih: s.tarih,
        dekont: s.kod,
        tutar: Math.abs(s.tutar),
        kategori: 'Banka'
    }));

    try {
        const res = await fetch('/api/expenses/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expenses: expensesToSave })
        });
        const result = await res.json();
        if (result.success) {
            showToast(result.message, 'success');
            await loadData();
            renderMatches();
        } else {
            showToast('Hata: ' + (result.error || 'Bilinmeyen hata'), 'error');
        }
    } catch (e) {
        showToast('Hata: ' + e.message, 'error');
    }
}

function filterStudents() { renderStudentTable(); }
function filterHesap() { renderStatementsTable(); }
let matrixSearchTimeout = null;
function filterMatrix() {
    if (matrixSearchTimeout) clearTimeout(matrixSearchTimeout);
    matrixSearchTimeout = setTimeout(() => {
        renderMatrix();
    }, 300);
}
function bulkDeleteStudents() { deleteSelectedStudents(); }
function exportCurrentPage() { showToast('Dışa aktarım yapılıyor...', 'info'); }

function safePrintContent(content) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-9999px';
    document.body.appendChild(iframe);

    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(content);
    iframe.contentWindow.document.close();

    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 500);
    }, 250);
}

function exportMatchesExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('XLSX kütüphanesi bulunamadı.', 'error');
        return;
    }
    if (!pendingMatches || pendingMatches.length === 0) {
        showToast('Dışa aktarılacak eşleşme bulunamadı.', 'info');
        return;
    }
    const data = pendingMatches.map((m, idx) => ({
        'Sıra': idx + 1,
        'Ad Soyad': `${m.student.ad} ${m.student.soyad}`,
        'TC No': m.student.tc || '-',
        'İşlem Tarihi': m.statement.tarih,
        'Dekont No': m.statement.kod,
        'Ödenen Miktar': m.statement.tutar + ' ₺'
    }));
    try {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Eslesmeler");
        XLSX.writeFile(wb, `Otomatik_Eslesmeler_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
        showToast('Excel dosyası indirildi.', 'success');
    } catch (e) {
        showToast('Excel oluşturulurken bir hata oluştu: ' + e.message, 'error');
    }
}

function exportMatchesPDF() {
    if (!pendingMatches || pendingMatches.length === 0) {
        showToast('Yazdırılacak eşleşme bulunamadı.', 'info');
        return;
    }

    const title = `OTOMATİK DEKONT EŞLEŞMELERİ - ${new Date().toLocaleDateString('tr-TR')}`;
    let rowsHtml = pendingMatches.map((m, idx) => `
        <tr>
            <td style="text-align:center">${idx + 1}</td>
            <td>${m.student.ad} ${m.student.soyad}</td>
            <td>${m.student.tc || '-'}</td>
            <td>${m.statement.tarih}</td>
            <td>${m.statement.kod}</td>
            <td style="text-align:right; font-weight:600">${m.statement.tutar.toLocaleString('tr-TR')} ₺</td>
        </tr>
    `).join('');

    const content = `
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: sans-serif; padding: 20px; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
                th { background-color: #f2f2f2; font-weight: bold; }
                h2 { text-align: center; margin-bottom: 20px; }
                @media print { @page { margin: 1cm; } body { margin: 0; } }
            </style>
        </head>
        <body>
            <h2>${title}</h2>
            <table>
                <thead>
                    <tr>
                        <th style="width:30px">#</th>
                        <th>Öğrenci Ad Soyad</th>
                        <th style="width:100px">TC No</th>
                        <th style="width:80px">İşlem Tarihi</th>
                        <th style="width:100px">Dekont No</th>
                        <th style="width:100px; text-align:right">Tutar</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </body>
        </html>
    `;

    safePrintContent(content);
    showToast('Yazdırma penceresi hazırlanıyor...', 'success');
}

const origLoadData = loadData;
loadData = async function () {
    await origLoadData();
    renderStatementsTable();
    renderPaymentsTable();
    renderMatrix();
    renderSiblingList();
    renderRapor();
    renderDashboardUnpaid();
    renderExpectedPayments();
};

function togglePaymentFields() {
    // Tutar alanı her zaman görünsün istendiği için bu kısmı basitleştiriyoruz
    const fields = document.getElementById('payment-fields');
    if (fields) {
        fields.style.display = 'block';
    }
}

function getSiblingKey(s) {
    const skipNames = ['', '-', '.', 'BİLİNMİYOR', 'YOK', '0', 'X'];
    const anne = (s.anne_adi || '').trim().toLocaleUpperCase('tr-TR');
    const baba = (s.baba_adi || '').trim().toLocaleUpperCase('tr-TR');

    const anneValid = anne && !skipNames.includes(anne);
    const babaValid = baba && !skipNames.includes(baba);

    if (!anneValid && !babaValid) return null;

    // Hem anne hem baba varsa ikili anahtar, yoksa tekli anahtar
    if (anneValid && babaValid) return `A:${anne}|B:${baba}`;
    if (anneValid) return `A:${anne}`;
    return `B:${baba}`;
}

function getSiblingLogic(s) {
    const myKey = getSiblingKey(s);
    if (!myKey) return [];

    return allStudents.filter(st => {
        if (st.tc === s.tc) return false;
        return getSiblingKey(st) === myKey;
    });
}

function getMonthBoundary(monthName, startYear) {
    const map = {
        'AĞUSTOS': { y: startYear, m: 7 },
        'EYLÜL': { y: startYear, m: 8 },
        'EKİM': { y: startYear, m: 9 },
        'KASIM': { y: startYear, m: 10 },
        'ARALIK': { y: startYear, m: 11 },
        'OCAK': { y: startYear + 1, m: 0 },
        'ŞUBAT': { y: startYear + 1, m: 1 },
        'MART': { y: startYear + 1, m: 2 },
        'NİSAN': { y: startYear + 1, m: 3 },
        'MAYIS': { y: startYear + 1, m: 4 },
        'HAZİRAN': { y: startYear + 1, m: 5 },
        'TEMMUZ': { y: startYear + 1, m: 6 }
    };
    const info = map[monthName];
    if (!info) return { start: new Date(startYear, 0, 1), end: new Date(startYear, 0, 1) };

    const start = new Date(info.y, info.m, 1);
    const end = new Date(info.y, info.m + 1, 0);
    return { start, end };
}

function isStudentActiveInMonth(student, monthName, customStartYear = null) {
    if (!student.giris_tarihi && !student.cikis_tarihi) return true;

    let startYear = customStartYear;
    if (startYear === null) {
        const yearSetting = document.getElementById('settings-year');
        const yearText = yearSetting ? yearSetting.value : new Date().getFullYear() + "-" + (new Date().getFullYear() + 1);
        startYear = parseInt(yearText.split('-')[0]) || new Date().getFullYear();
    }

    const bounds = getMonthBoundary(monthName, startYear);

    if (student.giris_tarihi) {
        const giris = new Date(student.giris_tarihi);
        if (giris > bounds.end) return false;
    }

    if (student.cikis_tarihi) {
        const cikis = new Date(student.cikis_tarihi);
        if (cikis < bounds.start) return false;
    }

    return true;
}

function renderDashboardStats() {
    try {
        const selectEl = document.getElementById('dashboard-collection-month');
        const chartEl = document.getElementById('month-chart');
        if (!selectEl || !chartEl) return;

        const months = ['AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK', 'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ'];
        if (selectEl.options.length === 0) {
            months.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m; opt.textContent = m;
                selectEl.appendChild(opt);
            });
            const d = new Date();
            const monthMap = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 10, 7: 11 };
            selectEl.value = months[monthMap[d.getMonth() + 1] !== undefined ? monthMap[d.getMonth() + 1] : 0];
        }

        const selectedMonth = selectEl.value;
        const now = new Date();
        const monthMap = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 10, 7: 11 };
        const currentIdx = monthMap[now.getMonth() + 1] !== undefined ? monthMap[now.getMonth() + 1] : 10;
        const isFuture = months.indexOf(selectedMonth) > currentIdx;

        const monthPayments = allPayments.filter(p => p.ay === selectedMonth && p.tur === 'Ödeme');
        const monthExpenses = allExpenses.filter(e => e.ay === selectedMonth);

        // Handle Turkish number formatting (dots as thousand separators)
        const cleanNumber = (val) => {
            if (!val) return 0;
            let s = String(val).replace(/\./g, '').replace(',', '.');
            return parseFloat(s) || 0;
        };

        const totalCollected = monthPayments.reduce((sum, p) => sum + cleanNumber(p.tutar), 0);
        const totalExpenses = monthExpenses.reduce((sum, e) => sum + (e.tutar || 0), 0);

        if (totalCollected > 0 || totalExpenses > 0) {
            chartEl.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:15px; align-items:center">
                    <div>
                        <div style="font-size:32px; font-weight:800; color:var(--accent)">${totalCollected.toLocaleString('tr-TR')} ₺</div>
                        <div style="font-size:12px; color:var(--text3); font-weight:600">Toplam Tahsilat</div>
                    </div>
                    <div style="width:50px; height:1px; background:var(--border)"></div>
                    <div>
                        <div style="font-size:24px; font-weight:700; color:var(--danger)">${totalExpenses.toLocaleString('tr-TR')} ₺</div>
                        <div style="font-size:12px; color:var(--text3); font-weight:600">Toplam Gider</div>
                    </div>
                    <div style="margin-top:10px; font-size:14px; font-weight:700; color:var(--text)">Net Durum: <span style="color:${(totalCollected - totalExpenses) >= 0 ? 'var(--accent)' : 'var(--danger)'}">${(totalCollected - totalExpenses).toLocaleString('tr-TR')} ₺</span></div>
                </div>
            `;
        } else {
            chartEl.innerHTML = `<div style="color:var(--text3); font-style:italic; font-size:14px">${isFuture ? 'Henüz bu aya gelinmedi.' : 'Henüz veri girişi yapılmadı.'}</div>`;
        }
    } catch (e) {
        console.error("Dashboard Stats Error:", e);
        if (document.getElementById('month-chart')) {
            document.getElementById('month-chart').innerHTML = '<div style="color:var(--danger)">Veri yüklenirken hata oluştu.</div>';
        }
    }
}

function renderDashboardUnpaid() {
    const selectEl = document.getElementById('dashboard-unpaid-month');
    const listEl = document.getElementById('unpaid-list');
    if (!selectEl || !listEl) return;

    const months = ['AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK', 'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ'];
    if (selectEl.options.length === 0) {
        months.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m; opt.textContent = m;
            selectEl.appendChild(opt);
        });
        const d = new Date();
        const monthMap = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 10, 7: 11 };
        selectEl.value = months[monthMap[d.getMonth() + 1] !== undefined ? monthMap[d.getMonth() + 1] : 0];
    }

    const selectedMonth = selectEl.value;
    const now = new Date();
    const monthMap = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 10 };
    const currentIdx = monthMap[now.getMonth() + 1] !== undefined ? monthMap[now.getMonth() + 1] : 10;
    const isFuture = months.indexOf(selectedMonth) > currentIdx;

    listEl.innerHTML = '';
    if (isFuture) {
        listEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text3); font-style:italic">Gelecek ay için henüz ödeme beklenmiyor.</div>';
        return;
    }

    allStudents.forEach(s => {
        const p = getEffectivePayment(s.tc, selectedMonth);
        const expectedFee = getExpectedFee(s, selectedMonth);

        let hasPaid = !!p;
        let isRaporlu = p && (p.tur === 'Raporlu' || p.tur === 'İzinli');

        // Eğer seçili ay için ödeme yoksa ama A-S köprüsü üzerinden ödeme varsa mergedPaid true olur
        let mergedPaid = hasPaid && p.ay !== selectedMonth;

        // 1. Hiç ödemeyenler veya Kardeş durumu
        if (!hasPaid && !mergedPaid) {
            const siblings = getSiblingLogic(s);
            const siblingPaid = siblings.some(sib => {
                let sp = allPayments.some(pay => pay.tc === sib.tc && pay.ay === selectedMonth);
                if (!sp) {
                    if (selectedMonth === 'AĞUSTOS') sp = allPayments.some(pay => pay.tc === sib.tc && pay.ay === 'EYLÜL');
                    else if (selectedMonth === 'EYLÜL') sp = allPayments.some(pay => pay.tc === sib.tc && pay.ay === 'AĞUSTOS');
                }
                return sp;
            });

            const div = document.createElement('div');
            div.style.padding = '10px 14px';
            div.style.borderBottom = '1px solid var(--border)';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';

            div.innerHTML = `
                <div>
                    <div style="font-weight:600">${s.ad} ${s.soyad}</div>
                    <div style="font-size:11px; color:var(--text3)">${s.tc} ${expectedFee > 0 ? `| Beklenen: ${expectedFee} ₺` : ''}</div>
                </div>
                ${siblingPaid ? '<span class="badge badge-matched">Kardeşi Ödedi</span>' : '<span class="badge badge-partial">Ödenmedi</span>'}
            `;
            listEl.appendChild(div);
        }
        // 2. Eksik Ödeyenler (Aile bazlı kontrol)
        else if (hasPaid && expectedFee > 0) {
            const info = getFamilyPaymentInfo(s, selectedMonth);
            if (info.diff < 0) {
                const div = document.createElement('div');
                div.style.padding = '10px 14px'; div.style.borderBottom = '1px solid var(--border)';
                div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center';
                div.innerHTML = `
                    <div>
                        <div style="font-weight:600">${s.ad} ${s.soyad}</div>
                        <div style="font-size:11px; color:var(--danger)">${info.isFamily ? 'Aile Eksik' : 'Eksik'}: ${Math.abs(info.diff)} ₺ (Durum: ${isRaporlu ? p.tur : 'Ödeme'})</div>
                    </div> 
                    <span class="badge" style="background:rgba(255, 107, 107, 0.1); color:#ff6b6b; border:1px solid rgba(255,107,107,0.2)">Eksik Ödeme</span>
                `;
                listEl.appendChild(div);
            }
        }
        // 3. Raporlu/İzinli (Ve ödemesi TAM veya hiç yok ama izinli sayılıyor)
        else if (isRaporlu) {
            const div = document.createElement('div');
            div.style.padding = '10px 14px'; div.style.borderBottom = '1px solid var(--border)';
            div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center';
            div.innerHTML = `<div><div style="font-weight:600">${s.ad} ${s.soyad}</div></div> <span class="badge badge-partial">${p.tur}</span>`;
            listEl.appendChild(div);
        }
    });

    if (listEl.innerHTML === '') {
        listEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text3)">Bu ay için tüm ödemeler tamamlanmış.</div>';
    }
}

function renderMatrix() {
    const header = document.getElementById('matrix-header');
    const body = document.getElementById('matrix-body');
    if (!header || !body) return;

    // Arama kutusunun değerini al
    const searchTerm = (document.getElementById('search-matris') ? document.getElementById('search-matris').value.toLocaleUpperCase('tr-TR') : '');

    // Eğer çok fazla veri varsa kullanıcıya bilgi ver
    if (allStudents.length > 500 && !searchTerm) {
        body.innerHTML = `<tr><td colspan="15" style="padding:40px; text-align:center;">
            <div style="color:var(--text3); font-size:14px; margin-bottom:10px;">Çok fazla veri var (>${allStudents.length}). Performans için lütfen arama yapın veya bekleyin.</div>
            <button class="btn" onclick="app.renderMatrixFull()" style="background:var(--accent); color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">Hepsini Göster (Yavaş olabilir)</button>
        </td></tr>`;
        return;
    }

    renderMatrixInternal(searchTerm);
}

function renderMatrixInternal(searchTerm) {
    const header = document.getElementById('matrix-header');
    const body = document.getElementById('matrix-body');
    
    const yearSetting = document.getElementById('settings-year');
    const yearText = yearSetting ? yearSetting.value : new Date().getFullYear() + "-" + (new Date().getFullYear() + 1);
    const startYear = parseInt(yearText.split('-')[0]) || new Date().getFullYear();

    const months = ['AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK', 'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ'];
    
    const monthBoundaries = {};
    months.forEach(m => {
        monthBoundaries[m] = getMonthBoundary(m, startYear);
    });

    const sortIcon = (key) => {
        if (sortState.matrix.key !== key) return '↕️';
        return sortState.matrix.dir === 'asc' ? '🔼' : '🔽';
    };

    header.innerHTML = `<th onclick="app.handleSort('matrix', 'ad')" style="cursor:pointer">Öğrenci ${sortIcon('ad')}</th>`;
    months.forEach(m => { header.innerHTML += `<th>${m}</th>`; });
    header.innerHTML += `<th onclick="app.handleSort('matrix', 'total')" style="cursor:pointer">Toplam ${sortIcon('total')}</th>`;

    const payMap = {};
    allPayments.forEach(p => {
        if (!payMap[p.tc]) payMap[p.tc] = {};
        if (!payMap[p.tc][p.ay]) payMap[p.tc][p.ay] = [];
        payMap[p.tc][p.ay].push(p);
    });

    const siblingMap = {};
    allStudents.forEach(s => {
        if (!siblingMap[s.tc]) {
            siblingMap[s.tc] = getSiblingLogic(s);
        }
    });

    const getCachedEffectivePayment = (tc, month) => {
        let matching = (payMap[tc] && payMap[tc][month]) ? payMap[tc][month] : [];
        if (matching.length === 0) {
            if (month === 'AĞUSTOS') matching = (payMap[tc] && payMap[tc]['EYLÜL']) ? payMap[tc]['EYLÜL'] : [];
            else if (month === 'EYLÜL') matching = (payMap[tc] && payMap[tc]['AĞUSTOS']) ? payMap[tc]['AĞUSTOS'] : [];
        }
        return mergePayments(matching);
    };

    const filteredStudents = allStudents.filter(s => {
        const name = `${s.ad} ${s.soyad}`.toLocaleUpperCase('tr-TR');
        return name.includes(searchTerm) || (s.tc && s.tc.includes(searchTerm));
    });

    const matrixData = filteredStudents.map(s => {
        let total = 0;
        const rowCells = months.map(m => {
            const p = getCachedEffectivePayment(s.tc, m);
            if (p && p.tur === 'Ödeme' && p.ay === m) total += parseFloat(p.tutar || 0);
            return { month: m, payment: p };
        });
        return { student: s, total, ad: `${s.ad} ${s.soyad}`, cells: rowCells };
    });

    matrixData.sort((a, b) => {
        let valA = a[sortState.matrix.key], valB = b[sortState.matrix.key];
        if (typeof valA === 'string') return sortState.matrix.dir === 'asc' ? valA.localeCompare(valB, 'tr') : valB.localeCompare(valA, 'tr');
        return sortState.matrix.dir === 'asc' ? valA - valB : valB - valA;
    });

    // Chunked Rendering
    body.innerHTML = '';
    const chunkSize = 50;
    let currentIdx = 0;

    function renderChunk() {
        const chunk = matrixData.slice(currentIdx, currentIdx + chunkSize);
        let html = '';
        chunk.forEach((item, idx) => {
            const s = item.student;
            const egitimLabel = formatEgitimTuru(s.egitim_turu);
            const isDiscounted = egitimLabel === 'İNDİRİMLİ' || egitimLabel === 'SABAHÇI';
            const siblings = siblingMap[s.tc] || [];

            let rowHtml = `<tr class="matrix-row ${(currentIdx + idx) % 2 === 0 ? 'matrix-row-even' : 'matrix-row-odd'}">
                <td style="padding-left:15px;"><div class="matrix-student-name"><div class="matrix-student-main">
                    ${s.ad} ${s.soyad}
                    <span onclick="app.showStudentDetail('${s.tc}')" style="cursor:pointer; margin-left:5px; font-size:12px; opacity:0.6;">✏️</span>
                    ${isDiscounted ? `<span style="font-size:9px; padding:2px 5px; background:rgba(56,139,253,0.15); color:#388bfd; border-radius:4px; font-weight:700">İNDİRİM</span>` : ''}
                    ${(siblings.length > 0) ? `<span class="badge badge-matched" style="font-size:9px; padding:1px 4px">KARDEŞ</span>` : ''}
                    ${s.cikis_tarihi ? `<span style="font-size:9px; padding:2px 5px; background:rgba(255,77,77,0.15); color:#ff4d4d; border-radius:4px; font-weight:700; margin-left:5px;">AYRILDI</span>` : ''}
                </div></div></td>`;

            item.cells.forEach(c => {
                const m = c.month; const p = c.payment;
                if (p) {
                    const hasNote = p.notlar && p.notlar.trim() !== '';
                    const noteIcon = hasNote ? `<div style="position:absolute; top:2px; right:2px; font-size:10px; color:#ff9800;" title="${p.notlar.replace(/"/g, '&quot;')}">📝</div>` : '';
                    const tdStyle = hasNote ? 'position:relative;' : '';
                    
                    if (p.tur === 'Raporlu' || p.tur === 'İzinli') {
                        rowHtml += `<td class="cell-sibling" onclick="app.showEditPayment(${p.id})" style="${tdStyle}"><span class="matrix-cell">${p.tur.charAt(0)}</span>${noteIcon}</td>`;
                    } else if (p.ay !== m) {
                        rowHtml += `<td class="cell-paid" style="background:rgba(56, 139, 253, 0.1); ${tdStyle}"><span class="matrix-cell" style="color:#0969da;">MUAF</span>${noteIcon}</td>`;
                    } else {
                        const info = getFamilyPaymentInfo(s, m, getCachedEffectivePayment, (st) => siblingMap[st.tc] || []);
                        let cellClass = (info.diff < 0) ? 'cell-partial' : (info.diff > 0 ? 'cell-overpaid' : 'cell-paid');
                        rowHtml += `<td class="${cellClass}" onclick="app.showEditPayment(${p.id})" style="${tdStyle}"><span class="matrix-cell"><b>${info.paid} ₺</b>${info.diff !== 0 ? `<div style="font-size:9px">${info.diff > 0 ? '+' : ''}${info.diff}</div>` : ''}</span>${noteIcon}</td>`;
                    }
                } else {
                    let showAyrildi = false;
                    if (s.cikis_tarihi) {
                        const dateParts = s.cikis_tarihi.split('-');
                        if (dateParts.length >= 2) {
                            const cikisMonthNum = parseInt(dateParts[1], 10);
                            const monthNames = ["OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN", "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"];
                            const cikisMonthName = monthNames[cikisMonthNum - 1];
                            const mIndex = months.indexOf(m);
                            const cikisIndex = months.indexOf(cikisMonthName);
                            if (cikisIndex !== -1 && mIndex > cikisIndex) {
                                showAyrildi = true;
                            }
                        }
                    }

                    if (showAyrildi) {
                        rowHtml += `<td class="cell-unpaid" style="background:rgba(255,77,77,0.05); cursor:not-allowed;" title="Öğrenci Ayrıldı"><span class="matrix-cell" style="color:#ff4d4d; font-size:9px; font-weight:700;">AYRILDI</span></td>`;
                    } else {
                        const info = getFamilyPaymentInfo(s, m, getCachedEffectivePayment, (st) => siblingMap[st.tc] || []);
                        if (info.isFamily && info.paid > 0) {
                            rowHtml += `<td class="${info.diff >= 0 ? 'cell-sibling' : 'cell-partial'}" onclick="app.openMatrixQuickAdd('${s.tc}','${s.ad} ${s.soyad}','${m}')"><span class="matrix-cell"><b>${info.paid} ₺</b><div style="font-size:8px">KRDŞ</div></span></td>`;
                        } else {
                            rowHtml += `<td class="cell-unpaid" onclick="app.openMatrixQuickAdd('${s.tc}','${s.ad} ${s.soyad}','${m}')"><span class="matrix-cell" style="opacity:0.3;">＋</span></td>`;
                        }
                    }
                }
            });
            rowHtml += `<td style="font-weight:700">${item.total} ₺</td></tr>`;
            html += rowHtml;
        });
        
        const temp = document.createElement('tbody');
        temp.innerHTML = html;
        while(temp.firstChild) body.appendChild(temp.firstChild);

        currentIdx += chunkSize;
        if (currentIdx < matrixData.length) {
            setTimeout(renderChunk, 10);
        } else {
            renderMatrixFooter(months, stats = null);
        }
    }

    renderChunk();
}

function renderMatrixFooter(months) {
    const body = document.getElementById('matrix-body');
    let existingFooter = body.parentNode.querySelector('tfoot');
    if (existingFooter) existingFooter.remove();

    const footer = document.createElement('tfoot');
    let grandTotal = 0;
    const stats = {};
    months.forEach(m => stats[m] = { total: 0, count: 0 });

    allPayments.forEach(p => {
        if (stats[p.ay] && p.tur === 'Ödeme') {
            stats[p.ay].total += parseFloat(p.tutar || 0);
            stats[p.ay].count++;
        }
    });

    let footerHtml = `<tr style="background:var(--surface2); font-weight:700"><td style="text-align:right; padding-right:15px;">TOPLAM:</td>`;
    months.forEach(m => {
        footerHtml += `<td>${stats[m].total.toLocaleString('tr-TR')} ₺</td>`;
        grandTotal += stats[m].total;
    });
    footerHtml += `<td>${grandTotal.toLocaleString('tr-TR')} ₺</td></tr>`;
    
    footer.innerHTML = footerHtml;
    body.parentNode.appendChild(footer);
}

function renderExpectedPayments() {
    try {
        const tbody = document.getElementById('beklenen-table');
        const countEl = document.getElementById('beklenen-count');
        const filterEl = document.getElementById('beklenen-month-filter');
        if (!tbody) return;

        const filterVal = filterEl ? filterEl.value : 'TÜM';
        const searchTerm = document.getElementById('beklenen-search') ? document.getElementById('beklenen-search').value.toLowerCase() : '';
        tbody.innerHTML = '';
        let count = 0;

        const months = ['AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK', 'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ'];
        const now = new Date();
        const currMonth = now.getMonth() + 1;
        const monthMap = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 10, 7: 11 };
        const currentIdx = monthMap[currMonth] !== undefined ? monthMap[currMonth] : 10;

        allStudents.forEach(s => {
            const fullName = `${s.ad} ${s.soyad}`.toLowerCase();
            if (searchTerm && !fullName.includes(searchTerm) && !s.tc.includes(searchTerm)) return;

            let missingMonths = [];
            const siblings = getSiblingLogic(s);

            months.forEach((m, idx) => {
                if (filterVal !== 'TÜM' && m !== filterVal) return;
                if (idx > currentIdx) return;
                if (!isStudentActiveInMonth(s, m)) return;

                const p = getEffectivePayment(s.tc, m);
                if (!p) {
                    const siblingPaid = siblings.some(sib => !!getEffectivePayment(sib.tc, m));
                    if (!siblingPaid) missingMonths.push(m);
                }
            });

            if (missingMonths.length > 0) {
                count++;
                const egitimLabel = formatEgitimTuru(s.egitim_turu);
                const isDiscounted = egitimLabel === 'İNDİRİMLİ' || egitimLabel === 'SABAHÇI';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight:600">${s.ad} ${s.soyad}</td>
                    <td>${s.tc}</td>
                    <td style="color:var(--accent); font-weight:600; font-size:11px;">${missingMonths.join(', ')}</td>
                    <td><span class="badge ${isDiscounted ? 'badge-matched' : 'badge-paid'}">${egitimLabel}</span></td>
                    <td><span class="badge badge-partial">${missingMonths.length} Ay Eksik</span></td>
                `;
                tbody.appendChild(tr);
            }
        });

        if (countEl) countEl.innerText = `${count} Öğrenci`;
        if (count === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text3)">Seçili kriterlere göre ödeme bekleyen öğrenci bulunamadı.</td></tr>';
        }
    } catch (e) {
        console.error("renderExpectedPayments error:", e);
    }
}

function renderRapor() {
    const ayBody = document.getElementById('rapor-ay-table');
    const listeBody = document.getElementById('rapor-liste-table');
    const ogrenciBody = document.getElementById('rapor-ogrenci-table');
    const ayFooter = document.getElementById('rapor-ay-footer');
    const listeFooter = document.getElementById('rapor-liste-footer');
    const ogrenciFooter = document.getElementById('rapor-ogrenci-footer');
    const filter = document.getElementById('rapor-month-filter');

    if (!ayBody || !listeBody || !ogrenciBody || !filter) return;

    const selectedMonth = filter.value;
    const months = ['AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK', 'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ'];

    // 1. Ay Bazlı Özet
    ayBody.innerHTML = '';
    let aySum = 0;
    months.forEach(m => {
        const pays = allPayments.filter(p => p.ay === m);
        if (pays.length > 0) {
            const sum = pays.reduce((acc, p) => acc + parseFloat(p.tutar || 0), 0);
            aySum += sum;
            const count = new Set(pays.map(p => p.tc)).size;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${m}</td>
                <td>${pays.length}</td>
                <td>${count}</td>
                <td class="amount positive">${sum} ₺</td>
                <td class="amount">${(sum / pays.length).toFixed(2)} ₺</td>
            `;
            ayBody.appendChild(tr);
        }
    });
    if (ayFooter) {
        ayFooter.innerHTML = `<tr style="background:var(--surface2); font-weight:700">
            <td colspan="3">GENEL TOPLAM</td>
            <td class="amount positive" style="font-size:16px">${aySum} ₺</td>
            <td></td>
        </tr>`;
    }

    // Mükerrer dekont tespiti
    const dekontCounts = {};
    allPayments.forEach(p => {
        if (p.dekont && String(p.dekont).trim() !== '') {
            const d = String(p.dekont).trim().toUpperCase();
            dekontCounts[d] = (dekontCounts[d] || 0) + 1;
        }
    });

    // 2. Aylık Liste (Filtered)
    const listeHeader = document.querySelector('#tabraporliste thead tr');
    const sortIcon = (tbl, key) => {
        if (sortState[tbl].key !== key) return '↕️';
        return sortState[tbl].dir === 'asc' ? '🔼' : '🔽';
    };

    if (listeHeader) {
        const kdvHeader = currentMode === 'doner' ? `<th onclick="app.handleSort('raporListe', 'tutar')" style="cursor:pointer">%10 KDV</th>` : '';
        listeHeader.innerHTML = `
            <th onclick="app.handleSort('raporListe', 'ad_soyad')" style="cursor:pointer">Öğrenci ${sortIcon('raporListe', 'ad_soyad')}</th>
            <th onclick="app.handleSort('raporListe', 'tc')" style="cursor:pointer">TC ${sortIcon('raporListe', 'tc')}</th>
            <th onclick="app.handleSort('raporListe', 'tarih')" style="cursor:pointer">Tarih ${sortIcon('raporListe', 'tarih')}</th>
            <th onclick="app.handleSort('raporListe', 'dekont')" style="cursor:pointer">Dekont ${sortIcon('raporListe', 'dekont')}</th>
            <th onclick="app.handleSort('raporListe', 'tutar')" style="cursor:pointer">Tutar ${sortIcon('raporListe', 'tutar')}</th>
            ${kdvHeader}
            <th style="width:80px">İşlem</th>
        `;
    }

    listeBody.innerHTML = '';
    const searchTerm = document.getElementById('rapor-search') ? document.getElementById('rapor-search').value.toLowerCase() : '';

    const filteredPays = (selectedMonth === 'all' ? allPayments : allPayments.filter(p => p.ay === selectedMonth))
        .filter(p => {
            if (!searchTerm) return true;
            const name = (p.ad_soyad || '').toLowerCase();
            return name.includes(searchTerm) || (p.tc && p.tc.includes(searchTerm));
        });

    // Sıralama uygula
    filteredPays.sort((a, b) => {
        let key = sortState.raporListe.key;
        let valA = a[key] || '';
        let valB = b[key] || '';

        if (key === 'tutar' || key === 'id') {
            valA = parseFloat(valA); valB = parseFloat(valB);
        }

        if (typeof valA === 'string') {
            return sortState.raporListe.dir === 'asc' ? valA.localeCompare(valB, 'tr') : valB.localeCompare(valA, 'tr');
        }
        return sortState.raporListe.dir === 'asc' ? valA - valB : valB - valA;
    });

    let listeSum = 0;
    let kdvSum = 0;
    filteredPays.forEach(p => {
        const tutarVal = parseFloat(p.tutar || 0);
        listeSum += tutarVal;
        const kdvVal = tutarVal * 0.1;
        kdvSum += kdvVal;
        
        const isDuplicate = p.dekont && p.dekont.trim() !== '' && dekontCounts[p.dekont.trim().toUpperCase()] > 1;

        const tr = document.createElement('tr');
        const kdvCell = currentMode === 'doner' ? `<td class="amount" style="color:var(--text3)">${kdvVal.toLocaleString('tr-TR')} ₺</td>` : '';
        
        tr.innerHTML = `
            <td>${p.ad_soyad || p.tc}</td>
            <td>${p.tc || '-'}</td>
            <td>${p.tarih}</td>
            <td><span class="code-badge ${isDuplicate ? 'duplicate' : ''}" ${isDuplicate ? 'title="Bu dekont numarası birden fazla kullanılmış!"' : ''}>${p.dekont}</span></td>
            <td class="amount positive">${tutarVal.toLocaleString('tr-TR')} ₺</td>
            ${kdvCell}
            <td>
                <button class="btn" style="padding:2px 6px; font-size:10px" onclick="app.showEditPayment(${p.id})">✏️</button>
                <button class="btn btn-danger" style="padding:2px 6px; font-size:10px" onclick="app.deletePayment(${p.id})">🗑</button>
            </td>
        `;
        listeBody.appendChild(tr);
    });
    if (listeFooter) {
        const kdvFooter = currentMode === 'doner' ? `<td class="amount" style="font-size:14px; color:var(--text2)">KDV: ${kdvSum.toLocaleString('tr-TR')} ₺</td>` : '';
        listeFooter.innerHTML = `<tr style="background:var(--surface2); font-weight:700">
            <td colspan="4">TOPLAM</td>
            <td class="amount positive" style="font-size:16px">${listeSum.toLocaleString('tr-TR')} ₺</td>
            ${kdvFooter}
            ${currentMode !== 'doner' ? '' : '<td></td>'}
        </tr>`;
    }

    // 3. Öğrenci Bazlı Özet
    const ogrenciHeader = document.querySelector('#tabraporogrenci thead tr');
    if (ogrenciHeader) {
        ogrenciHeader.innerHTML = `
            <th onclick="app.handleSort('raporOgrenci', 'ad')" style="cursor:pointer">Öğrenci ${sortIcon('raporOgrenci', 'ad')}</th>
            <th>TC</th>
            <th>Ödenen Ay Sayısı</th>
            <th onclick="app.handleSort('raporOgrenci', 'sum')" style="cursor:pointer">Toplam Ödeme ${sortIcon('raporOgrenci', 'sum')}</th>
            <th>Durum</th>
        `;
    }

    ogrenciBody.innerHTML = '';
    let ogrenciSum = 0;
    let totalExpected = 0;

    const processedFamilies = new Set();

    const ogrenciReportData = allStudents.map(s => {
        let isKardes = false;
        let siblings = getSiblingLogic(s);
        
        if (siblings.length > 0) {
            isKardes = true;
        }

        if (isKardes) {
            const familyTCs = [s.tc, ...siblings.map(sib => sib.tc)].sort();
            const familyId = familyTCs.join('-');
            if (processedFamilies.has(familyId)) return null;
            processedFamilies.add(familyId);
            
            const familyPays = allPayments.filter(p => familyTCs.includes(p.tc) && p.tur === 'Ödeme');
            const effectiveFamilyPaysForSelected = familyPays.filter(p => {
                if (selectedMonth === 'all') return true;
                if (p.ay === selectedMonth) return true;
                if (selectedMonth === 'AĞUSTOS' && p.ay === 'EYLÜL') return true;
                if (selectedMonth === 'EYLÜL' && p.ay === 'AĞUSTOS') return true;
                return false;
            });
            const familyMonthsPaid = new Set(effectiveFamilyPaysForSelected.map(p => (selectedMonth !== 'all' ? selectedMonth : p.ay)));
            
            let expectedTotal = 0;
            let sum = 0;
            familyMonthsPaid.forEach(m => {
                const info = getFamilyPaymentInfo(s, m);
                expectedTotal += info.expected;
                sum += info.paid;
            });

            const familyNames = [s, ...siblings].map(f => `${f.ad} ${f.soyad}`).join(' & ');
            
            return { 
                student: s, 
                sum: sum, 
                months: familyMonthsPaid.size, 
                expectedTotal: expectedTotal, 
                ad: familyNames,
                isKardes: true,
                tc: familyTCs.join(' / '),
                egitim_turu: 'KARDEŞ'
            };
        } else {
            const pays = allPayments.filter(p => p.tc === s.tc && p.tur === 'Ödeme');
            const effectivePaysForSelected = pays.filter(p => {
                if (selectedMonth === 'all') return true;
                if (p.ay === selectedMonth) return true;
                if (selectedMonth === 'AĞUSTOS' && p.ay === 'EYLÜL') return true;
                if (selectedMonth === 'EYLÜL' && p.ay === 'AĞUSTOS') return true;
                return false;
            });
            const sum = effectivePaysForSelected.reduce((acc, p) => acc + parseFloat(p.tutar || 0), 0);
            
            const monthsPaid = new Set(effectivePaysForSelected.map(p => (selectedMonth !== 'all' ? selectedMonth : p.ay)));
            let expectedTotal = 0;
            monthsPaid.forEach(m => {
                expectedTotal += getExpectedFee(s, m);
            });

            return { 
                student: s, 
                sum: sum, 
                months: monthsPaid.size, 
                expectedTotal: expectedTotal, 
                ad: `${s.ad} ${s.soyad}`,
                isKardes: false,
                tc: s.tc,
                egitim_turu: s.egitim_turu || 'TAM GÜN'
            };
        }
    }).filter(item => {
        if (!item) return false;
        if (searchTerm && !item.ad.toLowerCase().includes(searchTerm) && !item.tc.includes(searchTerm)) return false;
        return item.sum > 0;
    });

    // Sıralama uygula
    ogrenciReportData.sort((a, b) => {
        let valA = a[sortState.raporOgrenci.key];
        let valB = b[sortState.raporOgrenci.key];
        if (typeof valA === 'string') {
            return sortState.raporOgrenci.dir === 'asc' ? valA.localeCompare(valB, 'tr') : valB.localeCompare(valA, 'tr');
        }
        return sortState.raporOgrenci.dir === 'asc' ? valA - valB : valB - valA;
    });

    ogrenciReportData.forEach(item => {
        const sum = item.sum;
        const uniqueMonths = item.months;
        const studentExpected = item.expectedTotal;

        ogrenciSum += sum;
        totalExpected += studentExpected;

        const tr = document.createElement('tr');
        let statusBadge = 'badge-partial';
        let amountClass = 'positive';
        let extraInfo = '';

        if (studentExpected > 0) {
            if (sum >= studentExpected) {
                statusBadge = 'badge-paid';
                if (sum > studentExpected) {
                    statusBadge = 'badge-overpaid';
                    amountClass = 'positive';
                    extraInfo = `<br><small style="color:#8a2be2">Fazla: ${sum - studentExpected} ₺</small>`;
                }
            } else {
                statusBadge = 'badge-partial';
                amountClass = 'negative';
                extraInfo = `<br><small>Eksik: ${studentExpected - sum} ₺</small>`;
            }
        }

        let egitimDisplay = item.isKardes ? `<span style="color:#a78bfa; font-weight:600">👥 KARDEŞ</span>` : item.egitim_turu;

        tr.innerHTML = `
            <td>${item.ad} <br> <small style="color:var(--text3)">${egitimDisplay}</small></td>
            <td>${item.tc}</td>
            <td>${uniqueMonths} Ay</td>
            <td class="amount ${amountClass}">${sum} ₺ ${extraInfo}</td>
            <td><span class="badge ${statusBadge}">${sum > studentExpected ? 'Fazla Ödeme' : (sum === studentExpected ? 'Tamamlandı' : 'Eksik Ödeme')}</span></td>
        `;
        ogrenciBody.appendChild(tr);
    });
    if (ogrenciFooter) {
        ogrenciFooter.innerHTML = `<tr style="background:var(--surface2); font-weight:700">
            <td colspan="3">TOPLAM TAHSİLAT / BEKLENEN (Ödenen Aylar İçin)</td>
            <td class="amount positive" style="font-size:16px">${ogrenciSum} ₺ / ${totalExpected} ₺</td>
            <td class="${ogrenciSum < totalExpected ? 'negative' : 'positive'}">${ogrenciSum < totalExpected ? '⚠️ Eksik Tahsilat' : '✅ Sorunsuz'}</td>
        </tr>`;
    }
}

async function exportRaporExcel() {
    try {
        if (typeof XLSX === 'undefined') {
            console.error('XLSX library not found in exportRaporExcel');
            showToast('Excel kütüphanesi yüklenemedi. Lütfen internet bağlantınızı kontrol edin.', 'error');
            return;
        }
        const filter = document.getElementById('rapor-month-filter');
        const selectedMonth = filter ? filter.value : 'all';

        // Veriyi filtrele
        const filteredData = allPayments.filter(p => selectedMonth === 'all' || p.ay === selectedMonth);

        if (filteredData.length === 0) {
            showToast('Dışa aktarılacak veri bulunamadı.', 'info');
            return;
        }

        const data = filteredData.map(p => ({
            'Öğrenci': p.ad_soyad,
            'TC': p.tc,
            'Ay': p.ay,
            'Tarih': p.tarih,
            'Dekont': p.dekont || '-',
            'Tutar': (p.tutar || 0) + ' ₺',
            'Tür': p.tur || 'Ödeme',
            'Notlar': p.notlar || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rapor");
        XLSX.writeFile(wb, `Aylik_Rapor_${selectedMonth}_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
        showToast('Excel dosyası indirildi.', 'success');
    } catch (e) {
        console.error('Export Error:', e);
        showToast('Excel oluşturulurken bir hata oluştu: ' + e.message, 'error');
    }
}

function exportRaporPDF() {
    const filter = document.getElementById('rapor-month-filter');
    const selectedMonth = filter ? filter.value : 'all';

    const filtered = allPayments.filter(p => selectedMonth === 'all' || p.ay === selectedMonth);
    const totalAmount = filtered.reduce((sum, p) => sum + parseFloat(p.tutar || 0), 0);
    const totalKdv = totalAmount * 0.1;

    const kdvHeader = currentMode === 'doner' ? '<th>%10 KDV</th>' : '';

    const content = `
        <html>
        <head>
            <title>Aidat Raporu - ${selectedMonth}</title>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11px; }
                th { background-color: #f2f2f2; }
                h2 { text-align: center; }
                @media print { @page { margin: 1cm; } body { margin: 0; } }
            </style>
        </head>
        <body>
            <h2>${currentMode === 'doner' ? 'DÖSE' : 'KULÜP'} Aidat Ödeme Raporu (${selectedMonth})</h2>
            <table>
                <thead>
                    <tr>
                        <th>Öğrenci</th>
                        <th>TC</th>
                        <th>Ay</th>
                        <th>Tarih</th>
                        <th>Dekont</th>
                        <th>Tutar</th>
                        ${kdvHeader}
                        <th>Notlar</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(p => {
                        const tutar = parseFloat(p.tutar || 0);
                        const kdv = tutar * 0.1;
                        const kdvCell = currentMode === 'doner' ? `<td style="text-align:right">${kdv.toLocaleString('tr-TR')} ₺</td>` : '';
                        return `
                            <tr>
                                <td>${p.ad_soyad}</td>
                                <td>${p.tc}</td>
                                <td>${p.ay}</td>
                                <td>${p.tarih}</td>
                                <td>${p.dekont}</td>
                                <td style="text-align:right">${tutar.toLocaleString('tr-TR')} ₺</td>
                                ${kdvCell}
                                <td>${p.notlar || ''}</td>
                            </tr>
                        `;
                    }).join('')}
                    <tr style="background:#f9f9f9; font-weight:700">
                        <td colspan="5" style="text-align:right; border:1px solid #ddd; padding:8px">GENEL TOPLAM:</td>
                        <td style="text-align:right; border:1px solid #ddd; padding:8px">${totalAmount.toLocaleString('tr-TR')} ₺</td>
                        ${currentMode === 'doner' ? `<td style="text-align:right; border:1px solid #ddd; padding:8px">KDV: ${totalKdv.toLocaleString('tr-TR')} ₺</td><td></td>` : '<td></td>'}
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
    `;
    safePrintContent(content);
}

function renderSiblingList() {
    const container = document.getElementById('sibling-page-container');
    if (!container) return;
    container.innerHTML = '';

    const groups = {};
    allStudents.forEach(s => {
        const key = getSiblingKey(s);
        if (key) {
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        }
    });

    const siblings = Object.values(groups).filter(g => g.length > 1);

    if (siblings.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text3)">Kardeş kaydı bulunamadı.</div>';
        return;
    }

    siblings.forEach(group => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.padding = '15px';

        let membersHtml = '';
        group.forEach(m => {
            membersHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border)">
                    <span><strong>${m.ad} ${m.soyad}</strong></span>
                    <span style="font-size:12px; color:var(--text3)">${m.tc}</span>
                </div>
            `;
        });

        card.innerHTML = `
            <div style="margin-bottom:10px; display:flex; align-items:center; gap:10px">
                <span style="font-size:24px">👨‍👩‍👧‍👦</span>
                <div>
                    <div style="font-weight:600">Veli: ${group[0].anne_adi || ''} / ${group[0].baba_adi || ''}</div>
                    <div style="font-size:11px; color:var(--accent)">${group.length} Kardeş</div>
                </div>
            </div>
            ${membersHtml}
        `;
        container.appendChild(card);
    });
}

async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const settings = (await res.json()) || {};
        currentSettings = settings;
        
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };

        setVal('settings-name', settings.school_name);
        setVal('settings-year', settings.school_year);
        setVal('settings-logo', settings.school_logo);
        setVal('setting-ucret-sabahci', settings.ucret_sabahci);
        setVal('setting-ucret-tam-gun', settings.ucret_tam_gun);
        setVal('setting-ucret-sabahci-2', settings.ucret_sabahci_2);
        setVal('setting-ucret-tam-gun-2', settings.ucret_tam_gun_2);

        if (document.getElementById('settings-logo')) {
            const val = settings.school_logo || '';
            const preview = document.getElementById('settings-logo-preview');
            if (preview) {
                if (val && val.startsWith('data:image/')) {
                    preview.src = val;
                    preview.style.display = 'block';
                } else {
                    preview.style.display = 'none';
                    preview.src = '';
                }
            }
        }
        
        const kvkkEl = document.getElementById('setting-kvkk-accept');
        if (kvkkEl) kvkkEl.checked = !!settings.kvkk_accepted;

        // Dynamic UI updates based on settings
        if (settings.school_year) {
            const yearEl = document.getElementById('sidebar-year');
            if (yearEl) yearEl.innerText = settings.school_year;
        }
        updateHeaderLogo();
        updateGlobalHeader(); // Okul adı çekildikten sonra global başlığı da güncelle
    } catch (e) { console.error('Settings load failed', e); }
}

async function saveSettings() {
    try {
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : '';
        };

        const name = getVal('settings-name');
        const logo = getVal('settings-logo');
        const year = getVal('settings-year');
        const sabahci = getVal('setting-ucret-sabahci');
        const tamgun = getVal('setting-ucret-tam-gun');
        const newPass = getVal('settings-new-pass');
        const sabahci2 = getVal('setting-ucret-sabahci-2');
        const tamgun2 = getVal('setting-ucret-tam-gun-2');

        const kvkkAccepted = document.getElementById('setting-kvkk-accept')?.checked || false;

        const settingsObj = {
            school_name: name,
            school_logo: logo,
            school_year: year,
            ucret_sabahci: sabahci,
            ucret_tam_gun: tamgun,
            ucret_sabahci_2: sabahci2,
            ucret_tam_gun_2: tamgun2,
            kvkk_accepted: kvkkAccepted ? 1 : 0
        };

        if (newPass && newPass.trim() !== '') {
            settingsObj.settings_password = newPass;
        }

        showToast('Ayarlar kaydediliyor...', 'info');

        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: settingsObj })
        });

        const data = await res.json();
        
        if (res.ok) {
            showToast('Ayarlar başarıyla kaydedildi.', 'success');
            const newPassEl = document.getElementById('settings-new-pass');
            if (newPassEl) newPassEl.value = '';
            await loadSettings();
            updateHeaderLogo();
            
            if (typeof window.advanceOnboarding === 'function' && currentOnboardingStep === 1) {
                window.advanceOnboarding();
            }
        } else {
            showToast(data.error || 'Ayarlar kaydedilemedi.', 'error');
        }
    } catch (e) {
        console.error('saveSettings error:', e);
        showToast('İşlem sırasında bir hata oluştu.', 'error');
    }
}

const oldInit = initTheme;
initTheme = function () {
    oldInit();
    loadSettings();
};

function exportExpectedExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('XLSX kütüphanesi yüklenemedi.', 'error');
        return;
    }
    const data = [];
    const months = ['AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK', 'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ'];

    allStudents.forEach(s => {
        let missingMonths = [];
        const siblings = getSiblingLogic(s);

        months.forEach(m => {
            if (!getEffectivePayment(s.tc, m)) {
                const siblingPaid = siblings.some(sib => !!getEffectivePayment(sib.tc, m));
                if (!siblingPaid) missingMonths.push(m);
            }
        });

        if (missingMonths.length > 0) {
            data.push({
                'Öğrenci': `${s.ad} ${s.soyad}`,
                'TC Kimlik': s.tc,
                'Eksik Aylar': missingMonths.join(', '),
                'Toplam Eksik': missingMonths.length
            });
        }
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Odeme_Beklenen");
    XLSX.writeFile(wb, "Odeme_Beklenen_Listesi.xlsx");
    showToast('Excel dosyası indirildi.', 'success');
}

function exportExpectedPDF() {
    const months = ['AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK', 'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ'];

    let rowsHtml = '';
    allStudents.forEach(s => {
        let missingMonths = [];
        const siblings = getSiblingLogic(s);
        months.forEach(m => {
            if (!getEffectivePayment(s.tc, m)) {
                const siblingPaid = siblings.some(sib => !!getEffectivePayment(sib.tc, m));
                if (!siblingPaid) missingMonths.push(m);
            }
        });

        if (missingMonths.length > 0) {
            rowsHtml += `<tr><td>${s.ad} ${s.soyad}</td><td>${s.tc}</td><td>${missingMonths.join(', ')}</td><td>${missingMonths.length}</td></tr>`;
        }
    });

    const content = `
        <html><head><title>Ödeme Beklenen Listesi</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background-color:#f2f2f2}h2{text-align:center}</style></head>
        <body><h2>Ödeme Beklenen Öğrenci Listesi</h2><table><thead><tr><th>Öğrenci</th><th>TC Kimlik</th><th>Eksik Aylar</th><th>Adet</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>
    `;
    safePrintContent(content);
}

function exportMatrixExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('XLSX kütüphanesi yüklenemedi.', 'error');
        return;
    }
    const months = ['AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK', 'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ'];
    const data = allStudents.map(s => {
        const row = { 'Öğrenci': `${s.ad} ${s.soyad}`, 'TC': s.tc, 'Eğitim': s.egitim_turu };
        let total = 0;
        months.forEach(m => {
            const p = getEffectivePayment(s.tc, m);
            if (p) {
                if (p.tur === 'Ödeme') {
                    if (p.ay === m) {
                        row[m] = p.tutar + ' ₺';
                        total += parseFloat(p.tutar || 0);
                    } else {
                        row[m] = 'MUAF';
                    }
                } else {
                    row[m] = p.tur;
                }
            }
        });
        row['Toplam'] = total + ' ₺';

        // Bu öğrenciye ait herhangi bir ayda not varsa, onları birleştirip gösterelim mi? 
        // Yoksa her ay için ayrı sütun mu? Excel matrisinde aylar sütun olduğu için notları sona eklemek mantıklı.
        const studentNotes = allPayments
            .filter(p => p.tc === s.tc && p.notlar && p.notlar.trim() !== '')
            .map(p => `[${p.ay}]: ${p.notlar}`)
            .join(' | ');
        row['Notlar'] = studentNotes;

        return row;
    });

    // Toplam Satırı Ekle
    const footerRow = { 'Öğrenci': 'GENEL TOPLAM', 'TC': '', 'Eğitim': '' };
    let grandTotal = 0;
    months.forEach(m => {
        const monthTotal = allPayments
            .filter(p => p.ay === m && p.tur === 'Ödeme')
            .reduce((sum, p) => sum + parseFloat(p.tutar || 0), 0);
        footerRow[m] = monthTotal + ' ₺';
        grandTotal += monthTotal;
    });
    footerRow['Toplam'] = grandTotal + ' ₺';
    data.push(footerRow);

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aidat_Matrisi");
    XLSX.writeFile(wb, "Aidat_Matrisi.xlsx");
    showToast('Excel indirildi.', 'success');
}

function exportMatrixPDF() {
    const months = ['AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK', 'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ'];

    let tableHtml = `
        <table style="width:100%; border-collapse:collapse; font-size:10px;">
            <thead>
                <tr style="background:#f2f2f2">
                    <th style="border:1px solid #ddd; padding:4px">Öğrenci</th>
                    ${months.map(m => `<th style="border:1px solid #ddd; padding:4px">${m}</th>`).join('')}
                    <th style="border:1px solid #ddd; padding:4px">Toplam</th>
                </tr>
            </thead>
            <tbody>
                ${allStudents.map(s => {
        let total = 0;
        return `
                        <tr>
                            <td style="border:1px solid #ddd; padding:4px"><strong>${s.ad} ${s.soyad}</strong></td>
                            ${months.map(m => {
            const p = getEffectivePayment(s.tc, m);
            if (p) {
                if (p.tur === 'Ödeme') {
                    if (p.ay === m) total += parseFloat(p.tutar || 0);
                    return `<td style="border:1px solid #ddd; padding:4px; text-align:center">✓</td>`;
                }
                return `<td style="border:1px solid #ddd; padding:4px; text-align:center">${p.tur.charAt(0)}</td>`;
            }
            return `<td style="border:1px solid #ddd; padding:4px; text-align:center; color:#ccc">-</td>`;
        }).join('')}
                            <td style="border:1px solid #ddd; padding:4px; font-weight:700">${total} ₺</td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
            <tfoot>
                <tr style="background:#f2f2f2; font-weight:bold">
                    <td style="border:1px solid #ddd; padding:4px">TOPLAM</td>
                    ${months.map(m => {
        const sum = allPayments
            .filter(p => p.ay === m && p.tur === 'Ödeme')
            .reduce((acc, p) => acc + parseFloat(p.tutar || 0), 0);
        return `<td style="border:1px solid #ddd; padding:4px">${sum} ₺</td>`;
    }).join('')}
                    <td style="border:1px solid #ddd; padding:4px">${allPayments.filter(p => p.tur === 'Ödeme').reduce((acc, p) => acc + parseFloat(p.tutar || 0), 0)} ₺</td>
                </tr>
            </tfoot>
        </table>
    `;

    const content = `
        <html>
        <head>
            <title>Aidat Matrisi</title>
            <style>
                body { font-family: sans-serif; padding: 10px; }
                h2 { text-align: center; font-size: 16px; }
            </style>
        </head>
        <body>
            <h2>Tüm Aylar Aidat Matrisi (${currentMode === 'kulup' ? 'Kulüp' : 'Döner Sermaye'})</h2>
            ${tableHtml}
        </body>
        </html>
    `;
    safePrintContent(content);
}

function setDefaultMonths() {
    const months = ['AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK', 'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ'];
    const d = new Date();
    const monthNum = d.getMonth() + 1;
    const monthMap = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 10 };
    const currentMonth = months[monthMap[monthNum] !== undefined ? monthMap[monthNum] : 0];

    const ids = ['dashboard-collection-month', 'dashboard-unpaid-month', 'beklenen-month-filter', 'rapor-month-filter', 'new-ay'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = currentMonth;
    });
}

function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 120;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
            } else {
                if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/png');

            const logoInput = document.getElementById('settings-logo');
            const preview = document.getElementById('settings-logo-preview');

            if (logoInput) logoInput.value = dataUrl;
            if (preview) {
                preview.src = dataUrl;
                preview.style.display = 'block';
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function handleSort(table, key) {
    if (sortState[table].key === key) {
        sortState[table].dir = sortState[table].dir === 'asc' ? 'desc' : 'asc';
    } else {
        sortState[table].key = key;
        sortState[table].dir = 'asc';
    }
    if (table === 'matrix') renderMatrix();
    else if (table === 'students') renderStudentTable();
    else if (table.startsWith('rapor')) renderRapor();
}


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
            '<tr><th style="text-align:right;background:var(--bg);border-right:1px solid var(--border);padding:8px;">Eğitim Türü</th><td style="padding:8px;">' + formatEgitimTuru(s.egitim_turu) + '</td></tr>' +
            '<tr><th style="text-align:right;background:var(--bg);border-right:1px solid var(--border);padding:8px;">Giriş Tarihi</th><td style="padding:8px;">' + (s.giris_tarihi || '-') + '</td></tr>' +
            '<tr><th style="text-align:right;background:var(--bg);border-right:1px solid var(--border);padding:8px;">Çıkış Tarihi</th><td style="padding:8px;">' + (s.cikis_tarihi || '-') + '</td></tr>';
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

        // Çıkış Tarihi Bilgisi
        const exitNoticeEl = document.getElementById('detail-exit-notice');
        if (exitNoticeEl) {
            if (s.cikis_tarihi && s.cikis_tarihi.trim() !== '') {
                exitNoticeEl.innerHTML = `
                    <div style="margin-top:20px; padding:20px; background:rgba(255, 77, 77, 0.1); border:1px solid rgba(255, 77, 77, 0.2); border-radius:12px; display:flex; align-items:center; gap:15px;">
                        <div style="font-size:24px;">🚪</div>
                        <div>
                            <div style="font-weight:700; color:#ff4d4d; font-size:16px;">Öğrenci Ayrılmıştır</div>
                            <div style="color:var(--text2); font-size:14px; margin-top:4px;">Bu öğrenci <b>${s.cikis_tarihi}</b> tarihinde sistemden çıkış yapmıştır.</div>
                        </div>
                    </div>
                `;
            } else {
                exitNoticeEl.innerHTML = '';
            }
        }
    }

    showPage('ogrenci-detay');
}

function printStudentDetails() {
    const tc = window.app.currentDetailTc;
    if (!tc) {
        showToast('Yazdırılacak öğrenci bulunamadı.', 'error');
        return;
    }
    const s = allStudents.find(x => x.tc === tc);
    if (!s) return;

    const payments = allPayments.filter(p => p.tc === tc).sort((a, b) => {
        const da = new Date(a.tarih);
        const db = new Date(b.tarih);
        return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
    });

    let total = 0;
    let paymentRows = '';
    payments.forEach((p, index) => {
        const tutar = parseFloat(p.tutar) || 0;
        total += tutar;
        paymentRows += `
            <tr>
                <td style="text-align:center; padding:8px; border:1px solid #ddd;">${index + 1}</td>
                <td style="padding:8px; border:1px solid #ddd;">${p.ay}${p.tur !== 'Ödeme' ? ' (' + p.tur + ')' : ''}</td>
                <td style="padding:8px; border:1px solid #ddd;">${p.tarih || '-'}</td>
                <td style="padding:8px; border:1px solid #ddd;">${p.dekont || '-'}</td>
                <td style="text-align:right; padding:8px; border:1px solid #ddd; font-weight:bold;">${tutar.toLocaleString('tr-TR')} ₺</td>
            </tr>
        `;
    });

    if (payments.length === 0) {
        paymentRows = '<tr><td colspan="5" style="text-align:center; padding:20px; border:1px solid #ddd;">Kayıtlı ödeme bulunamadı.</td></tr>';
    }

    const schoolName = currentSettings.school_name || 'Öğrenci Aidat Takip Sistemi';
    const logoUrl = currentSettings.school_logo || '';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>${s.ad} ${s.soyad} - Ödeme Dökümü</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; padding: 40px; }
                .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                .header-left { display: flex; align-items: center; gap: 20px; }
                .school-logo { max-height: 80px; }
                .school-name { font-size: 24px; font-weight: bold; }
                .report-title { font-size: 18px; text-transform: uppercase; border: 1px solid #333; padding: 10px 20px; }
                .student-info { margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .info-item { margin-bottom: 8px; font-size: 14px; }
                .info-label { font-weight: bold; width: 150px; display: inline-block; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
                th { background: #f4f4f4; padding: 10px; text-align: left; border: 1px solid #ddd; font-weight: bold; }
                .total-section { margin-top: 20px; text-align: right; font-size: 18px; font-weight: bold; }
                .footer { margin-top: 50px; display: flex; justify-content: space-between; font-size: 12px; font-style: italic; color: #666; }
                @media print {
                    .no-print { display: none; }
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-left">
                    ${logoUrl ? `<img src="${logoUrl}" class="school-logo">` : ''}
                    <div class="school-name">${schoolName}</div>
                </div>
                <div class="report-title">ÖĞRENCİ ÖDEME DÖKÜMÜ</div>
            </div>

            <div class="student-info">
                <div>
                    <div class="info-item"><span class="info-label">Ad Soyad:</span> ${s.ad} ${s.soyad}</div>
                    <div class="info-item"><span class="info-label">T.C. Kimlik No:</span> ${s.tc}</div>
                    <div class="info-item"><span class="info-label">Sınıf / No:</span> ${s.sinif || '-'} / ${s.no || '-'}</div>
                </div>
                <div>
                    <div class="info-item"><span class="info-label">Veli Adı:</span> ${s.baba_adi || s.anne_adi || '-'}</div>
                    <div class="info-item"><span class="info-label">Eğitim Türü:</span> ${formatEgitimTuru(s.egitim_turu)}</div>
                    <div class="info-item"><span class="info-label">Rapor Tarihi:</span> ${new Date().toLocaleDateString('tr-TR')}</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width:40px; text-align:center;">#</th>
                        <th>Ay / Tür</th>
                        <th>Ödeme Tarihi</th>
                        <th>Dekont No</th>
                        <th style="text-align:right;">Tutar</th>
                    </tr>
                </thead>
                <tbody>
                    ${paymentRows}
                </tbody>
            </table>

            <div class="total-section">
                Toplam Ödenen: ${total.toLocaleString('tr-TR')} ₺
            </div>

            <div class="footer">
                <div>Bu belge sistem tarafından otomatik olarak oluşturulmuştur.</div>
                <div>İmza / Kaşe</div>
            </div>

            <div class="no-print" style="margin-top: 30px; text-align: center;">
                <button onclick="window.print()" style="padding: 10px 30px; font-size: 16px; background: #2e7d32; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">Yazıcıya Gönder</button>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

async function hardReset() {
    const password = document.getElementById('reset-password')?.value?.trim();
    if (!password) {
        showToast('Lütfen onay şifresini girin!', 'error');
        return;
    }

    showDangerModal(
        '!!! DİKKAT !!!<br><br>Tüm verileriniz (öğrenciler, ödemeler, ekstreler, giderler) kalıcı olarak SİLİNECEKTİR.<br>Bu işlemin geri dönüşü yoktur. Onaylıyor musunuz?',
        async () => {
            showLoading('Sistem sıfırlanıyor...');
            try {
                const res = await fetch('/api/hard-reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                const data = await res.json();
                
                if (res.ok) {
                    showToast('Sistem başarıyla sıfırlandı.', 'success');
                    const passEl = document.getElementById('reset-password');
                    if (passEl) passEl.value = '';
                    
                    // Global değişkenleri temizle
                    allStudents = [];
                    allPayments = [];
                    allExpenses = [];
                    allStatements = [];
                    
                    await loadData();
                    showPage('dashboard');
                } else {
                    showToast(data.error || 'Sıfırlama başarısız. Şifre yanlış olabilir.', 'error');
                }
            } catch (e) {
                console.error(e);
                showToast('Bağlantı hatası.', 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

window.app = {
    handleSort, toggleTheme, switchMode, deleteSelectedStudents, deleteMonthlyPayments, deleteAllPayments,
    hardReset, loadData, loadMode, saveSettings, togglePaymentFields, handleLogoUpload,
    exportExpectedExcel, exportExpectedPDF, exportRaporExcel, exportRaporPDF,
    exportMatrixExcel, exportMatrixPDF, renderDashboardStats, renderDashboardUnpaid,
    addPayment, addStudent, renderExpectedPayments,
    filterStudents, showImportStudents, toggleSelectAll, filterMatrix, showTab,
    uploadStatement, clearStatements, processPastedData, filterHesap,
    renderMatches, saveMatchesAsPayments, exportMatchesExcel, exportMatchesPDF,
    renderRapor, showPage, openModal, closeModal, getSelectedTCs,
    showEditPayment, updatePayment, deletePayment, showAddPayment, showAddPaymentWithData,
    showEditStudent, updateStudent, showToast, downloadStudentTemplate, importStudents,
    deleteStudent, getMonthName,
    renderExpenses, saveStatementAsExpense, saveAllStatementExpenses, showAddExpense, addExpense, deleteExpense,
    deleteAllExpenses, exportExpensesExcel, exportExpensesPDF,
    showEditExpense, updateExpense,
    showStudentDetail, printStudentDetails, openMatrixQuickAdd, saveStudentAciklama,
    toggleMatrixFullScreen, setMatrixZoom,
    backupAll, backupStudents, restoreAll, restoreStudents,
    checkKVKK, acceptKVKK,
    renderMatrixFull: function() {
        renderMatrixInternal('');
    },
    cleanupDuplicates: function() {
        showDangerModal(
            'Tüm mükerrer kayıtlar taranacak ve aynı olanlar birleştirilecektir.<br><br>Bu işlem veritabanı yedeği alınmadan önerilmez. Devam edilsin mi?',
            async () => {
                showLoading('Mükerrer kayıtlar temizleniyor...');
                try {
                    const res = await fetch('/api/cleanup-duplicates', { method: 'POST' });
                    const data = await res.json();
                    if (res.ok) {
                        showToast(data.message || 'Temizlik tamamlandı.', 'success');
                        await loadData();
                    } else {
                        showToast(data.error || 'Temizlik sırasında hata oluştu.', 'error');
                    }
                } catch (e) {
                    console.error(e);
                    showToast('Bağlantı hatası.', 'error');
                } finally {
                    hideLoading();
                }
            }
        );
    }
};
window.app.currentDetailTc = '';

// ========== MATRİS GÖRÜNÜM AYARLARI ==========

function toggleMatrixFullScreen() {
    const page = document.getElementById('page-matris');
    const btn = document.getElementById('btn-matrix-fullscreen');
    if (!page) return;

    const isFS = page.classList.toggle('matrix-fullscreen');
    
    if (isFS) {
        btn.innerHTML = '<i class="fas fa-compress"></i> Normal Ekran';
        showToast('Tam ekran moduna geçildi.', 'info');
    } else {
        btn.innerHTML = '<i class="fas fa-expand"></i> Tam Ekran';
    }
}

function setMatrixZoom(value) {
    const wrapper = document.getElementById('matrix-zoom-wrapper');
    const valText = document.getElementById('zoom-value');
    if (wrapper) {
        wrapper.style.transform = `scale(${value})`;
        if (valText) valText.textContent = Math.round(value * 100) + '%';
    }
}

// ========== YEDEKLEMEve GERİ YÜKLEME ==========

function backupAll() {
    const a = document.createElement('a');
    a.href = '/api/backup/all';
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Tam yedek indiriliyor...', 'success');
}

function backupStudents() {
    const a = document.createElement('a');
    a.href = '/api/backup/students';
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Öğrenci listesi yedek indiriliyor...', 'success');
}

async function _doRestore(endpoint) {
    // KVKK Check
    const kvkkAccepted = localStorage.getItem('kvkk_accepted');
    if (!kvkkAccepted) {
        showToast('Lütfen önce KVKK şartlarını kabul edin.', 'error');
        checkKVKK();
        return;
    }

    const passwordInput = document.getElementById('restore-password');
    const password = passwordInput?.value?.trim();
    const fileInput = document.getElementById('restore-file');
    
    if (!password) { showToast('Lütfen ayarlar şifresi girin!', 'error'); return; }
    if (!fileInput || !fileInput.files[0]) { showToast('Lütfen bir yedek dosyası (.json) seçin!', 'error'); return; }

    const file = fileInput.files[0];
    const text = await file.text();
    let backup;
    try {
        backup = JSON.parse(text);
    } catch {
        showToast('Geçersiz JSON dosyası!', 'error');
        return;
    }

    if (!backup.data) { showToast('Geçersiz yedek formatı! (data alanı eksik)', 'error'); return; }

    showDangerModal(
        `<b>"${file.name}"</b> dosyasından geri yükleme yapılacak. <br><br>Mevcut veriler <b>silinecek</b>.<br><br>Onaylıyor musunuz?`,
        async () => {
            showLoading('Yedek geri yükleniyor, lütfen bekleyin...');
            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password, data: backup.data })
                });
                
                if (!res.ok) {
                    const result = await res.json();
                    showToast(result.error || 'Geri yükleme hatası!', 'error');
                    return;
                }

                showToast('Veriler başarıyla geri yüklendi.', 'success');
                
                // İşlem sonrası inputları temizle
                if (fileInput) fileInput.value = '';
                if (passwordInput) passwordInput.value = '';
                
                // Veriyi yenile
                await loadData();
                await loadSettings(); // Ayarları sayfaya yansıt ki inputlar inaktif / eski kalmasın
            } catch (e) {
                console.error('[RESTORE-ERROR]', e);
                showToast('Sunucu hatası: ' + e.message, 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

function restoreAll() { _doRestore('/api/restore/all'); }
function restoreStudents() { _doRestore('/api/restore/students'); }

async function autoSaveAllMatchedData() {
    showLoading('Eşleşen kayıtlar otomatik kaydediliyor...');
    try {
        let totalSaved = 0;
        
        // 1. Ödemeleri Kaydet
        if (pendingMatches.length > 0) {
            const payments = pendingMatches.map(m => ({
                tc: m.student.tc,
                ad_soyad: `${m.student.ad} ${m.student.soyad}`,
                ay: getMonthName(m.statement.tarih),
                tarih: m.statement.tarih,
                dekont: m.statement.kod,
                tutar: m.statement.tutar,
                tur: 'Ödeme'
            }));
            
            const res = await fetch('/api/payments/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payments })
            });
            if (res.ok) {
                const data = await res.json();
                totalSaved += (data.count || 0);
            }
        }
        
        // 2. Giderleri Kaydet (Otomatik olarak Diğer kategorisine)
        if (pendingExpenses.length > 0) {
            const expenses = pendingExpenses.map(s => ({
                ay: getMonthName(s.tarih),
                aciklama: s.aciklama,
                tarih: s.tarih,
                dekont: s.kod,
                tutar: s.tutar,
                kategori: 'Diğer'
            }));
            
            const res = await fetch('/api/expenses/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expenses })
            });
            if (res.ok) {
                const data = await res.json();
                totalSaved += (data.count || 0);
            }
        }
        
        if (totalSaved > 0) {
            showToast(`${totalSaved} kayıt otomatik olarak eşleştirildi ve kaydedildi.`, 'success');
            // Verileri yeniden yükle ki yeni eklenenler listeden düşsün
            await loadData();
        } else {
            showToast('Otomatik eşleşen yeni kayıt bulunamadı.', 'info');
            renderAll();
        }
    } catch (e) {
        console.error('[AUTO-SAVE-ERROR]', e);
        showToast('Otomatik kayıt sırasında hata oluştu.', 'error');
    } finally {
        hideLoading();
    }
}

async function saveAllStatementExpenses() {
    if (pendingExpenses.length === 0) {
        showToast('Kaydedilecek gider bulunamadı.', 'info');
        return;
    }
    
    showLoading('Tüm giderler kaydediliyor...');
    try {
        const expenses = pendingExpenses.map(s => ({
            ay: getMonthName(s.tarih),
            aciklama: s.aciklama,
            tarih: s.tarih,
            dekont: s.kod,
            tutar: s.tutar,
            kategori: 'Diğer'
        }));
        
        const res = await fetch('/api/expenses/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expenses })
        });
        
        if (res.ok) {
            showToast('Tüm giderler başarıyla kaydedildi.', 'success');
            await loadData();
        } else {
            showToast('Giderler kaydedilirken hata oluştu.', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Hata oluştu.', 'error');
    } finally {
        hideLoading();
    }
}
