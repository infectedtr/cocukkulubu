const fs = require('fs');
let indexHtml = fs.readFileSync('index.html', 'latin1');

// Find the start of the page-ogrenci-detay
const startIndex = indexHtml.indexOf('<div id="page-ogrenci-detay" class="page">');
if (startIndex !== -1) {
    // Find the end of this div block. It goes until the next modal or EOF.
    // Actually, I can just use indexOf('<div class="modal-overlay" id="edit-student-modal">') if it's placed after that modal
    // In the view_file, it looks like it was placed AFTER <!-- ÖĞRENCİ DÜZENLE MODAL -->
    // Let's just find the end of page-ogrenci-detay which ends with `</div>\n    </div>\n` and then there's an `<!-- ` or EOF.
    const editStudentModalIndex = indexHtml.indexOf('<div class="modal-overlay" id="edit-student-modal">');
    
    // Actually, let's extract the block we added by searching for its exact text.
    // I know it starts with `<div id="page-ogrenci-detay" class="page">` and ends before `<div class="modal-overlay" id="edit-student-modal">` IF I put it before edit-student-modal.
    // Wait, in the view_file, it shows it starts after <!-- ÖĞRENCİ DÜZENLE MODAL -->!
    // Let's just grab everything from `<div id="page-ogrenci-detay" class="page">` to the end of the file or next modal.
    let endIndex = indexHtml.indexOf('<div class="modal-overlay"', startIndex);
    if (endIndex === -1) endIndex = indexHtml.indexOf('<!--', startIndex + 40);
    if (endIndex === -1) endIndex = indexHtml.length;
    
    // To be perfectly safe, I'll extract it using a regex or simple split.
    const beforeBlock = indexHtml.substring(0, startIndex);
    let theBlock = indexHtml.substring(startIndex);
    
    // Let's look for the closing tags that come after page-giderler
    const pageGiderlerEnd = '</div>\n      </div>\n\n    </div>\n  </div>\n</div>\n'; // approximate
    // The safest way: find `<div id="page-giderler"` and its corresponding end.
    // We know `<!-- STUDENT MODAL -->` starts at line 687.
    // Let's split by `<!-- STUDENT MODAL -->`
    
    let parts = indexHtml.split('<!-- STUDENT MODAL -->');
    if (parts.length === 2) {
        // extract page-ogrenci-detay from parts[1]
        let pageDetayStart = parts[1].indexOf('<div id="page-ogrenci-detay" class="page">');
        if (pageDetayStart !== -1) {
            let pageDetayStr = parts[1].substring(pageDetayStart);
            parts[1] = parts[1].substring(0, pageDetayStart); // remove it from the bottom
            
            // Now insert pageDetayStr inside parts[0] right before the last closing `</div>` sequence of `.content`
            // Let's look for the end of `.content`.
            // In parts[0], the end is:
            //     </div>
            //   </div>
            // </div>
            let insertPoint = parts[0].lastIndexOf('</div>\n  </div>\n</div>');
            if (insertPoint !== -1) {
                parts[0] = parts[0].substring(0, insertPoint) + pageDetayStr + '\n' + parts[0].substring(insertPoint);
                fs.writeFileSync('index.html', parts[0] + '<!-- STUDENT MODAL -->' + parts[1], 'latin1');
                console.log("Moved successfully!");
            } else {
                console.log("Insert point not found.");
            }
        } else {
            // maybe it's not in parts[1]?
            console.log("page-ogrenci-detay not found in second part.");
        }
    } else {
        console.log("Split by STUDENT MODAL failed.");
    }
} else {
    console.log("page-ogrenci-detay not found at all.");
}
