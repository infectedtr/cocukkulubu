const fs = require('fs');
let indexHtml = fs.readFileSync('index.html', 'latin1');

// Look for the end of page-ogrenci-detay followed by the modal
const target = '    </div>\n\n  <div class="modal-overlay" id="edit-student-modal">';
const replacement = '    </div>\n    </div>\n  </div>\n</div>\n\n  <div class="modal-overlay" id="edit-student-modal">';

if (indexHtml.includes(target)) {
    indexHtml = indexHtml.replace(target, replacement);
    fs.writeFileSync('index.html', indexHtml, 'latin1');
    console.log("Fixed missing closing tags.");
} else {
    // try with different line endings or spacing
    const target2 = '    </div>\n\n  <div class="modal-overlay" id="edit-student-modal">';
    console.log("Target not found. Let's try more flexible search.");
    
    const pageDetayEnd = '    </div>\n';
    const modalStart = '  <div class="modal-overlay" id="edit-student-modal">';
    
    const startIndex = indexHtml.indexOf('<div id="page-ogrenci-detay" class="page">');
    if (startIndex !== -1) {
        const modalIndex = indexHtml.indexOf(modalStart, startIndex);
        if (modalIndex !== -1) {
            // Found it!
            const beforeModal = indexHtml.substring(0, modalIndex);
            const afterModal = indexHtml.substring(modalIndex);
            
            // Check if there are already </div> tags there.
            // In my view, line 722 was </div>.
            // Let's just insert the 3 </div> tags.
            indexHtml = beforeModal + '    </div>\n  </div>\n</div>\n\n' + afterModal;
            fs.writeFileSync('index.html', indexHtml, 'latin1');
            console.log("Inserted closing tags successfully.");
        }
    }
}
