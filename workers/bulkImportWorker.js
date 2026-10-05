/**
 * Optimized Bulk Import Worker
 * This worker handles Excel parsing and normalization.
 * It searches for the header row dynamically to handle files with titles/empty rows.
 */

const { parentPort, workerData } = require('worker_threads');
const xlsx = require('xlsx');
const fs = require('fs');

async function run() {
    const { filePath, type, options } = workerData;
    const chunkSize = options.chunkSize || 500;

    try {
        if (!fs.existsSync(filePath)) {
            throw new Error('Dosya bulunamadı: ' + filePath);
        }

        parentPort.postMessage({ type: 'status', message: 'Excel dosyası okunuyor...' });

        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Use header:1 to get raw rows as arrays
        const allRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (allRows.length === 0) {
            throw new Error('Excel dosyasında veri bulunamadı.');
        }

        parentPort.postMessage({ type: 'status', message: 'Başlıklar taranıyor...' });

        // Normalization helper
        const normalize = (s) => String(s || '').toLocaleLowerCase('tr-TR')
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/i̇/g, 'i') // Handle dotted i (U+0307)
            .trim()
            .replace(/[^a-z0-9]/g, '');

        // 1. Find Header Row and Column Indices
        let headerIdx = -1;
        let colMap = {};

        const studentKeys = {
            sira: ['sira', 'sirano', 'sn', 'no'],
            no: ['no', 'öğrencino', 'okulno', 'numara'],
            ad: ['ad', 'adi', 'adiniz', 'isim', 'öğrenciadı'],
            soyad: ['soyad', 'soyadi', 'soyadınız', 'soyisim', 'öğrencisoyadı'],
            tc: ['tc', 'tcno', 'tckimlik', 'tckimlikno', 'kimlikno', 'tckn'],
            anne_adi: ['anne', 'anneadi', 'annesi'],
            baba_adi: ['baba', 'babaadi', 'babası'],
            egitim_turu: ['egitim', 'egitimturu', 'tür', 'türü', 'öğretim'],
            sinif: ['sinif', 'sınıf', 'sınıfı', 'grubu'],
            giris_tarihi: ['giris', 'kayit', 'başlama', 'giristarihi'],
            cikis_tarihi: ['cikis', 'ayrilis', 'bitis', 'cikistarihi']
        };

        const statementKeys = {
            tarih: ['tarih', 'işlemtarihi', 'tarihi', 'valör', 'valörtarihi', 'islemgunu', 'islemgun'],
            kod: [
                'dekontno', 'islemno', 'referansno', 'dekontnumarası', 'islemnumarasi',
                'dekont', 'işlem', 'islem', 'referans', 'refno', 'fisno', 'fino', 'belgeno',
                'islemid', 'id', 'ref', 'fis', 'belge', 'no', 'sirano', 'islemfino',
                'islemsuberefsira', 'transactionid', 'transid', 'belgeid'
            ],
            aciklama: ['açıklama', 'aciklama', 'işlemaçıklaması', 'açıklaması', 'islemaciklamasi', 'detay', 'tanim'],
            tutar: ['tutar', 'miktar', 'işlemtutarı', 'tutar(tl)', 'borç', 'alacak', 'tahsilat', 'odeme', 'tahsil'],
            tur: ['tür', 'tur', 'işlemtürü', 'harekettürü', 'hareket'],
            bakiye: ['bakiye', 'bakiyemiktar', 'bakıye', 'sonbakiye']
        };

        const targetKeys = type === 'students' ? studentKeys : statementKeys;
        const normalizedTargetMap = {};
        Object.keys(targetKeys).forEach(k => {
            targetKeys[k].forEach(alias => {
                normalizedTargetMap[normalize(alias)] = k;
            });
        });

        // Search for header row in the first 50 rows
        for (let i = 0; i < Math.min(50, allRows.length); i++) {
            const row = allRows[i];
            let matches = 0;
            const tempMap = {};

            row.forEach((cell, colIdx) => {
                const normCell = normalize(cell);
                if (normalizedTargetMap[normCell]) {
                    const key = normalizedTargetMap[normCell];
                    // If multiple columns match the same key, prioritize better aliases
                    // (Actually the simple version is fine, we just reordered the aliases in the arrays)
                    if (!tempMap[key]) {
                        tempMap[key] = colIdx;
                        matches++;
                    }
                }
            });

            // If we found at least 3 columns (for students) or 2 (for statements), this is likely the header row
            const minMatches = type === 'students' ? 3 : 3;
            if (matches >= minMatches) {
                headerIdx = i;
                colMap = tempMap;
                break;
            }
        }

        if (headerIdx === -1) {
            // Fallback: If no header found, assume it's an e-Okul style or fixed format if it's students
            if (type === 'students') {
                // Try to guess by column contents in next step or throw
                throw new Error('Excel başlıkları algılanamadı. Lütfen şablona uygun bir dosya yükleyin.');
            } else {
                throw new Error('Excel başlıkları algılanamadı.');
            }
        }

        const dataRows = allRows.slice(headerIdx + 1);
        const total = dataRows.length;

        // Signal start with total count
        parentPort.postMessage({ type: 'start', total: total });
        parentPort.postMessage({ type: 'status', message: `${total} kayıt işleniyor...` });

        const processedData = [];
        let validCount = 0;

        for (let i = 0; i < total; i++) {
            const row = dataRows[i];

            const getVal = (key) => {
                const idx = colMap[key];
                return idx !== undefined ? String(row[idx] || '').trim() : '';
            };

            if (type === 'students') {
                const student = {
                    sira: parseInt(getVal('sira')) || 0,
                    no: getVal('no'),
                    ad: getVal('ad').toUpperCase(),
                    soyad: getVal('soyad').toUpperCase(),
                    tc: getVal('tc'),
                    anne_adi: getVal('anne_adi').toUpperCase(),
                    baba_adi: getVal('baba_adi').toUpperCase(),
                    egitim_turu: getVal('egitim_turu').toUpperCase(),
                    sinif: getVal('sinif').toUpperCase(),
                    giris_tarihi: getVal('giris_tarihi'),
                    cikis_tarihi: getVal('cikis_tarihi')
                };

                // Minimal validation
                if (!student.ad && !student.tc) continue;
                validCount++;
                processedData.push(student);
            } else if (type === 'statements') {
                // Sayısal değer temizliği (Binlik ve ondalık ayıracı karmaşasını çöz)
                let rawVal = String(getVal('tutar') || '0').trim();
                let tutarVal = 0;
                if (rawVal.includes(',') && rawVal.includes('.')) {
                    const lastComma = rawVal.lastIndexOf(',');
                    const lastDot = rawVal.lastIndexOf('.');
                    if (lastComma > lastDot) {
                        tutarVal = parseFloat(rawVal.replace(/\./g, '').replace(',', '.'));
                    } else {
                        tutarVal = parseFloat(rawVal.replace(/,/g, ''));
                    }
                } else if (rawVal.includes(',')) {
                    tutarVal = parseFloat(rawVal.replace(',', '.'));
                } else {
                    tutarVal = parseFloat(rawVal);
                }

                // Bakiye temizliği
                let rawBakiye = String(getVal('bakiye') || '0').trim();
                let bakiyeVal = 0;
                if (rawBakiye.includes(',') && rawBakiye.includes('.')) {
                    const lastComma = rawBakiye.lastIndexOf(',');
                    const lastDot = rawBakiye.lastIndexOf('.');
                    if (lastComma > lastDot) {
                        bakiyeVal = parseFloat(rawBakiye.replace(/\./g, '').replace(',', '.'));
                    } else {
                        bakiyeVal = parseFloat(rawBakiye.replace(/,/g, ''));
                    }
                } else if (rawBakiye.includes(',')) {
                    bakiyeVal = parseFloat(rawBakiye.replace(',', '.'));
                } else {
                    bakiyeVal = parseFloat(rawBakiye);
                }

                const turStr = getVal('tur').toLocaleLowerCase('tr-TR');
                const aciklamaStr = getVal('aciklama').toLocaleLowerCase('tr-TR');

                // Gider kriterleri: 
                // 1. Tutar negatifse kesin giderdir.
                // 2. Tür kolonunda "Borç", "Çıkan" veya "Eksilen" gibi net ifadeler varsa giderdir.
                // 3. "Ödeme" kelimesi veli ödemeleriyle (Gelir) karıştığı için buradan çıkarıldı.
                const isGider = tutarVal < 0 ||
                    turStr.includes('borç') ||
                    turStr.includes('çıkan') ||
                    turStr.includes('eksilen') ||
                    turStr.includes('gider') ||
                    aciklamaStr.includes('kira ödemesi') ||
                    aciklamaStr.includes('maaş ödemesi');

                const statement = {
                    tarih: getVal('tarih'),
                    kod: getVal('kod'),
                    aciklama: getVal('aciklama').toUpperCase(),
                    tutar: Math.abs(tutarVal),
                    tur: isGider ? 'Gider' : 'Gelir',
                    bakiye: bakiyeVal || 0
                };
                if (!statement.kod && !statement.aciklama) continue;
                validCount++;
                processedData.push(statement);
            }

            if (processedData.length >= chunkSize) {
                parentPort.postMessage({
                    type: 'data',
                    data: [...processedData],
                    current: i + 1,
                    total: total
                });
                processedData.length = 0;
            }
        }

        // Send remaining
        if (processedData.length > 0) {
            parentPort.postMessage({
                type: 'data',
                data: processedData,
                current: total,
                total: total
            });
        }

        if (validCount === 0 && total > 0) {
            throw new Error('Dosyada geçerli kayıt bulunamadı. Başlıkların (Ad, Soyad, TC vb.) doğru olduğundan emin olun.');
        }

        parentPort.postMessage({ type: 'done', total: total, valid: validCount });

    } catch (error) {
        console.error('[WORKER-ERROR]', error);
        parentPort.postMessage({ type: 'error', message: error.message });
    }
}

run();
