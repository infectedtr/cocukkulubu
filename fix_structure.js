const fs = require('fs');
const filePath = 'public/index.html';
let content = fs.readFileSync(filePath, 'utf8');

// The structure should be:
// <div class="layout">          <- line 15
//   <aside class="sidebar">...</aside>
//   <div class="content">      <- line 99 (main content area with topbar + pages)
//     <div class="topbar">...</div>
//     <div class="pages">     <- needs checking
//       ... all page divs ...
//     </div>
//   </div>  <- closes .content
// </div>    <- closes .layout
// <div class="notif">...</div>  <- notifications, outside layout
// </div></div></div>  <- these 3 are WRONG/orphaned - remove them
// <!-- modals here -->

// Remove the 3 orphaned closing divs at lines 889-891
// They appear after the notif div and before <!-- STUDENT MODAL -->
const wrongPattern = /(<div class="notif" id="notif"><\/div>\s*\n)(\s*<\/div>\s*\n\s+<\/div>\s*\n<\/div>\s*\n\s*\n<! STUDENT MODAL >)/;
const correctPattern = '$1\n<!-- STUDENT MODAL -->';

if (wrongPattern.test(content)) {
    content = content.replace(wrongPattern, correctPattern);
    console.log('Removed orphaned closing divs.');
} else {
    // Try direct string replacement
    const needle = `\n</div>\n  </div>\n</div>\n\n<! STUDENT MODAL >`;
    const replacement = `\n\n<!-- STUDENT MODAL -->`;
    if (content.includes(needle)) {
        content = content.replace(needle, replacement);
        console.log('Direct replacement successful.');
    } else {
        // Look for the exact sequence after notif
        console.log('Pattern not found, doing manual search...');
        const idx = content.indexOf('<div class="notif" id="notif"></div>');
        if (idx !== -1) {
            const after = content.substring(idx + 37, idx + 200);
            console.log('After notif:', JSON.stringify(after));
        }
    }
}

fs.writeFileSync(filePath, content, 'utf8');
