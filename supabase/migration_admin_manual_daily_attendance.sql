-- ==============================================================================
-- MIGRATION: IZINKAN ADMIN / OWNER / MASTER MEMBERIKAN KETERANGAN HADIR MANUAL
-- PADA TABEL attendance_feed (ABSEN HARIAN TANPA FOTO)
-- ==============================================================================

-- 1. Perbarui policy INSERT agar Admin / Owner / Master dapat mencatat kehadiran
--    atas nama anak magang di absen harian tanpa foto
DROP POLICY IF EXISTS "User terotentikasi dapat memposting feed atas namanya sendiri" ON public.attendance_feed;
DROP POLICY IF EXISTS "User atau admin/owner dapat memposting feed absensi" ON public.attendance_feed;
CREATE POLICY "User atau admin/owner dapat memposting feed absensi"
  ON public.attendance_feed FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (
        profiles.role = 'master'
        OR 'owner' = ANY(profiles.roles)
        OR 'admin' = ANY(profiles.roles)
      )
    )
  );

-- 2. Tambahkan policy UPDATE agar pembuat atau Admin / Owner / Master dapat mengubah keterangan
DROP POLICY IF EXISTS "Pembuat atau admin/owner dapat mengubah pesan feed" ON public.attendance_feed;
CREATE POLICY "Pembuat atau admin/owner dapat mengubah pesan feed"
  ON public.attendance_feed FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (
        profiles.role = 'master'
        OR 'owner' = ANY(profiles.roles)
        OR 'admin' = ANY(profiles.roles)
      )
    )
  )
  WITH CHECK (true);
