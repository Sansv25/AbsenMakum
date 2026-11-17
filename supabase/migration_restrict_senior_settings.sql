-- ==============================================================================
-- Migration: Kunci Akses Role Senior agar Tidak Bisa Akses Pengaturan & Akun
-- Senior: Pengawas operasional lapangan (Piket & Absen Harian).
-- Hanya 'owner' dan 'admin' yang berhak mengelola Pengaturan & Akun Pengguna.
-- ==============================================================================

-- 1. Perbarui RPC public.is_master
CREATE OR REPLACE FUNCTION public.is_master(uid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND (
      'owner' = ANY(roles) 
      OR 'admin' = ANY(roles)
      OR (role = 'master' AND NOT ('senior' = ANY(roles)))
      OR lower(email) = 'madesanjaya255@gmail.com'
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Sinkronisasi akun yang memiliki role senior (dan tidak punya owner/admin) agar role kolomnya = 'user'
UPDATE public.profiles
SET role = 'user'
WHERE 'senior' = ANY(roles)
  AND NOT ('owner' = ANY(roles) OR 'admin' = ANY(roles))
  AND lower(email) != 'madesanjaya255@gmail.com';
