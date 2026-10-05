// LİSANS_URETİCİ.js
const crypto = require('crypto');
const hwid = process.argv[2]; // Komut satırından gelen değer
const salt = "ZUBEYDE-SECRET-SALT";

if (!hwid) {
    console.log("Kullanım: node public/LİSANS_URETİCİ.js <CIHAZ_KIMLIGI>");
} else {
    const key = crypto.createHash('sha256').update(hwid + salt).digest('hex').substring(0, 12).toUpperCase();
    console.log("--------------------------------------");
    console.log("Cihaz Kimliği:", hwid);
    console.log("Üretilen Lisans Anahtarı:", key);
    console.log("--------------------------------------");
}
