-- ==============================================================================
-- Migration: Dukungan Pilihan Role Saat Registrasi (Magang, Piket, Tiket)
-- Membaca metadata selected_role dari pendaftaran pengguna baru
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_full_name text;
  v_phone text;
  v_role public.user_role;
  v_approved boolean;
  v_selected_role text;
  v_roles text[];
  v_exclude_recap boolean;
BEGIN
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  );
  v_phone := coalesce(
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'phone_number',
    ''
  );

  -- Ambil role yang dipilih pendaftar (default 'magang')
  v_selected_role := coalesce(
    new.raw_user_meta_data->>'selected_role',
    new.raw_user_meta_data->>'requested_role',
    'magang'
  );

  -- Validasi role yang boleh diajukan saat registrasi publik
  IF v_selected_role NOT IN ('magang', 'piket', 'tiket') THEN
    v_selected_role := 'magang';
  END IF;

  -- Akun master otomatis disetujui
  IF lower(new.email) = 'madesanjaya255@gmail.com' THEN
    v_role := 'master'::public.user_role;
    v_roles := array['owner', 'magang'];
    v_approved := true;
    v_exclude_recap := false;
  ELSE
    v_role := 'user'::public.user_role;
    v_roles := array[v_selected_role];
    v_approved := false;
    v_exclude_recap := (v_selected_role NOT IN ('magang', 'piket'));
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, phone, role, roles, is_approved, exclude_from_recap, created_at, updated_at
  )
  VALUES (
    new.id, new.email, v_full_name, v_phone, v_role, v_roles, v_approved, v_exclude_recap, now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    full_name = CASE 
      WHEN excluded.full_name IS NOT NULL AND excluded.full_name <> '' THEN excluded.full_name 
      ELSE public.profiles.full_name 
    END,
    phone = CASE 
      WHEN excluded.phone IS NOT NULL AND excluded.phone <> '' THEN excluded.phone 
      ELSE public.profiles.phone 
    END,
    roles = CASE
      WHEN public.profiles.roles IS NULL OR public.profiles.roles = '{}' THEN excluded.roles
      ELSE public.profiles.roles
    END,
    updated_at = now();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
