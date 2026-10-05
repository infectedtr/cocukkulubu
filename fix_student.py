import sys

with open('public/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace renderStudentTable
start_idx = content.find('function renderStudentTable() {')
if start_idx != -1:
    end_idx = content.find('function toggleSelectAll() {', start_idx)
    
    new_render = """function renderStudentTable() {
    const tbody = document.getElementById("student-table");
    const countEl = document.getElementById("student-count");
    if (!tbody) return;
    
    const searchTerm = (document.getElementById('search-ogrenci') ? document.getElementById('search-ogrenci').value.toLowerCase() : '');
    
    let filtered = allStudents.filter(st => {
        const fullName = `${st.ad || ''} ${st.soyad || ''}`.toLowerCase();
        if (searchTerm && !fullName.includes(searchTerm) && !(st.tc||'').includes(searchTerm)) return false;
        return true;
    });
    
    if (countEl) countEl.innerText = `${filtered.length} Öğrenci`;

    tbody.innerHTML = "";
    filtered.forEach((st, index) => {
        const tr = document.createElement("tr");
        const veli = [st.anne_adi, st.baba_adi].filter(Boolean).join(' / ') || '-';
        tr.innerHTML = `
            <td><input type="checkbox" class="student-checkbox" data-tc="${st.tc}"></td>
            <td>${st.sira || (index + 1)}</td>
            <td style="font-weight:600">${st.ad || ''} ${st.soyad || ''}</td>
            <td>${st.tc || '-'}</td>
            <td>${veli}</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>
                <button class="btn" style="padding:4px 8px;font-size:11px" onclick="showToast('Detay görüntüleme yakında eklenecek','info')">👁</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

"""
    content = content[:start_idx] + new_render + content[end_idx:]

# Replace downloadStudentTemplate
start_idx2 = content.find('function downloadStudentTemplate() {')
if start_idx2 != -1:
    end_idx2 = content.find('}', start_idx2) + 1
    
    new_template = """function downloadStudentTemplate() {
    if (typeof XLSX === 'undefined') {
        showToast('XLSX kütüphanesi yüklenemedi.', 'error');
        return;
    }
    const ws = XLSX.utils.aoa_to_sheet([
        ["Sira", "Ad", "Soyad", "TC", "Anne Adi", "Baba Adi"],
        [1, "Ali", "Yılmaz", "12345678901", "Ayşe", "Mehmet"]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ogrenciler");
    XLSX.writeFile(wb, "Ogrenci_Sablonu.xlsx");
    showToast('Şablon indirildi.', 'success');
}"""
    content = content[:start_idx2] + new_template + content[end_idx2:]

with open('public/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixes applied to app.js")
