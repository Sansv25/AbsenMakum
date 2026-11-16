-- ==============================================================================
-- MIGRATION: Tambah Kolom Nomor Telepon Alternatif (alt_phone / CP Alt)
-- ==============================================================================

-- 1. Tambahkan kolom alt_phone ke tabel tickets jika belum ada
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS alt_phone text;

-- 2. Berikan komentar deskriptif pada kolom
COMMENT ON COLUMN public.tickets.alt_phone IS 'Nomor telepon / kontak alternatif (CP Alt) pelanggan';
