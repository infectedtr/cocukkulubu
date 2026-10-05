const fs = require('fs');
let content = fs.readFileSync('app.js', 'latin1');

// Helper for normalization
const normalizeText = (text) => {
    return (text || '')
        .toLocaleUpperCase('tr-TR')
        .replace(/İ/g, 'I')
        .replace(/Ş/g, 'S')
        .replace(/Ğ/g, 'G')
        .replace(/Ü/g, 'U')
        .replace(/Ö/g, 'O')
        .replace(/Ç/g, 'C')
        .trim();
};

// 1. Update renderStatementsTable
const newRenderStatementsTable = `function renderStatementsTable() {
      const tbody = document.getElementById("hesap-table");
      const countEl = document.getElementById("hesap-count");
      if (!tbody) return;
      tbody.innerHTML = "";
  
      const searchTerm = (document.getElementById('search-hesap') ? document.getElementById('search-hesap').value.toLowerCase() : '');
      const filterTur = (document.getElementById('filter-hesap-tur') ? document.getElementById('filter-hesap-tur').value : '');
      const filterMonth = (document.getElementById('filter-hesap-month') ? document.getElementById('filter-hesap-month').value : 'all');
  
      let filtered = allStatements.filter(s => {
          if (searchTerm && !s.aciklama.toLowerCase().includes(searchTerm) && !s.kod.toLowerCase().includes(searchTerm)) return false;
          if (filterTur === 'gelir' && s.tur !== 'Gelir') return false;
          if (filterTur === 'gider' && s.tur !== 'Gider') return false;
          if (filterMonth !== 'all' && s.tarih) {
              const parts = s.tarih.split(/[./-]/);
              if (parts.length >= 2 && parts[1] !== filterMonth) return false;
          }
          return true;
      });

      // Sort by date descending
      filtered.sort((a, b) => {
          const parseDate = (d) => {
              if (!d) return 0;
              const p = d.split(/[./-]/);
              if (p.length === 3) return new Date(p[2], p[1]-1, p[0]).getTime();
              return 0;
          };
          return parseDate(b.tarih) - parseDate(a.tarih);
      });

      if (countEl) countEl.innerText = \`\${filtered.length} İşlem\`;
  
      const existingExpenseDekonts = new Set(allExpenses.map(e => e.dekont));
      const existingPaymentDekonts = new Set(allPayments.map(p => p.dekont));
  
      filtered.forEach(s => {
          const tr = document.createElement("tr");
          const isGelir = s.tur === "Gelir";
          const isSaved = isGelir ? existingPaymentDekonts.has(s.kod) : existingExpenseDekonts.has(s.kod);
  
          tr.innerHTML = \`
              <td>\${s.tarih}</td>
              <td><span class="code-badge">\${s.kod}</span></td>
              <td style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="\${s.aciklama}">\${s.aciklama}</td>
              <td class="amount \${isGelir ? 'positive' : 'negative'}">\${isGelir ? '+' : '-'}\${Math.abs(s.tutar)} ₺</td>
              <td>
                  \${isSaved ? '<span style="color:var(--success); font-weight:600">✓ KAYDEDİLDİ</span>' : 
                    (!isGelir ? \`<button class="btn btn-primary" style="padding:4px 8px; font-size:11px" onclick="app.saveStatementAsExpense(\${JSON.stringify(s).replace(/"/g, '&quot;')})">Gider Kaydet</button>\` : '-')}
              </td>
          \`;
          tbody.appendChild(tr);
      });
  }`;

// 2. Update renderMatches
const newRenderMatches = `async function renderMatches() {
      const tbody = document.getElementById('match-table');
      const tbodyExp = document.getElementById('match-expense-table');
      const tbodyUnmatched = document.getElementById('match-unmatched-table');
      
      const countEl = document.getElementById('match-count');
      const countElExp = document.getElementById('match-expense-count');
      const countElUnmatched = document.getElementById('match-unmatched-count');
      
      const monthFilter = document.getElementById('match-month-filter') ? document.getElementById('match-month-filter').value : 'all';
  
      if (!tbody || !tbodyExp) return;
  
      const existingDekonts = new Set(allPayments.map(p => p.dekont));
      const existingExpenseDekonts = new Set(allExpenses.map(e => e.dekont));
  
      pendingMatches = [];
      pendingExpenses = [];
      const unmatchedIncomes = [];

      // Helper for normalization
      const normalize = (text) => {
          return (text || '')
              .toLocaleUpperCase('tr-TR')
              .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G')
              .replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
              .trim();
      };
  
      allStatements.forEach(s => {
          if (monthFilter !== 'all' && s.tarih) {
              const parts = s.tarih.split(/[./-]/);
              if (parts.length >= 2 && parts[1] !== monthFilter) return;
          }
  
          if (s.tur === 'Gelir') {
              if (existingDekonts.has(s.kod)) return;
  
              const desc = normalize(s.aciklama);
              let matchedStudent = null;
  
              for (let st of allStudents) {
                  const ad = normalize(st.ad);
                  const soyad = normalize(st.soyad);
                  const tamAd = \`\${ad} \${soyad}\`;
                  const tc = st.tc || '';
                  const anne = normalize(st.anne_adi);
                  const baba = normalize(st.baba_adi);
  
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
              } else {
                  unmatchedIncomes.push(s);
              }
          } else if (s.tur === 'Gider') {
              if (existingExpenseDekonts.has(s.kod)) return;
              pendingExpenses.push(s);
          }
      });
  
      // Render Matches (Students)
      tbody.innerHTML = '';
      if (countEl) countEl.innerText = \`\${pendingMatches.length} Eşleşme\`;
      pendingMatches.forEach((m, idx) => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
              <td>\${idx + 1}</td>
              <td>\${m.student.ad} \${m.student.soyad}</td>
              <td>\${m.student.tc || '-'}</td>
              <td>\${m.statement.tarih}</td>
              <td><span class="code-badge">\${m.statement.kod}</span></td>
              <td class="amount positive">+\${m.statement.tutar} ₺</td>
          \`;
          tbody.appendChild(tr);
      });
  
      // Render Expenses
      tbodyExp.innerHTML = '';
      if (countElExp) countElExp.innerText = \`\${pendingExpenses.length} İşlem\`;
      pendingExpenses.forEach((s, idx) => {
          const tr = document.createElement('tr');
          tr.innerHTML = \`
              <td>\${idx + 1}</td>
              <td>\${s.tarih}</td>
              <td style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="\${s.aciklama}">\${s.aciklama}</td>
              <td><span class="code-badge">\${s.kod}</span></td>
              <td class="amount negative">-\${Math.abs(s.tutar)} ₺</td>
              <td>
                  <button class="btn btn-primary" style="padding:4px 8px; font-size:11px" onclick="app.saveStatementAsExpense(\${JSON.stringify(s).replace(/"/g, '&quot;')})">Gider Kaydet</button>
              </td>
          \`;
          tbodyExp.appendChild(tr);
      });

      // Render Unmatched Incomes
      if (tbodyUnmatched) {
          tbodyUnmatched.innerHTML = '';
          if (countElUnmatched) countElUnmatched.innerText = \`\${unmatchedIncomes.length} İşlem\`;
          unmatchedIncomes.forEach((s, idx) => {
              const tr = document.createElement('tr');
              tr.innerHTML = \`
                  <td>\${idx + 1}</td>
                  <td>\${s.tarih}</td>
                  <td style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="\${s.aciklama}">\${s.aciklama}</td>
                  <td><span class="code-badge">\${s.kod}</span></td>
                  <td class="amount positive">+\${s.tutar} ₺</td>
                  <td>
                      <button class="btn" style="padding:4px 8px; font-size:11px; background:var(--surface2); color:var(--text)" onclick="app.showAddPayment(); setTimeout(()=> { document.getElementById('new-dekont').value='\${s.kod}'; document.getElementById('new-tutar').value='\${s.tutar}'; document.getElementById('new-tarih').value='\${s.tarih.split('.').reverse().join('-')}'; }, 100)">Manuel Eşle</button>
                  </td>
              \`;
              tbodyUnmatched.appendChild(tr);
          });
      }
  }`;

// Replacement logic
const findAndReplace = (targetFuncStart, newFunc) => {
    const startIdx = content.indexOf(targetFuncStart);
    if (startIdx === -1) return false;
    let nextFuncIdx = content.indexOf('async function', startIdx + 50);
    if (nextFuncIdx === -1) nextFuncIdx = content.indexOf('function', startIdx + 50);
    if (nextFuncIdx === -1) nextFuncIdx = content.length;
    content = content.substring(0, startIdx) + newFunc + '\n\n' + content.substring(nextFuncIdx);
    return true;
};

findAndReplace('function renderStatementsTable() {', newRenderStatementsTable);
findAndReplace('async function renderMatches() {', newRenderMatches);

fs.writeFileSync('app.js', content, 'latin1');
console.log("Updated renderStatementsTable and renderMatches successfully.");
