
const fs = require('fs');

const filePath = 'c:\\Users\\Alien\\.gemini\\antigravity\\scratch\\kulup_aidat_app\\kulup_aidat_app\\public\\index.html';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix general character mappings
// We know Ö was likely " and ğ was likely Y (in some contexts)
// But we must be careful not to break Turkish words like Öğrenci, Zübeyde, Hanım.

// First, fix the quotes in HTML attributes
// Pattern: attribute=ÖvalueÖ
content = content.replace(/=Ö([^Ö]*)Ö/g, '="$1"');
// Pattern: style=Ö...Ö
content = content.replace(/style=Ö([^Ö]*)Ö/g, 'style="$1"');

// Fix DOCTYPE
content = content.replace('<!DOCTğPE html>', '<!DOCTYPE html>');

// Fix common words
content = content.replace(/ğapımcı/g, 'Yapımcı');
content = content.replace(/ğükleniyor/g, 'Yükleniyor');
content = content.replace(/ğ/g, (match, offset, string) => {
    // If it's in a context like "ğükleniyor" or "ğapımcı" (handled above)
    // or if it's "ğ" in "DOCTğPE" (handled above)
    // What else? 
    return match; // Keep it for now to avoid breaking Turkish
});

// 2. Fix missing hyphens in CSS properties and classes
const hyphenFixes = [
    ['margintop', 'margin-top'],
    ['marginbottom', 'margin-bottom'],
    ['marginleft', 'margin-left'],
    ['marginright', 'margin-right'],
    ['paddingtop', 'padding-top'],
    ['paddingbottom', 'padding-bottom'],
    ['paddingleft', 'padding-left'],
    ['paddingright', 'padding-right'],
    ['borderbottom', 'border-bottom'],
    ['bordertop', 'border-top'],
    ['borderleft', 'border-left'],
    ['borderright', 'border-right'],
    ['fontsize', 'font-size'],
    ['fontweight', 'font-weight'],
    ['textalign', 'text-align'],
    ['alignitems', 'align-items'],
    ['justifycontent', 'justify-content'],
    ['initialscale', 'initial-scale'],
    ['devicewidth', 'device-width'],
    ['navbtn', 'nav-btn'],
    ['navicon', 'nav-icon'],
    ['sidebarlogo', 'sidebar-logo'],
    ['logoicon', 'logo-icon'],
    ['sidebarnav', 'sidebar-nav'],
    ['navsectiontitle', 'nav-section-title'],
    ['sidebarfooter', 'sidebar-footer'],
    ['sidebarstats', 'sidebar-stats'],
    ['globalheader', 'global-header'],
    ['globaltitle', 'global-title'],
    ['topbartitle', 'topbar-title'],
    ['topbarsub', 'topbar-sub'],
    ['topbaractions', 'topbar-actions'],
    ['modaloverlay', 'modal-overlay'],
    ['modalcontent', 'modal-content'],
    ['modalheader', 'modal-header'],
    ['modalbody', 'modal-body'],
    ['modalfooter', 'modal-footer'],
    ['tabbtn', 'tab-btn'],
    ['tabcontent', 'tab-content'],
    ['datatable', 'data-table'],
    ['tablecontainer', 'table-container'],
    ['statusbadge', 'status-badge'],
    ['codebadge', 'code-badge'],
    ['headerlogo', 'header-logo'],
    ['headername', 'header-name'],
    ['sidebaryear', 'sidebar-year'],
    ['pagetitle', 'page-title'],
    ['pagesub', 'page-sub'],
    ['themetoggle', 'theme-toggle'],
    ['modeheader', 'mode-header'],
    ['modeindicatorbar', 'mode-indicator-bar'],
    ['globalmodetoggle', 'global-mode-toggle']
];

hyphenFixes.forEach(([old, newVal]) => {
    const regex = new RegExp(old, 'g');
    content = content.replace(regex, newVal);
});

// 3. Add Font Awesome if missing
if (!content.includes('font-awesome')) {
    content = content.replace('</head>', '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">\n</head>');
}

// 4. Fix broken icons (those square or weird chars)
// I'll replace them with generic Font Awesome icons for now.
content = content.replace(/<span class="nav-icon">[^<]*<\/span> Gösterge Paneli/g, '<span class="nav-icon"><i class="fas fa-home"></i></span> Gösterge Paneli');
content = content.replace(/<span class="nav-icon">[^<]*<\/span> Öğrenciler/g, '<span class="nav-icon"><i class="fas fa-users"></i></span> Öğrenciler');
content = content.replace(/<span class="nav-icon">[^<]*<\/span> Tüm Aylar Matrisi/g, '<span class="nav-icon"><i class="fas fa-table"></i></span> Tüm Aylar Matrisi');
content = content.replace(/<span class="nav-icon">[^<]*<\/span> Banka Ekstresi/g, '<span class="nav-icon"><i class="fas fa-university"></i></span> Banka Ekstresi');
content = content.replace(/<span class="nav-icon">[^<]*<\/span> Dekont Eşleştirme/g, '<span class="nav-icon"><i class="fas fa-sync-alt"></i></span> Dekont Eşleştirme');
content = content.replace(/<span class="nav-icon">[^<]*<\/span> Ay Bazlı Rapor/g, '<span class="nav-icon"><i class="fas fa-file-invoice-dollar"></i></span> Ay Bazlı Rapor');
content = content.replace(/<span class="nav-icon">[^<]*<\/span> Kardeş Listesi/g, '<span class="nav-icon"><i class="fas fa-people-arrows"></i></span> Kardeş Listesi');
content = content.replace(/<span class="nav-icon">[^<]*<\/span> Giderler \(Aylık\)/g, '<span class="nav-icon"><i class="fas fa-wallet"></i></span> Giderler (Aylık)');
content = content.replace(/<span class="nav-icon">[^<]*<\/span> Kullanım Kılavuzu/g, '<span class="nav-icon"><i class="fas fa-book"></i></span> Kullanım Kılavuzu');

// Fix the logo icon
content = content.replace(/<div class="logo-icon" id="header-logo">[^<]*<\/div>/g, '<div class="logo-icon" id="header-logo"><i class="fas fa-graduation-cap" style="color:white"></i></div>');

// Fix footer connection icon
content = content.replace(/<div>[^<]* Veritabanı Bağlantılı<\/div>/g, '<div><i class="fas fa-database"></i> Veritabanı Bağlantılı</div>');

fs.writeFileSync(filePath, content, 'utf8');
console.log('File cleaned and hyphens restored.');
