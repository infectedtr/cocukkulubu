-- =====================================================================
-- ZÜBEYDE HANIM ÇOCUK KULÜBÜ AİDAT TAKİP SİSTEMİ
-- Supabase Veritabanı Şeması & Lisanslama RPC Fonksiyonları
-- =====================================================================

-- 1. Lisanslar Tablosu
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    license_key VARCHAR(64) NOT NULL UNIQUE,
    school_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    hwid VARCHAR(255),
    order_id VARCHAR(100),
    plan_type VARCHAR(50) DEFAULT 'ANNUAL', -- 'ANNUAL', 'MONTHLY', 'LIFETIME'
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_hwid ON public.licenses(hwid);

-- 2. İstemci Lisans Doğrulama RPC Fonksiyonu (verify_license)
CREATE OR REPLACE FUNCTION public.verify_license(
    p_license_key TEXT,
    p_hwid TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rec RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT * INTO v_rec FROM public.licenses
    WHERE UPPER(TRIM(license_key)) = UPPER(TRIM(p_license_key));

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Lisans anahtarı bulunamadı.');
    END IF;

    IF v_rec.is_active = FALSE THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Bu lisans iptal edilmiştir.');
    END IF;

    IF v_rec.expires_at IS NOT NULL AND v_rec.expires_at < v_now THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Lisans süreniz dolmuştur.');
    END IF;

    -- HWID Kilitleme: İlk çalıştırmada cihaza kilitle, sonraki çalıştırmalarda doğrula
    IF v_rec.hwid IS NULL OR TRIM(v_rec.hwid) = '' THEN
        UPDATE public.licenses
        SET hwid = p_hwid, activated_at = v_now, updated_at = v_now
        WHERE id = v_rec.id;
    ELSIF v_rec.hwid <> p_hwid THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Bu lisans başka bir bilgisayarda aktif edilmiştir!');
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'license_key', v_rec.license_key,
        'school_name', v_rec.school_name,
        'plan_type', v_rec.plan_type,
        'expires_at', v_rec.expires_at,
        'message', 'Lisans başarıyla doğrulandı.'
    );
END;
$$;

-- 3. Shopier Webhook Lisans Üretim RPC Fonksiyonu (create_shopier_license)
CREATE OR REPLACE FUNCTION public.create_shopier_license(
    p_school_name TEXT,
    p_email TEXT,
    p_plan_type TEXT DEFAULT 'ANNUAL',
    p_order_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_key TEXT;
    v_expires TIMESTAMPTZ;
BEGIN
    IF UPPER(p_plan_type) = 'MONTHLY' THEN
        v_expires := NOW() + INTERVAL '30 days';
    ELSIF UPPER(p_plan_type) = 'LIFETIME' THEN
        v_expires := NULL;
    ELSE
        v_expires := NOW() + INTERVAL '365 days';
    END IF;

    -- Format: AIDAT-2026-X8B9-72C4
    v_key := 'AIDAT-' || to_char(NOW(), 'YYYY') || '-' ||
             UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 4)) || '-' ||
             UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 5 FOR 4));

    INSERT INTO public.licenses (license_key, school_name, email, order_id, plan_type, expires_at)
    VALUES (v_key, p_school_name, p_email, p_order_id, UPPER(p_plan_type), v_expires);

    RETURN jsonb_build_object(
        'success', true,
        'license_key', v_key,
        'expires_at', v_expires
    );
END;
$$;
