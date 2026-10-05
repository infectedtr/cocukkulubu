const fs = require('fs');
let c = fs.readFileSync('public/index.html', 'utf8');

const detailFixes = {
    'detailstudentinfo': 'detail-student-info',
    'detailtotalpaid': 'detail-total-paid',
    'detailpaymentsbody': 'detail-payments-body'
};

for (const [oldId, newId] of Object.entries(detailFixes)) {
    c = c.replace(new RegExp(`id="${oldId}"`, 'g'), `id="${newId}"`);
}

// Fix the "ğapılan" typo
c = c.replace(/ğapılan Odemeler/g, 'Yapılan Ödemeler');
c = c.replace(/Ogrenci Detaylari/g, 'Öğrenci Detayları');
c = c.replace(/Geri Don/g, 'Geri Dön');
c = c.replace(/Duzenle/g, 'Düzenle');

// Ensure FA icons have correct classes
c = c.replace(/<span style="font-size:40px"><\/span> Kullanım Kılavuzu/g, '<i class="fas fa-book" style="font-size:32px; margin-right:15px"></i> Kullanım Kılavuzu');

fs.writeFileSync('public/index.html', c, 'utf8');
console.log('index.html detail page IDs and text fixed.');
