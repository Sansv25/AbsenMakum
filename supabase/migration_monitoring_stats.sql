-- ==============================================================================
-- Migration: Fungsi RPC Monitoring Kapasitas Supabase Storage & Database
-- 
-- Fungsi ini digunakan oleh Akun Master di menu Pengaturan -> Monitoring Supabase
-- untuk membaca kapasitas persis disk PostgreSQL dan penyimpanan bucket evidence.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_system_storage_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  db_size_bytes bigint := 0;
  storage_size_bytes bigint := 0;
  storage_file_count bigint := 0;
  attendances_count bigint := 0;
  attachments_count bigint := 0;
  profiles_count bigint := 0;
  foto_mulai_count bigint := 0;
  foto_selesai_count bigint := 0;
  foto_aktivitas_count bigint := 0;
  foto_ticket_count bigint := 0;
BEGIN
  -- Hanya Akun Master yang diizinkan melihat metrik kapasitas sistem
  IF NOT public.is_master(caller_id) THEN
    RETURN json_build_object('success', false, 'error', 'Hanya Akun Master yang diizinkan melihat metrik sistem.');
  END IF;

  -- 1. Database Size riil dari disk PostgreSQL
  SELECT pg_database_size(current_database()) INTO db_size_bytes;

  -- 2. Storage Objects (dari storage.objects untuk bucket 'evidence')
  BEGIN
    SELECT
      coalesce(sum((metadata->>'size')::bigint), 0),
      count(*)
    INTO storage_size_bytes, storage_file_count
    FROM storage.objects
    WHERE bucket_id = 'evidence';
  EXCEPTION WHEN OTHERS THEN
    SELECT count(*) INTO storage_file_count FROM public.attachments;
    storage_size_bytes := storage_file_count * 327680;
  END;

  -- 3. Row Counts
  SELECT count(*) INTO attendances_count FROM public.attendances;
  SELECT count(*) INTO attachments_count FROM public.attachments;
  SELECT count(*) INTO profiles_count FROM public.profiles;

  -- 4. Breakdown jenis foto bukti
  SELECT count(*) INTO foto_mulai_count FROM public.attachments WHERE kind = 'mulai';
  SELECT count(*) INTO foto_selesai_count FROM public.attachments WHERE kind = 'selesai';
  SELECT count(*) INTO foto_aktivitas_count FROM public.attachments WHERE kind = 'aktivitas';
  SELECT count(*) INTO foto_ticket_count FROM public.attachments WHERE kind = 'ticket';

  RETURN json_build_object(
    'success', true,
    'db_size_bytes', db_size_bytes,
    'db_limit_bytes', 524288000, -- 500 MB Free Tier
    'storage_size_bytes', storage_size_bytes,
    'storage_limit_bytes', 1073741824, -- 1 GB Free Tier
    'storage_file_count', storage_file_count,
    'attendances_count', attendances_count,
    'attachments_count', attachments_count,
    'profiles_count', profiles_count,
    'breakdown', json_build_object(
      'mulai', foto_mulai_count,
      'selesai', foto_selesai_count,
      'aktivitas', foto_aktivitas_count,
      'ticket', foto_ticket_count
    )
  );
END;
$$;

-- Berikan izin akses eksekusi RPC ke user terautentikasi
GRANT EXECUTE ON FUNCTION public.get_system_storage_stats() TO authenticated;

