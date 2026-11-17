-- ==============================================================================
-- MIGRATION: Pengaturan Email Rekapan Absen Harian (Anak Magang)
-- ==============================================================================

ALTER TABLE public.email_recap_settings 
  ADD COLUMN IF NOT EXISTS daily_recipients text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS daily_is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS daily_send_time text NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS daily_last_sent_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS daily_last_status text DEFAULT NULL;

COMMENT ON COLUMN public.email_recap_settings.daily_recipients IS 'Daftar email tujuan untuk laporan rekapan kehadiran absen harian anak magang';
COMMENT ON COLUMN public.email_recap_settings.daily_is_active IS 'Status aktif pengiriman otomatis rekapan absen harian';
COMMENT ON COLUMN public.email_recap_settings.daily_send_time IS 'Waktu pengiriman rekapan absen harian (WITA)';
