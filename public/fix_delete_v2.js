const fs = require('fs');
let content = fs.readFileSync('app.js', 'latin1');

const targetStart = 'async function deleteStudent(tc) {';
const targetEnd = '      );' + '\n' + '  }'; // This is roughly where it ends

const newDeleteStudent = `async function deleteStudent(tc) {
      if (!tc) return;
      showDangerModal(
          \`Bu öğrenciyi ve tüm ödeme kayıtlarını <b>kalıcı olarak</b> silmek istediğinize emin misiniz?<br><br><small>Bu işlem geri alınamaz.</small>\`,
          async () => {
              try {
                  const res = await fetch(\`/api/students/\${tc}\`, { method: 'DELETE' });
                  const data = await res.json();
                  if (res.ok) {
                      showToast('Öğrenci silindi.', 'success');
                      
                      // Modali kapat
                      if (typeof closeModal === 'function') closeModal('edit-student-modal');
                      if (window.app && window.app.closeModal) window.app.closeModal('edit-student-modal');

                      // Eğer detay sayfasındaysak matrise dön
                      if (window.app && window.app.currentDetailTc === tc) {
                          window.app.currentDetailTc = null;
                          window.app.showPage('matris');
                      }
                      
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
  }`;

// Find the function block and replace it
const startIndex = content.indexOf(targetStart);
if (startIndex !== -1) {
    // Find the end of the function by looking for the next "function" or "async function"
    let nextFuncIdx = content.indexOf('async function', startIndex + 50);
    if (nextFuncIdx === -1) nextFuncIdx = content.indexOf('function', startIndex + 50);
    
    if (nextFuncIdx !== -1) {
        content = content.substring(0, startIndex) + newDeleteStudent + '\n\n' + content.substring(nextFuncIdx);
        fs.writeFileSync('app.js', content, 'latin1');
        console.log("Successfully updated deleteStudent.");
    }
} else {
    console.log("Could not find deleteStudent start.");
}
