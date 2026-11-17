-- ==============================================================================
-- MIGRATION: TARGET USERS RESTRICTION UNTUK SESI ABSEN BERSAMA (QR CODE)
-- Hanya anggota yang dicentang (checklist) oleh inisiator yang diizinkan scan QR
-- ==============================================================================

ALTER TABLE public.group_attendance_sessions
ADD COLUMN IF NOT EXISTS target_user_ids jsonb DEFAULT NULL;

COMMENT ON COLUMN public.group_attendance_sessions.target_user_ids IS 'Array ID pengguna (checklist) yang diizinkan untuk scan QR absen bersama ini';
