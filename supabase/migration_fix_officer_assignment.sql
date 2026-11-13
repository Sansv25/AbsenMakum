-- ==============================================================================
-- Migration: Perbaikan Sistem Assignment & Penguncian Petugas Piket
-- 
-- 1. Mengizinkan user_id NULL pada tabel attendances (form kosong = belum ada yang mengisi)
-- 2. Memperbaiki kebijakan RLS attendances_update agar petugas yang mengisi form dapat
--    mengklaim/mengunci absensi atas namanya sendiri (tidak terhalang RLS user_id lama)
-- 3. Membuat fungsi RPC claim_attendance_officer dengan SECURITY DEFINER
-- 4. Melakukan sinkronisasi data lama agar uploader foto sebenarnya yang menjadi petugas,
--    dan form yang kosong dikembalikan menjadi belum ada yang mengisi.
-- ==============================================================================

-- 1. Pastikan kolom user_id dapat bernilai NULL
ALTER TABLE public.attendances ALTER COLUMN user_id DROP NOT NULL;

-- 2. Perbarui Kebijakan RLS attendances_update
DROP POLICY IF EXISTS "attendances_update" ON public.attendances;
CREATE POLICY "attendances_update" ON public.attendances
  FOR UPDATE USING (
    -- Boleh update jika akun adalah pemilik baris saat ini
    user_id = auth.uid()
    -- Boleh update jika user_id masih kosong (belum ada pengisi)
    OR user_id IS NULL
    -- Boleh update jika Akun Master
    OR public.is_master(auth.uid())
    -- Boleh update jika belum ada lampiran dari user lain (misal user lama hanya membuka form)
    OR NOT EXISTS (
      SELECT 1 FROM public.attachments 
      WHERE attendance_id = attendances.id 
      AND user_id != auth.uid()
    )
  );

-- 3. Fungsi RPC untuk mengklaim dan mengunci petugas yang mengisi absensi
CREATE OR REPLACE FUNCTION public.claim_attendance_officer(
  target_attendance_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  curr_att record;
  other_count int;
BEGIN
  IF caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tidak terautentikasi');
  END IF;

  SELECT * INTO curr_att FROM public.attendances WHERE id = target_attendance_id;
  IF curr_att.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Data absensi tidak ditemukan');
  END IF;

  -- Jika absensi sudah dikunci dan bukan master, tolak
  IF curr_att.is_locked AND NOT public.is_master(caller_id) THEN
    RETURN json_build_object('success', false, 'error', 'Absensi telah dikunci');
  END IF;

  -- Cek apakah ada bukti foto dari user lain pada absensi ini
  SELECT count(*) INTO other_count
  FROM public.attachments
  WHERE attendance_id = target_attendance_id AND user_id != caller_id;

  -- Jika ada bukti foto dari user lain dan pemanggil bukan master, jangan timpa
  IF other_count > 0 AND NOT public.is_master(caller_id) THEN
    RETURN json_build_object('success', false, 'error', 'Absensi telah diisi oleh rekan petugas lain');
  END IF;

  -- Kunci kepemilikan absensi ke user yang sedang mengisi/mengunggah
  UPDATE public.attendances
  SET user_id = caller_id,
      updated_at = now()
  WHERE id = target_attendance_id;

  RETURN json_build_object('success', true, 'user_id', caller_id);
END;
$$;

-- Berikan izin akses eksekusi RPC ke user terautentikasi
GRANT EXECUTE ON FUNCTION public.claim_attendance_officer(uuid) TO authenticated;

-- 4. Pembersihan & Sinkronisasi Data Lama (Self-Healing Query)

-- A. Perbaiki absensi yang fotonya diunggah oleh user lain tapi user_id-nya masih akun orang lain
UPDATE public.attendances a
SET user_id = att.uploader_id,
    updated_at = now()
FROM (
  SELECT attendance_id, user_id AS uploader_id,
         row_number() OVER (PARTITION BY attendance_id ORDER BY created_at ASC) as rn
  FROM public.attachments
) att
WHERE a.id = att.attendance_id
  AND att.rn = 1
  AND a.user_id != att.uploader_id
  AND (a.is_locked IS NULL OR a.is_locked = false);

-- B. Kembalikan form piket yang kosong ke status NULL ('Belum ada yang mengisi')
UPDATE public.attendances a
SET user_id = NULL,
    updated_at = now()
WHERE (a.is_locked IS NULL OR a.is_locked = false)
  AND (a.note IS NULL OR trim(a.note) = '')
  AND NOT EXISTS (
    SELECT 1 FROM public.attachments att WHERE att.attendance_id = a.id
  );

