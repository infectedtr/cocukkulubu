/**
 * app.js – Front‑end logic for Zübeyde Hanım Çocuk Kulübü Aidat Takip Sistemi
 * Handles theme, mode toggle, data loading, rendering, and the new delete/hard‑reset actions.
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
    if (lblSabahci) lblSabahci.innerText = isKulup ? "İndirimli Ücret (₺)" : "Sabahçı Ücreti (₺)";
    if (lblTam) lblTam.innerText = isKulup ? "Kulüp Ücreti (₺)" : "Tam Gün Ücreti (₺)";

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
    if (currentMode !== 'kulup') {
        return { expected, paid, diff: paid - expected, isFamily: false, bridged: !!(p && p.ay !== month), p };
    }

    const siblings = sibGetter(student);
    if (siblings.length === 0) {
        return { expected, paid, diff: paid - expected, isFamily: false, bridged: !!(p && p.ay !== month), p };
    }

    const family = [student, ...siblings];
    let familyExpected = 0;

    // Kulüp modunda kardeş indirimi: En büyük ücret tam, diğerleri %50 indirimli.
    let fees = family.map(f => getExpectedFee(f, month)).sort((a, b) => b - a);
    familyExpected = fees[0];
    for (let i = 1; i < fees.length; i++) familyExpected += fees[i] * 0.5;

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
    document.body.setAttribute('data-mode', newMode);
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
        } else {
            showToast(data.error || "Mod değiştirilemedi.", "error");
            // revert UI toggle to previous state
            if (toggle) toggle.checked = currentMode === "doner";
        }
    } catch (e) {
        console.error(e);
        showToast("Mod değiştirirken hata oluştu.", "error");
    }
}

// ---------- Data loading ----------
async function loadData() {
    const t = Date.now();
    const [studentsRes, paymentsRes, statementsRes, expensesRes] = await Promise.all([
        fetch(`/api/students?t=${t}`),
        fetch(`/api/payments?t=${t}`),
        fetch(`/api/statements?t=${t}`),
        fetch(`/api/expenses?t=${t}`)
    ]);
    const studentsData = await studentsRes.json();
    const paymentsData = await paymentsRes.json();
    const statementsData = await statementsRes.json();
    const expensesData = await expensesRes.json();

    allStudents = Array.isArray(studentsData) ? studentsData : (studentsData.students || []);
    let rawPayments = Array.isArray(paymentsData) ? paymentsData : (paymentsData.payments || []);
    allPayments = rawPayments.sort((a, b) => b.id - a.id);

    allStatements = Array.isArray(statementsData) ? statementsData : (statementsData.statements || []);
    allExpenses = Array.isArray(expensesData) ? expensesData : [];

    renderStudentTable();
    renderPaymentsTable();
    renderStatementsTable();
    renderMatrix();
    renderSiblingList();
    renderExpenses();
    renderRapor();
    renderDashboardUnpaid();
    renderDashboardStats();
    renderExpectedPayments();
    setDefaultMonths();
    updateStats();
}

function updateStats() {
    const footerStats = document.getElementById('sidebar-stats');
    if (footerStats) {
        footerStats.innerHTML = `<span style="color:var(--accent)">●</span> ${currentMode === 'kulup' ? 'Kulüp' : 'DÖSE'}<br>${allStudents.length} Öğrenci | ${allExpenses.length} Gider`;
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
                    <button class="btn" style="padding:6px; font-size:12px; background:rgba(255,255,255,0.05); border:1px solid var(--border)" onclick="app.showEditStudent('${st.tc}')" title="Düzenle">✏️</button>
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
    loadData();
    // Update header logo and global title after mode is known
    // (loadMode will call updateHeaderLogo/updateGlobalHeader)
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

    const recent = allPayments.slice(0, 15);
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
        if (sortVal === 'date-desc' || sortVal === 'date-asc') {
            const [da, ma, ya] = (a.tarih || '01.01.2000').split('.');
            const [db, mb, yb] = (b.tarih || '01.01.2000').split('.');
            const dateA = new Date(ya, ma - 1, da);
            const dateB = new Date(yb, mb - 1, db);
            return sortVal === 'date-desc' ? dateB - dateA : dateA - dateB;
        }
        if (sortVal === 'amount-desc') return b.tutar - a.tutar;
        if (sortVal === 'amount-asc') return a.tutar - b.tutar;
        if (sortVal === 'cat-asc') return (a.kategori || '').localeCompare(b.kategori || '');
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

async function deleteExpense(id) {
    if (!confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) return;
    try {
        const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Gider silindi.', 'success');
            await loadData();
        }
    } catch (e) {
        showToast('Silme hatası.', 'error');
    }
}

// ---------- UI Interaction ----------
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-page') === page);
    });
    const titleMap = { dashboard: 'Gösterge Paneli', ogrenciler: 'Öğrenciler', matris: 'Tüm Aylar Matrisi', hesap: 'Banka Ekstresi', eslestir: 'Dekont Eşleştirme', rapor: 'Ay Bazlı Rapor', beklenen: 'Ödeme Beklenen', kardesler: 'Kardeş Listesi', ayarlar: 'Ayarlar', kilavuz: 'Kullanım Kılavuzu', giderler: 'Gider Takibi' };
    const subMap = { dashboard: 'Genel özet ve istatistikler', ogrenciler: 'Öğrenci listesi ve işlemler', matris: 'Ödeme matrisi', hesap: 'Banka ekstre yönetimi', eslestir: 'Dekont eşleştirme', rapor: 'Aylara göre raporlar', beklenen: 'Ödeme bekleyen öğrenciler', kardesler: 'Kardeş ilişkileri', ayarlar: 'Uygulama ayarları', kilavuz: 'Sistem nasıl kullanılır?', giderler: 'Aylık harcama ve gider yönetimi' };
    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-sub');
    if (titleEl) titleEl.innerText = titleMap[page] || '';
    if (subEl) subEl.innerText = subMap[page] || '';

    if (page === 'hesap') renderStatementsTable();
    if (page === 'eslestir') renderMatches();
    if (page === 'matris') renderMatrix();
    if (page === 'kardesler') renderSiblingList();
    if (page === 'rapor') renderRapor();
    if (page === 'beklenen') renderExpectedPayments();
    if (page === 'giderler') renderExpenses();
}

function showTab(section, tab, ev) {
    const parent = ev.target.closest('.card, .modal-body, .page');
    if (!parent) return;
    parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    ev.target.classList.add('active');

    parent.querySelectorAll('.tab-content').forEach(c => {
        if (c.id.includes(section)) c.classList.remove('active');
    });
    const targetId = `tab-${section}-${tab}`;
    const targetContent = document.getElementById(targetId);
    if (targetContent) targetContent.classList.add('active');
}

function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('open');
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
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
    if (!confirm('Bu ödeme kaydı silinecek. Emin misiniz?')) return;
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
}

function showImportStudents() {
    const m = document.getElementById('add-student-modal');
    if (m) {
        m.classList.add('open');
        // Toplu tabını seçelim
        const bulkBtn = m.querySelector('.tab-btn[onclick*="bulk"]');
        if (bulkBtn) bulkBtn.click();
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
            showToast('Öğrenci eklenemedi.', 'error');
        }
    } catch (e) {
        showToast('Hata oluştu.', 'error');
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
    const fileInp = document.getElementById('student-import-file');
    if (!fileInp.files[0]) return;

    const formData = new FormData();
    formData.append('file', fileInp.files[0]);

    try {
        const res = await fetch('/api/students/import', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || 'Öğrenciler aktarıldı.', 'success');
            closeModal('add-student-modal');
            await loadData();
        } else {
            showToast(data.error || 'Aktarım başarısız.', 'error');
        }
    } catch (e) {
        showToast('Hata oluştu.', 'error');
    }
    fileInp.value = '';
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

// ---------- Bank Statements ----------
async function uploadStatement() {
    const fileInp = document.getElementById('statement-file');
    if (!fileInp.files[0]) return;

    const formData = new FormData();
    formData.append('file', fileInp.files[0]);

    try {
        const res = await fetch('/api/upload-statement', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message || 'Ekstre yüklendi.', 'success');
            await loadData();
            renderStatementsTable();
        } else {
            showToast(data.error || 'Yükleme başarısız.', 'error');
        }
    } catch (e) {
        showToast('Hata oluştu.', 'error');
    }
    fileInp.value = '';
}

async function processPastedData() {
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

async function renderMatches() {
    const tbody = document.getElementById('match-table');
    const tbodyExp = document.getElementById('match-expense-table');
    const countEl = document.getElementById('match-count');
    const countElExp = document.getElementById('match-expense-count');
    const monthFilter = document.getElementById('match-month-filter') ? document.getElementById('match-month-filter').value : 'all';

    if (!tbody || !tbodyExp) return;

    const existingDekonts = new Set(allPayments.map(p => p.dekont));
    const existingExpenseDekonts = new Set(allExpenses.map(e => e.dekont));

    pendingMatches = [];
    pendingExpenses = [];

    allStatements.forEach(s => {
        if (monthFilter !== 'all' && s.tarih) {
            const parts = s.tarih.split(/[./-]/);
            if (parts.length >= 2 && parts[1] !== monthFilter) return;
        }

        if (s.tur === 'Gelir') {
            if (existingDekonts.has(s.kod)) return;

            const desc = (s.aciklama || '').toLocaleUpperCase('tr-TR');
            let matchedStudent = null;

            for (let st of allStudents) {
                const ad = (st.ad || '').toLocaleUpperCase('tr-TR');
                const soyad = (st.soyad || '').toLocaleUpperCase('tr-TR');
                const tamAd = `${ad} ${soyad}`;
                const tc = st.tc || '';
                const anne = (st.anne_adi || '').toLocaleUpperCase('tr-TR');
                const baba = (st.baba_adi || '').toLocaleUpperCase('tr-TR');

                if (
                    (tamAd.length > 3 && desc.includes(tamAd)) ||
                    (tc.length > 8 && desc.includes(tc)) ||
                    (anne.length > 4 && desc.includes(anne) && soyad.length > 2 && desc.includes(soyad)) ||
                    (baba.length > 4 && desc.includes(baba) && soyad.length > 2 && desc.includes(soyad))
                ) {
                    matchedStudent = st;
                    break;
                }
            }

            if (matchedStudent) {
                pendingMatches.push({ statement: s, student: matchedStudent });
            }
        } else if (s.tur === 'Gider') {
            if (existingExpenseDekonts.has(s.kod)) return;
            pendingExpenses.push(s);
        }
    });

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
    window.print();
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
            const siblingPaid = (currentMode === 'kulup') && siblings.some(sib => {
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

    const yearSetting = document.getElementById('settings-year');
    const yearText = yearSetting ? yearSetting.value : new Date().getFullYear() + "-" + (new Date().getFullYear() + 1);
    const startYear = parseInt(yearText.split('-')[0]) || new Date().getFullYear();

    const months = ['AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK', 'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ'];
    const searchTerm = (document.getElementById('search-matris') ? document.getElementById('search-matris').value.toLocaleUpperCase('tr-TR') : '');

    const monthBoundaries = {};
    months.forEach(m => {
        monthBoundaries[m] = getMonthBoundary(m, startYear);
    });

    const sortIcon = (key) => {
        if (sortState.matrix.key !== key) return '↕️';
        return sortState.matrix.dir === 'asc' ? '🔼' : '🔽';
    };

    header.innerHTML = `
        <th onclick="app.handleSort('matrix', 'ad')" style="cursor:pointer">Öğrenci ${sortIcon('ad')}</th>
    `;
    months.forEach(m => { header.innerHTML += `<th>${m}</th>`; });
    header.innerHTML += `<th onclick="app.handleSort('matrix', 'total')" style="cursor:pointer">Toplam ${sortIcon('total')}</th>`;

    // Performans için önbellekleme
    const payMap = {};
    allPayments.forEach(p => {
        if (!payMap[p.tc]) payMap[p.tc] = {};
        if (!payMap[p.tc][p.ay]) payMap[p.tc][p.ay] = [];
        payMap[p.tc][p.ay].push(p);
    });

    const getCachedEffectivePayment = (tc, month) => {
        let matching = (payMap[tc] && payMap[tc][month]) ? payMap[tc][month] : [];
        if (matching.length === 0) {
            if (month === 'AĞUSTOS') matching = (payMap[tc] && payMap[tc]['EYLÜL']) ? payMap[tc]['EYLÜL'] : [];
            else if (month === 'EYLÜL') matching = (payMap[tc] && payMap[tc]['AĞUSTOS']) ? payMap[tc]['AĞUSTOS'] : [];
        }
        return mergePayments(matching);
    };

    const siblingMap = {};
    allStudents.forEach(s => {
        if (!siblingMap[s.tc]) {
            const siblings = allStudents.filter(other =>
                other.tc !== s.tc &&
                (other.anne_adi && other.anne_adi !== "" && other.anne_adi === s.anne_adi) &&
                (other.baba_adi && other.baba_adi !== "" && other.baba_adi === s.baba_adi)
            );
            siblingMap[s.tc] = siblings;
        }
    });

    // Matris verisini hazırlayalım
    const filteredStudents = allStudents.filter(s => {
        const name = `${s.ad} ${s.soyad}`.toLocaleUpperCase('tr-TR');
        return name.includes(searchTerm) || (s.tc && s.tc.includes(searchTerm));
    });

    const matrixData = filteredStudents.map(s => {
        let total = 0;
        const girisDate = s.giris_tarihi ? new Date(s.giris_tarihi) : null;
        const cikisDate = s.cikis_tarihi ? new Date(s.cikis_tarihi) : null;

        const rowCells = months.map(m => {
            const p = getCachedEffectivePayment(s.tc, m);
            if (p && p.tur === 'Ödeme' && p.ay === m) {
                total += parseFloat(p.tutar || 0);
            }
            return { month: m, payment: p };
        });
        return {
            student: s,
            total: total,
            ad: `${s.ad} ${s.soyad}`,
            cells: rowCells,
            girisDate,
            cikisDate
        };
    });

    // Sıralama uygula
    matrixData.sort((a, b) => {
        let valA = a[sortState.matrix.key];
        let valB = b[sortState.matrix.key];
        if (typeof valA === 'string') {
            return sortState.matrix.dir === 'asc' ? valA.localeCompare(valB, 'tr') : valB.localeCompare(valA, 'tr');
        }
        return sortState.matrix.dir === 'asc' ? valA - valB : valB - valA;
    });

    let html = '';
    matrixData.forEach((item, idx) => {
        const s = item.student;
        const egitimLabel = formatEgitimTuru(s.egitim_turu);
        const isDiscounted = egitimLabel === 'İNDİRİMLİ' || egitimLabel === 'SABAHÇI';
        const siblings = siblingMap[s.tc] || [];

        let rowHtml = `<tr class="matrix-row ${idx % 2 === 0 ? 'matrix-row-even' : 'matrix-row-odd'}">
            <td style="padding-left:15px;">
                <div class="matrix-student-name">
                    <div class="matrix-student-main">
                        ${s.ad} ${s.soyad}
                        <span onclick="app.showEditStudent('${s.tc}')" style="cursor:pointer; margin-left:5px; font-size:12px; opacity:0.6;" title="Öğrenciyi Düzenle">✏️</span>
                        ${isDiscounted ? `<span style="font-size:9px; padding:2px 5px; background:rgba(56,139,253,0.15); color:#388bfd; border-radius:4px; font-weight:700">${currentMode === 'kulup' ? 'İNDİRİM' : 'SABAH'}</span>` : ''}
                        ${(currentMode === 'kulup' && siblings.length > 0) ? `<span class="badge badge-matched" style="font-size:9px; padding:1px 4px">KARDEŞ</span>` : ''}
                    </div>
                </div>
            </td>`;

        item.cells.forEach(c => {
            const m = c.month;
            const p = c.payment;
            let isMergedPaid = !!(p && p.ay !== m);

            if (p) {
                if (p.tur === 'Raporlu' || p.tur === 'İzinli') {
                    let noteIndicator = p.notlar ? '<span style="position:absolute; top:2px; right:2px; font-size:8px; color:var(--accent);">📝</span>' : '';
                    rowHtml += `<td class="cell-sibling" title="${p.tur}${p.notlar ? '\nNot: ' + p.notlar : ''}" onclick="app.showEditPayment(${p.id})" style="position:relative; cursor:pointer;"><span class="matrix-cell" style="background:rgba(255, 152, 0, 0.1); color:#ff9800; border-color:rgba(255, 152, 0, 0.3)">${noteIndicator}${p.tur.charAt(0)}</span></td>`;
                } else if (isMergedPaid) {
                    rowHtml += `<td class="cell-paid" style="background:rgba(56, 139, 253, 0.1);" title="[MUAF] ${p.ay} ödemesi ile muaf: ${p.tarih} - ${p.tutar} ₺"><span class="matrix-cell" style="color:#0969da; border-color:rgba(56, 139, 253, 0.4)">MUAF</span></td>`;
                } else {
                    const info = getFamilyPaymentInfo(s, m, getCachedEffectivePayment, (st) => siblingMap[st.tc] || []);
                    let cellClass = (info.diff < 0) ? 'cell-partial' : (info.diff > 0 ? 'cell-overpaid' : 'cell-paid');
                    let cellText = (info.diff !== 0) ? `${info.diff > 0 ? '+' : ''}${info.diff} ₺` : '✓';
                    let noteIndicator = p.notlar ? '<span style="position:absolute; top:2px; right:2px; font-size:8px; color:var(--accent);">📝</span>' : '';
                    rowHtml += `<td class="${cellClass}" onclick="app.showEditPayment(${p.id})" style="position:relative; cursor:pointer;" title="${p.tarih} - ${p.tutar} ₺${info.isFamily ? ' (Aile İndirimi)' : ''}">
                        ${noteIndicator}<span class="matrix-cell" style="${cellText !== '✓' ? 'font-size:10px; font-weight:700;' : ''}">${cellText}</span>
                    </td>`;
                }
            } else {
                const bounds = monthBoundaries[m];
                let active = true;
                if (item.girisDate && item.girisDate > bounds.end) active = false;
                if (item.cikisDate && item.cikisDate < bounds.start) active = false;

                if (!active) {
                    rowHtml += `<td class="cell-unpaid" style="background:rgba(0,0,0,0.05);" title="Bu ayda kayıtlı değil"><span class="matrix-cell" style="color:#888; font-size:10px;">KAYITSIZ</span></td>`;
                } else {
                    const info = getFamilyPaymentInfo(s, m, getCachedEffectivePayment, (st) => siblingMap[st.tc] || []);
                    if (info.isFamily && info.paid > 0) {
                        rowHtml += `<td class="${info.diff >= 0 ? 'cell-sibling' : 'cell-partial'}" title="Kardeşi üzerinden aile ödemesi"><span class="matrix-cell">KARDEŞ</span></td>`;
                    } else {
                        rowHtml += `<td class="cell-unpaid"><span class="matrix-cell">—</span></td>`;
                    }
                }
            }
        });
        rowHtml += `<td style="font-weight:700">${item.total} ₺</td></tr>`;
        html += rowHtml;
    });
    body.innerHTML = html;
    // FOOTER: Sütun Toplamları (Global İstatistikler)
    let existingFooter = body.parentNode.querySelector('tfoot');
    if (existingFooter) existingFooter.remove();

    const footer = document.createElement('tfoot');
    let footerHtml = `<tr style="background:var(--surface2); font-weight:700">
        <td style="text-align:right; padding-right:15px;">TOPLAM TAHSİLAT:</td>`;

    let grandTotal = 0;
    // Global İstatistikleri tek seferde hesapla
    const stats = {};
    months.forEach(m => stats[m] = { total: 0, tcs: new Set() });

    allPayments.forEach(p => {
        if (stats[p.ay] && p.tur === 'Ödeme') {
            stats[p.ay].total += parseFloat(p.tutar || 0);
            stats[p.ay].tcs.add(p.tc);
        }
    });

    months.forEach(m => {
        const s = stats[m];
        footerHtml += `<td>${s.total} ₺</td>`;
        grandTotal += s.total;
    });
    footerHtml += `<td>${grandTotal} ₺</td></tr>`;

    // İkinci Satır: Kişi Sayısı
    footerHtml += `<tr style="background:var(--surface); font-size:11px; color:var(--text3)">
        <td style="text-align:right; padding-right:15px;">ÖDEYEN KİŞİ SAYISI:</td>`;
    months.forEach(m => {
        footerHtml += `<td>${stats[m].tcs.size} Kişi</td>`;
    });
    footerHtml += `<td>-</td></tr>`;

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
                    const siblingPaid = (currentMode === 'kulup') && siblings.some(sib => !!getEffectivePayment(sib.tc, m));
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
        if (p.dekont && p.dekont.trim() !== '') {
            const d = p.dekont.trim().toUpperCase();
            dekontCounts[d] = (dekontCounts[d] || 0) + 1;
        }
    });

    // 2. Aylık Liste (Filtered)
    const listeHeader = document.querySelector('#tab-rapor-liste thead tr');
    const sortIcon = (tbl, key) => {
        if (sortState[tbl].key !== key) return '↕️';
        return sortState[tbl].dir === 'asc' ? '🔼' : '🔽';
    };

    if (listeHeader) {
        listeHeader.innerHTML = `
            <th onclick="app.handleSort('raporListe', 'ad_soyad')" style="cursor:pointer">Öğrenci ${sortIcon('raporListe', 'ad_soyad')}</th>
            <th onclick="app.handleSort('raporListe', 'tc')" style="cursor:pointer">TC ${sortIcon('raporListe', 'tc')}</th>
            <th onclick="app.handleSort('raporListe', 'tarih')" style="cursor:pointer">Tarih ${sortIcon('raporListe', 'tarih')}</th>
            <th onclick="app.handleSort('raporListe', 'dekont')" style="cursor:pointer">Dekont ${sortIcon('raporListe', 'dekont')}</th>
            <th onclick="app.handleSort('raporListe', 'tutar')" style="cursor:pointer">Tutar ${sortIcon('raporListe', 'tutar')}</th>
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
    filteredPays.forEach(p => {
        listeSum += parseFloat(p.tutar || 0);
        const isDuplicate = p.dekont && p.dekont.trim() !== '' && dekontCounts[p.dekont.trim().toUpperCase()] > 1;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.ad_soyad || p.tc}</td>
            <td>${p.tc || '-'}</td>
            <td>${p.tarih}</td>
            <td><span class="code-badge ${isDuplicate ? 'duplicate' : ''}" ${isDuplicate ? 'title="Bu dekont numarası birden fazla kullanılmış!"' : ''}>${p.dekont}</span></td>
            <td class="amount positive">${p.tutar} ₺</td>
            <td>
                <button class="btn" style="padding:2px 6px; font-size:10px" onclick="app.showEditPayment(${p.id})">✏️</button>
                <button class="btn btn-danger" style="padding:2px 6px; font-size:10px" onclick="app.deletePayment(${p.id})">🗑</button>
            </td>
        `;
        listeBody.appendChild(tr);
    });
    if (listeFooter) {
        listeFooter.innerHTML = `<tr style="background:var(--surface2); font-weight:700">
            <td colspan="4">TOPLAM</td>
            <td class="amount positive" style="font-size:16px">${listeSum} ₺</td>
        </tr>`;
    }

    // 3. Öğrenci Bazlı Özet
    const ogrenciHeader = document.querySelector('#tab-rapor-ogrenci thead tr');
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

    const ogrenciReportData = allStudents.map(s => {
        const pays = allPayments.filter(p => p.tc === s.tc && p.tur === 'Ödeme');
        const effectivePaysForSelected = pays.filter(p => {
            if (selectedMonth === 'all') return true;
            if (p.ay === selectedMonth) return true;
            if (selectedMonth === 'AĞUSTOS' && p.ay === 'EYLÜL') return true;
            if (selectedMonth === 'EYLÜL' && p.ay === 'AĞUSTOS') return true;
            return false;
        });
        const sum = effectivePaysForSelected.reduce((acc, p) => acc + parseFloat(p.tutar || 0), 0);

        // Ödenen her bir ay için o ayın beklenen ücretini topla
        const monthsPaid = new Set(effectivePaysForSelected.map(p => (selectedMonth !== 'all' ? selectedMonth : p.ay)));
        let expectedTotal = 0;
        monthsPaid.forEach(m => {
            expectedTotal += getExpectedFee(s, m);
        });

        return { student: s, sum: sum, months: monthsPaid.size, expectedTotal: expectedTotal, ad: `${s.ad} ${s.soyad}` };
    }).filter(item => {
        if (searchTerm && !item.ad.toLowerCase().includes(searchTerm) && !item.student.tc.includes(searchTerm)) return false;
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
        const s = item.student;
        const sum = item.sum;
        const uniqueMonths = item.months;
        const studentExpected = item.expectedTotal; // Önceden hesaplanmış toplam beklenen

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

        tr.innerHTML = `
            <td>${s.ad} ${s.soyad} <br> <small style="color:var(--text3)">${s.egitim_turu || 'TAM GÜN'}</small></td>
            <td>${s.tc}</td>
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

    const content = `
        <html>
        <head>
            <title>Aidat Raporu - ${selectedMonth}</title>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                th { background-color: #f2f2f2; }
                h2 { text-align: center; }
                @media print { @page { margin: 0; } body { margin: 1.6cm; } }
            </style>
        </head>
        <body>
            <h2>Aidat Ödeme Raporu (${selectedMonth})</h2>
            <table>
                <thead>
                    <tr>
                        <th>Öğrenci</th>
                        <th>TC</th>
                        <th>Ay</th>
                        <th>Tarih</th>
                        <th>Dekont</th>
                        <th>Tutar</th>
                        <th>Notlar</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(p => `
                        <tr>
                            <td>${p.ad_soyad}</td>
                            <td>${p.tc}</td>
                            <td>${p.ay}</td>
                            <td>${p.tarih}</td>
                            <td>${p.dekont}</td>
                            <td style="text-align:right">${p.tutar} ₺</td>
                            <td>${p.notlar || ''}</td>
                        </tr>
                    `).join('')}
                    <tr style="background:#f9f9f9; font-weight:700">
                        <td colspan="5" style="text-align:right; border:1px solid #ddd; padding:8px">GENEL TOPLAM:</td>
                        <td style="text-align:right; border:1px solid #ddd; padding:8px">${totalAmount.toLocaleString('tr-TR')} ₺</td>
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
        const settings = await res.json();
        currentSettings = settings;
        if (document.getElementById('settings-name')) document.getElementById('settings-name').value = settings.school_name || '';
        if (document.getElementById('settings-logo')) {
            const val = settings.school_logo || '';
            document.getElementById('settings-logo').value = val;
            const preview = document.getElementById('settings-logo-preview');
            if (preview) {
                if (val.startsWith('data:image/')) {
                    preview.src = val;
                    preview.style.display = 'block';
                } else {
                    preview.style.display = 'none';
                    preview.src = '';
                }
            }
        }
        if (document.getElementById('settings-year')) document.getElementById('settings-year').value = settings.school_year || '';
        if (document.getElementById('setting-ucret-sabahci')) document.getElementById('setting-ucret-sabahci').value = settings.ucret_sabahci || '';
        if (document.getElementById('setting-ucret-tam-gun')) document.getElementById('setting-ucret-tam-gun').value = settings.ucret_tam_gun || '';
        if (document.getElementById('setting-ucret-sabahci-2')) document.getElementById('setting-ucret-sabahci-2').value = settings.ucret_sabahci_2 || '';
        if (document.getElementById('setting-ucret-tam-gun-2')) document.getElementById('setting-ucret-tam-gun-2').value = settings.ucret_tam_gun_2 || '';

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
    const name = document.getElementById('settings-name').value;
    const logo = document.getElementById('settings-logo').value;
    const year = document.getElementById('settings-year').value;
    const sabahci = document.getElementById('setting-ucret-sabahci').value;
    const tamgun = document.getElementById('setting-ucret-tam-gun').value;
    const newPass = document.getElementById('settings-new-pass').value;
    const password = document.getElementById('settings-current-pass').value;

    if (!password) { showToast('Lütfen onay için mevcut şifreyi girin.', 'error'); return; }

    const settingsObj = {
        school_name: name,
        school_logo: logo,
        school_year: year,
        ucret_sabahci: sabahci,
        ucret_tam_gun: tamgun,
        ucret_sabahci_2: document.getElementById('setting-ucret-sabahci-2').value,
        ucret_tam_gun_2: document.getElementById('setting-ucret-tam-gun-2').value
    };
    if (newPass) settingsObj.settings_password = newPass;

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password,
                settings: settingsObj
            })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Ayarlar kaydedildi.', 'success');
            document.getElementById('settings-current-pass').value = '';
            document.getElementById('settings-new-pass').value = '';
            await loadSettings();
            updateHeaderLogo(); // Refresh UI if name/logo changed
        } else {
            showToast(data.error || 'Hata oluştu.', 'error');
        }
    } catch (e) { showToast('Hata oluştu.', 'error'); }
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
                const siblingPaid = (currentMode === 'kulup') && siblings.some(sib => !!getEffectivePayment(sib.tc, m));
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
                const siblingPaid = (currentMode === 'kulup') && siblings.some(sib => !!getEffectivePayment(sib.tc, m));
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
    showEditPayment, updatePayment, deletePayment, showAddPayment,
    showEditStudent, updateStudent, showToast, downloadStudentTemplate, importStudents,
    deleteStudent,
    renderExpenses, saveStatementAsExpense, saveAllStatementExpenses, showAddExpense, addExpense, deleteExpense,
    showEditExpense, updateExpense
};
