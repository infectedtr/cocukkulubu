const fs = require('fs');
let content = fs.readFileSync('app.js', 'latin1');

const newDeleteStudent = `async function deleteStudent(tc) {
      if (!tc) return;
      showDangerModal(
          "Bu öğrenciyi ve tüm ödeme kayıtlarını <b>kalıcı olarak</b> silmek istediğinize emin misiniz?<br><br><small>Bu işlem geri alınamaz.</small>",
          async () => {
              try {
                  const res = await fetch(\`/api/students/\${tc}\`, { method: 'DELETE' });
                  const data = await res.json();
                  if (res.ok) {
                      showToast('Öğrenci silindi.', 'success');
                      
                      // Fix: Close edit modal if open
                      closeModal('edit-student-modal');
                      
                      // Fix: If we were on detail page for THIS student, go back to matrix
                      if (app.currentDetailTc === tc) {
                          app.currentDetailTc = null;
                          if (document.getElementById('page-ogrenci-detay').classList.contains('active')) {
                              showPage('matris');
                          }
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

// Find the function using regex and replace it
const deleteFuncRegex = /async function deleteStudent\(tc\) \{[\s\S]*?async \(\\) => \{[\s\S]*?\}[\s\S]*?\);[\s\S]*?\}/;
// Wait, the regex might be tricky. Let's just find the start and find the next function or clear delimiter.
const startIdx = content.indexOf('async function deleteStudent(tc) {');
if (startIdx !== -1) {
    // Look for the end of the function. It ends after the showDangerModal closure.
    // The original function had a structure with nested closures.
    // Let's just replace the whole block until the next "function "
    let nextFuncIdx = content.indexOf('async function', startIdx + 35);
    if (nextFuncIdx === -1) nextFuncIdx = content.indexOf('function', startIdx + 35);
    
    if (nextFuncIdx !== -1) {
        content = content.substring(0, startIdx) + newDeleteStudent + '\n\n' + content.substring(nextFuncIdx);
        fs.writeFileSync('app.js', content, 'latin1');
        console.log("Updated deleteStudent function.");
    }
} else {
    console.log("deleteStudent not found.");
}
