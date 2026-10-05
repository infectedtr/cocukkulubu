import os

with open('public/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace renderMatches and saveMatchesAsPayments
import re

start_idx = content.find('async function renderMatches() {')
if start_idx != -1:
    end_idx = content.find('function filterStudents() {', start_idx)
    
    new_code = """let pendingMatches = [];

function getMonthName(dateStr) {
    if(!dateStr) return 'BİLİNMİYOR';
    const parts = dateStr.split(/[./-]/);
    if(parts.length >= 2) {
        const m = parts[1];
        const names = {'01':'OCAK', '02':'ŞUBAT', '03':'MART', '04':'NİSAN', '05':'MAYIS', '06':'HAZİRAN', '07':'TEMMUZ', '08':'AĞUSTOS', '09':'EYLÜL', '10':'EKİM', '11':'KASIM', '12':'ARALIK'};
        return names[m] || 'BİLİNMİYOR';
    }
    return 'BİLİNMİYOR';
}

async function renderMatches() {
    const tbody = document.getElementById('match-table');
    const countEl = document.getElementById('match-count');
    const monthFilter = document.getElementById('match-month-filter') ? document.getElementById('match-month-filter').value : 'all';
    
    if(!tbody) return;
    
    const existingDekonts = new Set(allPayments.map(p => p.dekont));
    pendingMatches = [];
    
    allStatements.forEach(s => {
        if (s.tur !== 'Gelir' || existingDekonts.has(s.kod)) return;
        
        if (monthFilter !== 'all' && s.tarih) {
            const parts = s.tarih.split(/[./-]/);
            if (parts.length >= 2 && parts[1] !== monthFilter) return; 
        }
        
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
    });
    
    tbody.innerHTML = '';
    if(countEl) countEl.innerText = `${pendingMatches.length} Eşleşme`;
    
    pendingMatches.forEach((m, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx+1}</td>
            <td>${m.student.ad} ${m.student.soyad}</td>
            <td>${m.student.tc || '-'}</td>
            <td>${m.statement.tarih}</td>
            <td><span class="code-badge">${m.statement.kod}</span></td>
            <td class="amount positive">${m.statement.tutar} ₺</td>
        `;
        tbody.appendChild(tr);
    });
}

async function saveMatchesAsPayments() {
    if (pendingMatches.length === 0) {
        showToast('Kaydedilecek eşleşme yok.', 'info');
        return;
    }
    if (!confirm(`${pendingMatches.length} adet otomatik eşleşme sisteme ödeme olarak kaydedilecek. Emin misiniz?`)) return;
    
    let successCount = 0;
    for (let m of pendingMatches) {
        const ay = getMonthName(m.statement.tarih);
        const tc = m.student.tc;
        const ad_soyad = `${m.student.ad} ${m.student.soyad}`;
        const tarih = m.statement.tarih;
        const dekont = m.statement.kod;
        const tutar = m.statement.tutar;
        
        try {
            const res = await fetch('/api/payments', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ tc, ay, tarih, dekont, tutar, ad_soyad })
            });
            if(res.ok) successCount++;
        } catch(e) { console.error(e); }
    }
    
    showToast(`${successCount} ödeme başarıyla kaydedildi.`, 'success');
    await loadData();
    renderMatches();
}

"""
    
    # We also need to remove the stub function for saveMatchesAsPayments if it exists further down
    content = content[:start_idx] + new_code + content[end_idx:]
    
    # Remove the stub `function saveMatchesAsPayments() { showToast(...) }`
    content = re.sub(r'function saveMatchesAsPayments\(\) \{[^\}]+\}', '', content)

    with open('public/app.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Match logic updated successfully.")
else:
    print("Could not find renderMatches.")
