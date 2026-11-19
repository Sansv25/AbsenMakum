-- ==============================================================================
-- MIGRATION: MULTI-DEVICE & MULTI-BOT WORKER POOL + ANTI-BENTROK AKUN
-- Jalankan skrip ini di SQL Editor Supabase Dashboard (Klik Run)
-- ==============================================================================

-- 1. Tabel Registry Bot Worker (melacak semua device/laptop yang online)
CREATE TABLE IF NOT EXISTS public.bot_workers (
  bot_id text PRIMARY KEY,
  ig_user_id text NOT NULL,
  ig_username text,
  user_email text NOT NULL,
  hostname text NOT NULL,
  active_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'paused', 'offline')),
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_workers_online
  ON public.bot_workers (status, last_heartbeat DESC);

CREATE INDEX IF NOT EXISTS idx_bot_workers_ig_user
  ON public.bot_workers (ig_user_id);

ALTER TABLE public.bot_workers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bot_workers_authenticated_all" ON public.bot_workers;
CREATE POLICY "bot_workers_authenticated_all" ON public.bot_workers
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 2. Tambah kolom kepemilikan bot & draf AI per tiket di tabel tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS runner_id text,
  ADD COLUMN IF NOT EXISTS runner_ig_id text,
  ADD COLUMN IF NOT EXISTS runner_label text,
  ADD COLUMN IF NOT EXISTS pending_ai_reply jsonb DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_status_runner_ig
  ON public.tickets (status, runner_ig_id);

-- 3. Hapus indeks unik lama yang membatasi hanya 1 tiket aktif di SELURUH sistem (legacy single-bot)
DROP INDEX IF EXISTS public.one_active_ticket_idx;

-- 4. Buat indeks baru Multi-Bot: setiap akun Instagram bot hanya boleh memproses 1 tiket aktif di saat bersamaan
CREATE UNIQUE INDEX IF NOT EXISTS one_active_ticket_per_runner_ig_idx
  ON public.tickets (runner_ig_id)
  WHERE status IN ('in_conversation', 'needs_admin') AND runner_ig_id IS NOT NULL;

-- 5. Aktifkan Realtime untuk tabel bot_workers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bot_workers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_workers;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
