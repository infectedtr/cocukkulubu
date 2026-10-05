# Zübeyde Hanım Çocuk Kulübü Aidat Takip Sistemi - Kapsamlı Analiz

Projenin tüm dosyalarını, betiklerini ve bileşenlerini detaylı olarak inceledim. Sistemin nasıl çalıştığını, güncelleme yaparken nereye müdahale edilmesi gerektiğini aşağıda tam bir döküm halinde bulabilirsiniz.

---

## 1. Masaüstü Kabuğu (Electron Katmanı)
Uygulama temel olarak bir Node.js sunucusunu başlatan ve bunu gömülü bir web tarayıcısında (Chromium) gösteren bir Electron uygulamasıdır.
- **`main.js`**: Uygulamanın giriş noktası.
  - **Güvenlik ve Lisans:** `getMachineId()` fonksiyonu ile PowerShell üzerinden cihazın `UUID` değerini çeker. Bu UUID ile "ZUBEYDE-SECRET-SALT" birleştirilip SHA-256 hash alınır ve 12 haneli bir lisans anahtarı üretilir.
  - Eğer lisans anahtarı `license.key` dosyasında yoksa özel bir aktivasyon penceresi gösterilir (`createLicenseWindow`).
  - Lisans başarılıysa `database.js` üzerinden veritabanı `init()` edilir ve ardından `serverApp.listen()` çalıştırılarak sunucu başlatılır, son olarak ana pencere yüklenir.
- **`LİSANS_URETİCİ.js / .html`**: Yönetim veya dağıtım yapan kişinin müşteriye lisans üretmesi için hazırlanmış bir araç.
- **`package.json`**: Hem `start` (`node server.js` için) hem de `start-desktop` (`electron .`) scriptlerini içerir. Build süreçleri (`electron-builder`) için konfigürasyonları barındırır. (Uygulamanın `nsis` formatında Windows için paketlendiği görülüyor).

## 2. Veri Katmanı (SQLite & `sql.js`)
Uygulama diskteki doğrudan `sqlite3` motoru yerine `sql.js` (WebAssembly/JS SQLite) kullanmaktadır. Bu, kurulum sorunlarını en aza indirmek için yapılmış özel bir tasarımdır.
- **`database.js`**: 
  - **Çift Veritabanı Modu:** Sistem iki farklı veritabanı dosyasını destekliyor: `kulup_aidat.sqlite` ve `doner_aidat.sqlite`. 
  - **Mod Değişimi:** Kullanıcı arayüzünden mod değiştirdiğinde (`switchMode`), `mode.txt` dosyasına bu seçim kaydedilir, güncel veritabanı dosyasının buffer'ı okunarak hafızaya alınır.
  - **Kayıt Mekanizması:** Bellekte (`db.run`) yapılan her başarılı işlem sonrasında `saveDb()` çağrılarak SQLite buffer'ı tekrar fiziksel dosyaya (`fs.writeFileSync`) yazılır. Bu, performans açısından ufak bir gecikme yaratsa da sistemin stabil çalışmasını sağlar.
  - **Veri Temizliği (`cleanupDuplicates`)**: Başlangıçta mükerrer ödeme ve dekont kayıtlarını tespit edip otomatik temizleyen koruyucu bir yapıya sahiptir.
  - **Geçiş (Migration):** Eğer `payments` tablosunda `tur` sütunu yoksa başlangıçta `ALTER TABLE` ile bunu ekleyen bir mantık da var.

## 3. Arka Uç (Backend - Express.js)
Tüm iş mantığı `server.js` üzerinden çalışır. REST API mimarisi kullanılır.
- **Modül ve Rota Yapısı:**
  - `GET /api/current-mode` ve `POST /api/switch-mode` : Veritabanı değiştirmek için.
  - `/api/students` (GET, POST, DELETE, PUT): Öğrenci CRUD işlemleri. Toplu silme (`bulk`) ve TC değişikliğinde ilişkili ödemelerin de güncellenmesi (`update_student`) gibi özel senaryolar.
  - `/api/payments` (GET, POST, PUT, DELETE): Ödeme ekleme, güncelleme ve silme işlemleri. Dekont mükerrerlik kontrolleri de `POST` içinde yer alır.
  - `/api/upload-statement` & `/api/statements`: Banka Excel ekstrelerinin `multer` ve `xlsx` kütüphaneleriyle okunup `statements` tablosuna parse edilmesi.
  - `/api/settings` & `/api/hard-reset`: Şifre korumalı ayarlar kaydı ve tüm veritabanı tablolarının sıfırlanması işlemleri.

## 4. Ön Yüz (Frontend - Vanilla JS)
Ön yüz, `public/` klasöründe yer alır. React, Vue gibi modern bir araç yerine tamamen saf HTML, CSS ve DOM manipülasyonu yapan devasa bir `app.js` içerir.
- **`index.html`**: Arayüz elementlerini (Modallar, Tablolar, Sayfalar `page-dashboard`, `page-ogrenciler` vb.) tutar.
- **`style.css`**: Dark ve Light mod destekli CSS değişkenleriyle örülmüş arayüz stilleri.
- **`app.js` (91 KB)**: Uygulamanın en karmaşık yeri.
  - **Durum Yönetimi:** `allStudents`, `allPayments`, `allStatements` gibi global JS arraylerinde verileri tutar ve `loadData()` çalıştığında API'den tüm verileri çekip arayüzdeki tabloları tekrar boyar (`renderStudentTable`, `renderPaymentsTable`).
  - **Mod Bağımlı UI (`updateDynamicLabels`)**: Kulüp modundayken "Kulüp/İndirimli", Döner Sermaye modundayken "Tam Gün/Sabahçı/Öğleci" ayrımlarını anlık olarak yapar. Kardeş indirimi hesaplamaları (`getFamilyPaymentInfo`) gibi kompleks iş mantığı sunucu yerine Client tarafında (JS'de) yapılmıştır.

## 5. Betikler ve Kod Yama Scriptleri (Python & Bat)
Projenin en ilginç kısmı, daha önce yaşanan büyük problemleri çözmek veya geliştirmeleri hızlandırmak için root klasöründe dışarıdan yazılmış Python yama (patch) dosyaları bulundurmasıdır:
- **`inject_app.py`**: `app.js` içindeki `renderPaymentsTable`, `renderStatementsTable` gibi fonksiyonları bulup hardcode olarak güncel JS kodlarıyla ezen bir Python script'i.
- **`fix_match.py`**: `app.js` içerisindeki banka dekontları (`statements`) ile öğrencileri eşleştiren (`renderMatches` ve `saveMatchesAsPayments`) algoritmayı yeniden yazan bir yama dosyası. Banka açıklamasındaki Ad, Soyad, TC, Anne Adı, Baba Adı değerlerini öğrenci dizisiyle karşılaştıran mantığı barındırıyor.
- **`TAM_TAMIR.bat`**: Tüm açık process'leri (node, electron) kill eden, `node_modules`'u silip `npm cache` temizliği yapan ve `npm install` ile tüm kütüphaneleri sıfırdan kurarak Electron modüllerini Windows'a uyumlu hale getiren (rebuild) kriz anı onarım script'i.

## Gelecekteki Güncellemeler İçin Altın Kurallar
Güncelleme yaparken dikkat edilmesi gerekenler:
1. **Frontend İş Mantığı:** Kardeş hesaplamaları, dekont eşleştirme işlemleri Backend'de (`server.js`) değil, Frontend'de (`app.js`) yapıldığı için bu tür algoritmik güncellemeleri doğrudan `public/app.js`'de yapmalısınız. Eğer Python scriptleriyle (ör. `fix_match.py`) ezilme tehlikesi varsa, önce bu Python scriptlerinin işlevini incelemek gerekir.
2. **Database Performansı:** `sql.js` Buffer mantığı ile çalıştığı için her API isteğinden sonra SQLite dosyası baştan aşağı tekrar yazılır (`fs.writeFileSync`). Bu nedenle binlerce kayıt üzerinde loop içinde tekil SQL insert'ü yapmak (örneğin toplu Excel ekleme) sistemi kilitleyebilir, bunun yerine Transaction/Serialize kullanımı (`database.js` içindeki `run` sarmalayıcısı) kritik öneme sahiptir.
3. **Mod Senkronizasyonu:** Arayüzün modlar arası geçişleri hem sunucuyu hem UI'yi etkilediği için `currentMode` değişkeninin `app.js` ve `database.js` tarafında daima aynı (senkron) kalmasına özen gösterilmelidir.
