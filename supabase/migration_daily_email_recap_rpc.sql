-- ==============================================================================
-- MIGRATION: Kolom Pengaturan & Pelacakan Otomatis Rekapan Harian Anak Magang
-- ==============================================================================

ALTER TABLE public.email_recap_settings
  ADD COLUMN IF NOT EXISTS daily_recipients text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS daily_is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS daily_send_time text NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS daily_last_sent_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS daily_last_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS daily_auto_last_sent_date text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS daily_last_attempt_at timestamptz DEFAULT NULL;
