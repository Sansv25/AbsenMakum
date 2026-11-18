-- ==============================================================================
-- Migration: Izinkan user_id bernilai NULL pada tabel attendances
-- Tujuan: Memberikan opsi bagi Akun Master untuk mengosongkan / tidak memilih
--         petugas piket pada shift absensi tertentu.
-- ==============================================================================

-- 1. Buat kolom user_id pada tabel attendances dapat bernilai NULL
ALTER TABLE public.attendances ALTER COLUMN user_id DROP NOT NULL;

-- 2. Pastikan kebijakan RLS attendances_update dan attendances_insert mengizinkan Master
DROP POLICY IF EXISTS "attendances_update" ON public.attendances;
CREATE POLICY "attendances_update" ON public.attendances
  FOR UPDATE USING (user_id = auth.uid() OR public.is_master(auth.uid()));

DROP POLICY IF EXISTS "attendances_select_all" ON public.attendances;
CREATE POLICY "attendances_select_all" ON public.attendances
  FOR SELECT USING (auth.role() = 'authenticated');

