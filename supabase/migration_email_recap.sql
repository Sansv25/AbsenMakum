-- ==============================================================================
-- Migration: Tabel Pengaturan Email Rekapan Otomatis (Brevo API)
-- 
-- Digunakan untuk menyimpan daftar email tujuan rekapan (mingguan/bulanan),
-- konfigurasi pengirim Brevo, dan status pengiriman rekapan PDF.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.email_recap_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipients text[] NOT NULL DEFAULT '{}',
  frequency text NOT NULL DEFAULT 'mingguan' CHECK (frequency IN ('mingguan', 'bulanan', 'keduanya')),
  is_active boolean NOT NULL DEFAULT true,
  sender_name text NOT NULL DEFAULT 'Absensi Piket ICONNET',
  sender_email text NOT NULL DEFAULT '',
  brevo_api_key text DEFAULT NULL,
  send_day_weekly int NOT NULL DEFAULT 1, -- 1 = Senin, 7 = Minggu
  send_time text NOT NULL DEFAULT '08:00',
  last_sent_at timestamptz DEFAULT NULL,
  last_status text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: Hanya Akun Master yang boleh mengelola email_recap_settings
ALTER TABLE public.email_recap_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_recap_settings_master_select" ON public.email_recap_settings;
CREATE POLICY "email_recap_settings_master_select" ON public.email_recap_settings
  FOR SELECT USING (public.is_master(auth.uid()));

DROP POLICY IF EXISTS "email_recap_settings_master_all" ON public.email_recap_settings;
CREATE POLICY "email_recap_settings_master_all" ON public.email_recap_settings
  FOR ALL USING (public.is_master(auth.uid()));

-- Insert baris default jika tabel masih kosong
INSERT INTO public.email_recap_settings (id, recipients, frequency, is_active, sender_name, sender_email)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  ARRAY[]::text[],
  'mingguan',
  true,
  'Absensi Piket ICONNET',
  ''
WHERE NOT EXISTS (SELECT 1 FROM public.email_recap_settings LIMIT 1);

