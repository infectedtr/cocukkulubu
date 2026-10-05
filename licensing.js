const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { exec, execSync } = require('child_process');

// Supabase Yapılandırması (Kendi Supabase projenizin bilgilerini buraya veya env'e ekleyebilirsiniz)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

let cachedHWID = null;

/**
 * Cihazın donanım kimliğini (HWID) güvenli şekilde üretir
 */
function getHWID() {
    if (cachedHWID) return cachedHWID;
    try {
        const output = execSync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { timeout: 1500 }).toString();
        const match = output.match(/MachineGuid\s+REG_SZ\s+(.+)/);
        if (match && match[1]) {
            cachedHWID = match[1].trim();
            return cachedHWID;
        }
    } catch (_) {}

    // Fallback ID (Host + CPU bilgisi)
    const os = require('os');
    const cpus = os.cpus().map(c => c.model).join('');
    const rawString = `${cpus}-${os.hostname()}-${os.platform()}-${process.env.COMPUTERNAME || 'UNKNOWN'}`;
    cachedHWID = crypto.createHash('sha256').update(rawString).digest('hex').substring(0, 32).toUpperCase();
    return cachedHWID;
}

/**
 * Lokal Çevrimdışı Lisans Anahtarı Üretir/Kontrol Eder (ZUBEYDE-SECRET-SALT)
 */
function getLocalValidKey() {
    const hwid = getHWID();
    return crypto.createHash('sha256').update(hwid + "ZUBEYDE-SECRET-SALT").digest('hex').substring(0, 12).toUpperCase();
}

/**
 * Supabase Remote verify_license RPC Çağrısı
 */
function verifySupabaseRemote(licenseKey, hwid) {
    return new Promise((resolve) => {
        if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR_SUPABASE_PROJECT')) {
            return resolve({ success: false, reason: 'SUPABASE_NOT_CONFIGURED' });
        }

        const payload = JSON.stringify({
            p_license_key: licenseKey.trim(),
            p_hwid: hwid
        });

        const endpoint = new URL(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/verify_license`);
        const req = https.request(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Length': Buffer.byteLength(payload)
            },
            timeout: 5000
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data && data.valid) {
                        resolve({ success: true, data: data });
                    } else {
                        resolve({ success: false, reason: data.message || 'Geçersiz lisans.' });
                    }
                } catch (e) {
                    resolve({ success: false, reason: 'Sunucu yanıtı okunamadı.' });
                }
            });
        });

        req.on('error', () => resolve({ success: false, reason: 'OFFLINE' }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, reason: 'TIMEOUT' }); });
        req.write(payload);
        req.end();
    });
}

/**
 * Lisans Doğrulama (Yerel + Çevrimiçi Hibrit Kontrol)
 */
async function verifyLicense(inputKey, userDataPath) {
    const cleanKey = String(inputKey || '').trim().toUpperCase();
    if (!cleanKey) return { valid: false, message: 'Lisans anahtarı boş olamaz.' };

    const hwid = getHWID();

    // 1. Kontrol: Yerel Offline Algoritma Eşleşmesi (LİSANS_URETİCİ.html ile üretilen anahtarlar)
    if (cleanKey === getLocalValidKey()) {
        saveLocalLicenseCache(userDataPath, {
            licenseKey: cleanKey,
            hwid: hwid,
            type: 'OFFLINE_LOCAL',
            activatedAt: new Date().toISOString()
        });
        return { valid: true, message: 'Lokal lisans başarıyla doğrulandı.' };
    }

    // 2. Kontrol: Supabase Çevrimiçi Lisans Kontrolü (Shopier / Online Satın Alımlar)
    const remoteResult = await verifySupabaseRemote(cleanKey, hwid);
    if (remoteResult.success) {
        saveLocalLicenseCache(userDataPath, {
            licenseKey: cleanKey,
            hwid: hwid,
            type: 'ONLINE_SUPABASE',
            details: remoteResult.data,
            activatedAt: new Date().toISOString()
        });
        return { valid: true, message: remoteResult.data.message || 'Çevrimiçi lisans doğrulandı.' };
    }

    // 3. Kontrol: İnternet yoksa ama daha önce yerel önbellekte doğrulanmışsa kabul et (Offline Toleransı)
    if (remoteResult.reason === 'OFFLINE' || remoteResult.reason === 'TIMEOUT' || remoteResult.reason === 'SUPABASE_NOT_CONFIGURED') {
        const cached = readLocalLicenseCache(userDataPath);
        if (cached && cached.licenseKey === cleanKey && cached.hwid === hwid) {
            return { valid: true, message: 'Çevrimdışı modda lisansınız onaylandı.' };
        }
    }

    return { valid: false, message: remoteResult.reason || 'Geçersiz lisans anahtarı!' };
}

/**
 * Kayıtlı Lisansı Oku
 */
function checkStoredLicense(userDataPath) {
    const cached = readLocalLicenseCache(userDataPath);
    if (!cached || !cached.licenseKey) return false;

    const hwid = getHWID();
    // HWID eşleşiyor mu?
    if (cached.hwid && cached.hwid !== hwid) return false;

    // Lokal key ise kontrol et
    if (cached.licenseKey === getLocalValidKey()) return true;

    // Önbellekte geçerli ise kabul et
    return true;
}

function getLicenseFilePath(userDataPath) {
    return path.join(userDataPath, 'license.json');
}

function saveLocalLicenseCache(userDataPath, data) {
    try {
        fs.writeFileSync(getLicenseFilePath(userDataPath), JSON.stringify(data, null, 2), 'utf8');
        // Eski license.key varsa onu da uyumluluk için güncelle
        fs.writeFileSync(path.join(userDataPath, 'license.key'), data.licenseKey, 'utf8');
    } catch (e) {
        console.error('License save error:', e);
    }
}

function readLocalLicenseCache(userDataPath) {
    try {
        const jsonPath = getLicenseFilePath(userDataPath);
        if (fs.existsSync(jsonPath)) {
            return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        }
        const keyPath = path.join(userDataPath, 'license.key');
        if (fs.existsSync(keyPath)) {
            const key = fs.readFileSync(keyPath, 'utf8').trim();
            return { licenseKey: key, hwid: getHWID() };
        }
    } catch (e) {}
    return null;
}

module.exports = {
    getHWID,
    getLocalValidKey,
    verifyLicense,
    checkStoredLicense
};
