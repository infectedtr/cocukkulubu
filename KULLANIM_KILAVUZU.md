# Zübeyde Hanım Çocuk Kulübü & DÖSE Aidat Takip Sistemi
## Kapsamlı Kullanım Kılavuzu (v1.3.0)

Bu kılavuz, Kulüp ve Döner Sermaye (DÖSE) aidatlarının, banka ekstrelerinin ve öğrenci takibinin tek bir sistem üzerinden hatasız ve kolay bir şekilde yönetilmesini sağlayan "Aidat Takip Sistemi"nin detaylı kullanımını açıklamaktadır.

---

### 📚 İÇİNDEKİLER
1. [Sisteme Giriş ve Temel Kavramlar](#1-sisteme-giriş-ve-temel-kavramlar)
2. [Sol Menü ve Sayfaların Kullanımı](#2-sol-menü-ve-sayfaların-kullanımı)
3. [Öğrenci Yönetimi ve Kayıt İşlemleri](#3-öğrenci-yönetimi-ve-kayıt-işlemleri)
4. [Aidat Tahsilatı ve Ödeme Girişi](#4-aidat-tahsilatı-ve-ödeme-girişi)
5. [Banka Ekstresi ve Otomatik Eşleştirme](#5-banka-ekstresi-ve-otomatik-eşleştirme)
6. [Gider Takibi](#6-gider-takibi)
7. [Raporlar ve Dışa Aktarma (Excel/PDF)](#7-raporlar-ve-dışa-aktarma-excelpdf)
8. [Sistem Ayarları ve Veri Sıfırlama](#8-sistem-ayarları-ve-veri-sıfırlama)
9. [Sıkça Sorulan Sorular & İpuçları](#9-sıkça-sorulan-sorular--ipucları)

---

### 1. Sisteme Giriş ve Temel Kavramlar

#### 1.1 Çift Modlu Çalışma Sistemi (Kulüp / DÖSE)
Uygulamanın en önemli özelliği **birbirinden tamamen bağımsız iki farklı veritabanı** ile çalışmasıdır:
- **Kulüp Modu:** Mavi renk tonlarıyla tasarlanmıştır. Kulüp öğrencileri, ödemeleri ve giderleri bu modda tutulur.
- **DÖSE (Döner Sermaye) Modu:** Yeşil renk tonlarıyla tasarlanmıştır. DÖSE öğrencileri, ödemeleri ve giderleri sadece bu modda görüntülenir.
- **Mod Değiştirme:** Sol menünün en üstünde yer alan anahtara (Switch) tıklayarak veya "Gösterge Paneli" sayfasındaki büyük anahtarı kullanarak modlar arası anında geçiş yapabilirsiniz. Bir modda yaptığınız hiçbir değişiklik diğer modu etkilemez.

#### 1.2 Kardeş İndirimi ve Eşleştirme Mantığı
- **Sadece Kulüp Modunda Geçerlidir:** Öğrencilerin Veli (Anne/Baba) adları eşleşiyorsa sistem onları otomatik olarak kardeş ilan eder. En yüksek ücretli kardeş tam aidat öderken, diğer kardeşlere otomatik olarak %50 indirim uygulanır. Kardeşlere ait ödemeler, matriste "Kardeş (Mor)" olarak gösterilir ve Excel/PDF raporlarına yansır.
- **DÖSE Modunda Kardeş İşlemleri Kapalıdır:** DÖSE modunda her öğrenci tam aidat ödemekle yükümlüdür. Bu modda kardeş eşleşmesi kesinlikle yapılmaz, otomatik indirim uygulanmaz ve "Kardeş Listesi" gibi sayfalar devre dışı kalır. Matris ve raporlarda kardeş bazlı bir ödeme durumu gösterilmez.

---

### 2. Sol Menü ve Sayfaların Kullanımı

Sol menü, uygulamanın farklı modüllerine erişmenizi sağlar.

- **📊 Gösterge Paneli:** Sistemdeki genel durumu, toplam öğrenci sayısını, tahsil edilen ve edilemeyen tutarları özetler. Aylık tahsilat grafiğini ve o ay borcunu ödemeyenlerin listesini gösterir.
- **👦 Öğrenciler:** Sisteme kayıtlı öğrencilerin listelendiği, yeni öğrenci ekleme, düzenleme ve silme işlemlerinin yapıldığı ana sayfadır.
- **📅 Tüm Aylar Matrisi:** Eylül'den Temmuz'a kadar tüm ayların yan yana listelendiği, hangi öğrencinin hangi ay ödeme yaptığını renkli hücrelerle gösteren detaylı panodur.
- **🏦 Banka Ekstresi:** Bankadan alınan dökümlerin sisteme yüklendiği sayfadır.
- **🔗 Dekont Eşleştirme:** Ekstreden alınan verilerin, sistemdeki öğrencilerle otomatik eşleştirildiği ve onaylandığı sayfadır.
- **📈 Ay Bazlı Rapor:** Hangi ayda kaç kişinin ödeme yaptığı, ne kadar tahsilat yapıldığı gibi aylık finansal raporları içerir.
- **⏳ Ödeme Beklenen:** Henüz ödemesini yapmamış öğrencileri ve hangi aylara ait borçları olduğunu listeler.
- **👨‍👩‍👧‍👦 Kardeş Listesi:** *(Sadece Kulüp Modu)* Sistem tarafından veli isimlerine göre otomatik eşleştirilen kardeşleri gruplar halinde gösterir. DÖSE modunda bu sayfa gizlenir veya devre dışı bırakılır.
- **💸 Giderler:** Yapılan harcamaların, faturaların ve personel maaşlarının girildiği takip ekranıdır.
- **⚙️ Ayarlar:** Okul adı, logo, aidat ücretleri ve sistem şifresinin belirlendiği yapılandırma sayfasıdır.

---

### 3. Öğrenci Yönetimi ve Kayıt İşlemleri

**Öğrenciler > (+ Yeni Öğrenci Ekle / Toplu Import)** adımından öğrenci ekleyebilirsiniz.

#### 3.1 Tekli Öğrenci Ekleme
Öğrenciye ait TC Kimlik Numarası (Sistemdeki benzersiz anahtardır), Ad, Soyad, Eğitim Türü (Tam Gün / Sabahçı / Öğlenci) ve Veli Adı bilgilerini manuel olarak girerek kaydedebilirsiniz.

#### 3.2 Excel ile Toplu Öğrenci Yükleme
Yıl başında onlarca öğrenciyi tek tek girmek yerine Excel ile toplu yükleme yapabilirsiniz:
1. **Öğrenciler** sekmesinde **"⬆ Toplu Öğrenci Ekle"** butonuna tıklayın.
2. "Excel ile Toplu Ekle" sekmesine geçin.
3. Örnek şablonu indirin (`Ogrenci_Sablonu.xlsx`).
4. Şablonu Excel'de açıp sütunlara uygun şekilde öğrencileri doldurun.
5. Dosyayı kaydedip sisteme yükleyin.

*Not: Sistemdeki bir TC numarası Excel'de tekrar yüklenirse, sistem mükerrer kaydı engeller veya günceller.*

---

### 4. Aidat Tahsilatı ve Ödeme Girişi

Ödemeleri sisteme manuel girmek için iki yol vardır:
1. Matris ekranında ödenmemiş hücreye tıklayarak.
2. Sol menüdeki herhangi bir ekranda bulunurken sağ alt köşedeki veya listelerdeki **"+ Ödeme Ekle"** butonlarını kullanarak.

**Ödeme Ekleme Penceresi:**
- **Öğrenci:** Arama kutusundan öğrenci seçin.
- **Ay:** Hangi aya ait aidat yatırıldığını seçin.
- **Tür:** Standart ödemeler için "Ödeme" seçilir. Öğrenci o ay gelmediyse "Raporlu" veya "İzinli" seçilerek o aya ait borç kapatılabilir (Ücret 0 görünür).
- **Tarih, Dekont No, Tutar:** İlgili dekont bilgilerini girin.
- **Kaydet** butonuna bastığınızda hücre yeşile döner ve borç kapanır.

---

### 5. Banka Ekstresi ve Otomatik Eşleştirme

Banka dökümlerini tek tek elle girmek yerine otomatik eşleştirme kullanabilirsiniz.

#### Adım 1: Ekstre Yükleme (Banka Ekstresi Sayfası)
**Yol 1: Dosya Yükle:** Bankadan aldığınız `.xlsx` veya `.csv` dosyasını sisteme yükleyin.  
**Yol 2: Manuel Yapıştır:** Excel'deki verileri (Tarih, Kod, Açıklama, Tutar sütunlarını) kopyalayıp uygulamadaki alana yapıştırın ve kaydedin.

#### Adım 2: Eşleştirme ve Kayıt (Dekont Eşleştirme Sayfası)
Sistem, yüklenen ekstredeki **Açıklama** kısmında yazan ad-soyad ile sistemdeki öğrencileri otomatik arar.
1. Bulunan eşleşmeler bir listede sunulur.
2. Mükerrer (daha önce girilmiş) bir dekont varsa kırmızı renkte uyarılır.
3. Eşleşmeler doğruysa **"💾 Eşleşenleri Sisteme Kaydet"** butonuna basılır ve yüzlerce ödeme saniyeler içinde matrise işlenir.
4. Ekstrenin borç/gider kısımları alt tabloda listelenir. Bu tabloları **"Tüm Giderleri Kaydet"** diyerek Giderler modülüne aktarabilirsiniz.

---

### 6. Gider Takibi

Kulüp veya DÖSE bütçesinden yapılan harcamaları takip etmek içindir.
- **Gider Ekleme:** "💸 Giderler" sayfasından **"+ Yeni Gider Ekle"** butonuna basılır.
- **Kategoriler:** Personel, Gıda, Temizlik, Kırtasiye, Fatura, Tamirat/Bakım vb. kategoriler seçilerek harcama girilir.
- Giderler ekranında aylara ve kategorilere göre toplam gider tablosu görülebilir.

---

### 7. Raporlar ve Dışa Aktarma (Excel/PDF)

Uygulamanın neredeyse tüm sayfalarında sağ üstte **Excel İndir** ve **PDF İndir** butonları bulunur.
- **Tüm Aylar Matrisi:** Tüm öğrencilerin yıl boyu durumunu renkli hücrelerle gösteren dev Excel tablosunu indirir.
- **Ödeme Beklenenler Raporu:** Ödeme yapmayan velilere bildirim göndermek için eksik ayları listeleyen PDF veya Excel dökümü verir.
- **Ay Bazlı Rapor:** Denetimlerde kullanılmak üzere, seçilen aya ait tüm gelirlerin (dekont numarası, tarih ve tutar bazında) resmi liste çıktısını almanızı sağlar.

---

### 8. Sistem Ayarları ve Veri Sıfırlama

Sol menüden **"⚙️ Ayarlar"** sayfasına girilir. (Mevcut ayarlar şifresi ilk kurulumda genellikle `123456` dır).

- **Okul Bilgileri:** Kulüp/Okul adı, eğitim yılı ve logo değiştirilebilir.
- **Aidat Ücretleri:** 1. Dönem ve 2. Dönem için Sabahçı / Tam Gün aidat ücretleri buradan belirlenir. Bu ücretleri değiştirdiğiniz an, geçmiş ve gelecek tüm borçlandırmalar bu fiyatlar üzerinden güncellenir. (Kulüp için farklı, DÖSE için farklı kaydedilmelidir).
- **Aylık Ödeme Silme:** Belirli bir aydaki (örneğin Ocak ayındaki) tüm hatalı ödemeleri topluca temizler.
- **💣 Hard Reset (Tüm Verileri Sıfırla):** Eğitim yılı bittiğinde, bir sonraki yıla tertemiz başlamak için kullanılır. **Sistemdeki tüm öğrenci, ödeme, ekstre ve giderleri siler. Geri alınamaz!**

---

### 9. Sıkça Sorulan Sorular & İpuçları

**S: Koyu/Açık Tema (Dark Mode) nasıl değiştirilir?**  
C: Ekranın sağ üst köşesindeki Ay/Güneş (🌙/☀️) ikonuna tıklayarak temayı değiştirebilirsiniz.

**S: Matriste kırmızı, sarı, mor ve yeşil renkler ne anlama geliyor?**  
C:
- **Yeşil (Ödendi):** Aidat tam yatırılmıştır.
- **Sarı (Eksik):** Aidatın bir kısmı yatırılmıştır (Örn: 6500 yerine 6000). Kalan borç bakiyesi görünür.
- **Mor (Kardeş):** *(Sadece Kulüp Modunda)* Kardeşi tarafından ödeme yapılan (ücretsiz/indirimli) öğrenciyi gösterir. DÖSE modunda bu durum geçerli değildir ve matriste gösterilmez.
- **Kırmızı/Gri (Ödenmedi):** Herhangi bir ödeme yapılmamıştır.

**S: Öğrenci sistemde var ama banka eşleştirmesinde çıkmıyor?**  
C: Banka dekont açıklamasında öğrencinin Adı ve Soyadı geçmiyor olabilir. (Örn: Veli sadece kendi adını yazmışsa). Bu durumlarda eşleşmeyen dekonta bakarak manuel ödeme girmelisiniz.

**S: Kulüp modunda ayarladığım ücretler DÖSE'de neden görünmüyor?**  
C: Modlar tamamen ayrıdır. DÖSE için belirlenen aidat ücretlerini ayarlamak için önce mod anahtarından "Döner Sermaye"ye geçin, ardından Ayarlar sayfasına girip DÖSE ücretlerini kaydedin.

---

**Teknik Destek ve Sürüm:** *v1.3.0 - Zübeyde Hanım KMTAL Bilişim Teknolojileri Alanı tarafından geliştirilmiştir.*
