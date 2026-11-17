-- ==============================================================================
-- MIGRATION: KEBIJAKAN PEMBERSIHAN OTOMATIS OBROLAN FEED > 168 JAM (7 HARI)
-- Mengizinkan pembersihan otomatis baris obrolan (feed_type = 'chat')
-- yang sudah berumur lebih dari 168 jam (7 hari) tanpa menyentuh data absensi.
-- ==============================================================================

-- 1. Index untuk mempercepat pencarian dan penghapusan obrolan lama
CREATE INDEX IF NOT EXISTS idx_attendance_feed_chat_cleanup 
ON public.attendance_feed (feed_type, created_at) 
WHERE feed_type = 'chat';

-- 2. Kebijakan RLS agar pengguna terotentikasi dapat menjalankan delete obrolan lama
DROP POLICY IF EXISTS "Pembersihan otomatis obrolan lama 7 hari" ON public.attendance_feed;
CREATE POLICY "Pembersihan otomatis obrolan lama 7 hari"
  ON public.attendance_feed FOR DELETE
  TO authenticated
  USING (
    feed_type = 'chat' AND created_at < (now() - interval '168 hours')
  );
