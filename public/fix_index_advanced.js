
const fs = require('fs');

const filePath = 'public/index.html';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix Y -> ğ corruption (restore Y)
// We need to be careful with Turkish 'ğ', but in most cases in this context, 
// if it's in the middle of a word that should have 'Y', we fix it.
const turkishFixes = [
    [/EğLÜL/g, 'EYLÜL'],
    [/MAğIS/g, 'MAYIS'],
    [/ğazdır/g, 'Yazdır'],
    [/ğapımcı/g, 'Yapımcı'],
    [/ğükleniyor/g, 'Yükleniyor'],
    [/ğeni/g, 'Yeni'],
    [/ğıl/g, 'Yıl'],
    [/ğaz/g, 'Yaz'],
    [/ğön/g, 'Yön'],
    [/ğük/g, 'Yük'],
    [/ğön/g, 'Yön'],
    [/ğük/g, 'Yük'],
    [/pagedashboard/g, 'page-dashboard'],
    [/pageogrenciler/g, 'page-ogrenciler'],
    [/pagematris/g, 'page-matris'],
    [/pagehesap/g, 'page-hesap'],
    [/pageeslestir/g, 'page-eslestir'],
    [/pagerapor/g, 'page-rapor'],
    [/pagebeklenen/g, 'page-beklenen'],
    [/pagekardesler/g, 'page-kardesler'],
    [/pageayarlar/g, 'page-ayarlar'],
    [/pagekilavuz/g, 'page-kilavuz'],
    [/pagegiderler/g, 'page-giderler'],
    [/pageogrencidetay/g, 'page-ogrenci-detay']
];

turkishFixes.forEach(([old, newVal]) => {
    content = content.replace(old, newVal);
});

// 2. Comprehensive Hyphen Fixes
const moreHyphenFixes = [
    ['modetogglecontainer', 'mode-toggle-container'],
    ['fullwidthtoggle', 'full-width-toggle'],
    ['modelabelkulup', 'mode-label-kulup'],
    ['modelabeldoner', 'mode-label-doner'],
    ['statsgrid', 'stats-grid'],
    ['gridtemplatecolumns', 'grid-template-columns'],
    ['dashboardcollectionmonth', 'dashboard-collection-month'],
    ['renderDashboardStats', 'app.renderDashboardStats'], // wait, fix app call too if needed
    ['monthchart', 'month-chart'],
    ['dashboardunpaidmonth', 'dashboard-unpaid-month'],
    ['unpaidlist', 'unpaid-list'],
    ['maxheight', 'max-height'],
    ['overflowy', 'overflow-y'],
    ['recentpayments', 'recent-payments'],
    ['beklenensearch', 'beklenen-search'],
    ['beklenenmonthfilter', 'beklenen-month-filter'],
    ['btnprimary', 'btn-primary'],
    ['btndanger', 'btn-danger'],
    ['btnsuccess', 'btn-success'],
    ['beklenencount', 'beklenen-count'],
    ['beklenentable', 'beklenen-table'],
    ['searchogrenci', 'search-ogrenci'],
    ['filteray', 'filter-ay'],
    ['filterdurum', 'filter-durum'],
    ['studentcount', 'student-count'],
    ['selectall', 'select-all'],
    ['ogrencidetay', 'ogrenci-detay'],
    ['matristable', 'matris-table'],
    ['hesaptable', 'hesap-table'],
    ['hesapcount', 'hesap-count'],
    ['searchhesap', 'search-hesap'],
    ['filterhesaptur', 'filter-hesap-tur'],
    ['matchtable', 'match-table'],
    ['matchcount', 'match-count'],
    ['raportable', 'rapor-table'],
    ['raporcount', 'rapor-count'],
    ['filterraporay', 'filter-rapor-ay'],
    ['kardeslerlist', 'kardesler-list'],
    ['kardeslercount', 'kardesler-count'],
    ['giderlertable', 'giderler-table'],
    ['giderlercount', 'giderler-count'],
    ['searchgider', 'search-gider'],
    ['filtergideray', 'filter-gider-ay'],
    ['ucretsabahci', 'ucret-sabahci'],
    ['ucrettamgun', 'ucret-tamgun'],
    ['ucretsabahci2', 'ucret-sabahci-2'],
    ['ucrettamgun2', 'ucret-tamgun-2'],
    ['schoolname', 'school-name'],
    ['saveayarlar', 'save-ayarlar'],
    ['importfile', 'import-file'],
    ['statementfile', 'statement-file']
];

moreHyphenFixes.forEach(([old, newVal]) => {
    const regex = new RegExp(old, 'g');
    content = content.replace(regex, newVal);
});

// Fix some specific attribute issues
content = content.replace(/placeholder=" "ğrenci/g, 'placeholder="🔍 Öğrenci');
content = content.replace(/placeholder=" /g, 'placeholder="🔍 ');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Advanced repairs applied.');
