const fs = require('fs');
const path = require('path');
const db = require('./database.js');

const htmlPath = 'c:\\Users\\Alien\\Downloads\\kulup_aidat_takip.html';

fs.readFile(htmlPath, 'utf8', (err, data) => {
    if (err) {
        console.error("Error reading HTML file:", err);
        return;
    }

    // `const DB = { ... };` eşleşmesini bul
    const match = data.match(/const DB = (\{.*?\});/s);
    if (!match) {
        console.error("Could not find DB object in HTML file.");
        return;
    }

    try {
        const dbObj = JSON.parse(match[1]);
        
        console.log(`Found ${dbObj.ogrenciler.length} students, ${dbObj.odemeler.length} payments, ${dbObj.hesap.length} statements.`);

        db.serialize(() => {
            // Temizle
            db.run("DELETE FROM students");
            db.run("DELETE FROM payments");
            db.run("DELETE FROM statements");

            // Öğrencileri Ekle
            const stmtStudent = db.prepare("INSERT INTO students (sira, ad, soyad, tc, anne_adi, baba_adi) VALUES (?, ?, ?, ?, ?, ?)");
            dbObj.ogrenciler.forEach(s => {
                stmtStudent.run(s.sira, s.ad, s.soyad, s.tc, s.anne_adi || '', s.baba_adi || '');
            });
            stmtStudent.finalize();

            // Ödemeleri Ekle
            const stmtPayment = db.prepare("INSERT INTO payments (ay, tc, ad_soyad, tarih, dekont, tutar) VALUES (?, ?, ?, ?, ?, ?)");
            dbObj.odemeler.forEach(p => {
                stmtPayment.run(p.ay, p.tc, p.ad_soyad, p.tarih, p.dekont || '', p.tutar);
            });
            stmtPayment.finalize();

            // Ekstreleri Ekle
            const stmtHesap = db.prepare("INSERT INTO statements (tarih, kod, aciklama, tutar) VALUES (?, ?, ?, ?)");
            dbObj.hesap.forEach(h => {
                stmtHesap.run(h.tarih, h.kod || '', h.aciklama, h.tutar);
            });
            stmtHesap.finalize();

            console.log("Database seeded successfully.");
        });

    } catch (e) {
        console.error("Error parsing DB JSON:", e);
    }
});
