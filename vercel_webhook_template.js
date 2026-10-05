/**
 * Shopier Webhook & Automatic License Email Delivery
 * Deploy to Vercel (Vercel Serverless Function)
 * Endpoint: https://YOUR_VERCEL_PROJECT.vercel.app/api/shopier_webhook
 */

const https = require('https');
const nodemailer = require('nodemailer');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const SETUP_DOWNLOAD_LINK = process.env.SETUP_DOWNLOAD_LINK || 'https://github.com/YOUR_USER/YOUR_REPO/releases/latest';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
});

async function createLicenseInSupabase(name, email, planType, orderId) {
    const payload = JSON.stringify({
        p_school_name: name,
        p_email: email,
        p_plan_type: planType,
        p_order_id: String(orderId)
    });

    const url = new URL(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/create_shopier_license`);

    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function sendLicenseEmail(toEmail, name, licenseKey, orderId, planType) {
    const planName = planType === 'LIFETIME' ? 'Süresiz (Ömür Boyu) Lisans' : '1 Yıllık Lisans';

    const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 25px; background: #f8fafc; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
            <h2 style="color: #4f46e5; margin-top: 0;">🎉 Siparişiniz Tamamlandı!</h2>
            <p>Merhaba <strong>${name}</strong>,</p>
            <p><strong>Zübeyde Hanım Çocuk Kulübü Aidat Takip Sistemi</strong> lisans anahtarınız başarıyla üretilmiştir.</p>
            
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0; border: 1px solid #cbd5e1;">
                <span style="font-size: 13px; color: #64748b; display: block; margin-bottom: 5px;">Lisans Türü: ${planName}</span>
                <span style="font-size: 24px; font-family: monospace; font-weight: bold; color: #4f46e5; letter-spacing: 2px;">${licenseKey}</span>
            </div>

            <p style="text-align: center; margin-top: 30px;">
                <a href="${SETUP_DOWNLOAD_LINK}" style="background: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">📥 Programı İndir (.EXE)</a>
            </p>

            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">Sipariş Numarası: #${orderId}</p>
        </div>
    </div>
    `;

    return transporter.sendMail({
        from: `"Aidat Takip Sistemi" <${GMAIL_USER}>`,
        to: toEmail,
        subject: `Lisans Anahtarınız (#${orderId})`,
        html: htmlContent
    });
}

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') return res.status(200).end();

    const body = req.body || {};
    const email = body.email || body.buyer_email || '';
    const orderId = body.orderid || body.order_id || `ORD-${Date.now()}`;
    const name = `${body.buyername || ''} ${body.buyersurname || ''}`.trim() || 'Değerli Müşterimiz';

    const fullText = JSON.stringify(body).toLowerCase();
    let planType = 'ANNUAL';
    if (fullText.includes('süresiz') || fullText.includes('lifetime') || fullText.includes('ömür boyu')) {
        planType = 'LIFETIME';
    } else if (fullText.includes('aylık') || fullText.includes('monthly')) {
        planType = 'MONTHLY';
    }

    if (email) {
        try {
            const licResult = await createLicenseInSupabase(name, email, planType, orderId);
            if (licResult && licResult.license_key) {
                await sendLicenseEmail(email, name, licResult.license_key, orderId, planType);
            }
        } catch (e) {
            console.error('Webhook error:', e);
        }
    }

    res.status(200).send("success");
};
