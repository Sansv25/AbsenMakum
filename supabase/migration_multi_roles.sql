-- ==============================================================================
-- Migration: Sistem Multi-Role Bertumpuk (Owner, Admin, Senior, Magang)
-- 
-- 1. Owner: 1 orang (madesanjaya255@gmail.com), akses paling lengkap seluruh sistem.
-- 2. Admin: Akses Pengaturan hanya Manajemen Shift dan Manajemen Akun.
-- 3. Senior: Sama seperti Admin, tapi otomatis tidak direkap.
-- 4. Magang: Pengganti Petugas Piket, dihitung dalam rekapitulasi kehadiran.
-- * Role boleh ditumpuk (misal: Owner + Magang, Admin + Magang, dll).
-- ==============================================================================

-- 1. Tambah kolom roles (array of text) di tabel profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS roles text[] DEFAULT '{"magang"}';

-- 2. Perbarui RPC is_master agar mengakomodasi owner, admin, dan senior
CREATE OR REPLACE FUNCTION public.is_master(uid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND (
      role = 'master' 
      OR 'owner' = ANY(roles) 
      OR 'admin' = ANY(roles) 
      OR 'senior' = ANY(roles)
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Tambah RPC is_owner untuk fitur khusus Owner tertinggi
CREATE OR REPLACE FUNCTION public.is_owner(uid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND (
      'owner' = ANY(roles) 
      OR lower(email) = 'madesanjaya255@gmail.com'
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. Migrasi data lama ke sistem multi-role bertumpuk
-- A. Owner Utama (madesanjaya255@gmail.com): Owner + Magang
UPDATE public.profiles
SET roles = '{"owner", "magang"}',
    role = 'master',
    is_approved = true,
    exclude_from_recap = false
WHERE lower(email) = 'madesanjaya255@gmail.com';

-- B. Akun master lainnya yang bukan email owner: default menjadi Admin
UPDATE public.profiles
SET roles = '{"admin"}',
    role = 'master'
WHERE role = 'master' 
  AND lower(email) != 'madesanjaya255@gmail.com'
  AND (roles IS NULL OR roles = '{}' OR roles = '{"magang"}');

-- C. Akun petugas biasa: menjadi Magang
UPDATE public.profiles
SET roles = '{"magang"}',
    role = 'user'
WHERE (role = 'user' OR role IS NULL)
  AND lower(email) != 'madesanjaya255@gmail.com'
  AND (roles IS NULL OR roles = '{}');

-- D. Sinkronisasi exclude_from_recap: Jika tidak punya role 'magang', otomatis tidak direkap
UPDATE public.profiles
SET exclude_from_recap = true
WHERE NOT ('magang' = ANY(roles));

UPDATE public.profiles
SET exclude_from_recap = false
WHERE 'magang' = ANY(roles) AND (exclude_from_recap IS NULL);
