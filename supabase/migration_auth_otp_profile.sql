-- ==============================================================================
-- MIGRATION: AUTH REGISTRASI GOOGLE, EMAIL OTP & PROFIL PENGGUNA
-- Jalankan skrip ini di SQL Editor Supabase Dashboard (Klik Run)
-- ==============================================================================

-- 1. Tambah kolom full_name dan phone di tabel public.profiles jika belum ada
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists phone text;

-- 2. Perbarui trigger handle_new_user untuk mengekstrak metadata nama & telepon
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_full_name text;
  v_phone text;
  v_role public.user_role;
begin
  -- Ekstrak nama lengkap dari berbagai sumber metadata (email signup atau Google OAuth)
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  );
  
  -- Ekstrak nomor telepon dari metadata
  v_phone := coalesce(
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'phone_number',
    ''
  );

  -- Tentukan role (master untuk email master terdaftar, user untuk lainnya)
  if lower(new.email) = 'madesanjaya255@gmail.com' then
    v_role := 'master'::public.user_role;
  else
    v_role := 'user'::public.user_role;
  end if;

  insert into public.profiles (id, email, full_name, phone, role, created_at, updated_at)
  values (
    new.id,
    new.email,
    v_full_name,
    v_phone,
    v_role,
    now(),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case 
      when excluded.full_name is not null and excluded.full_name <> '' then excluded.full_name 
      else public.profiles.full_name 
    end,
    phone = case 
      when excluded.phone is not null and excluded.phone <> '' then excluded.phone 
      else public.profiles.phone 
    end,
    updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

-- Pastikan trigger terpasang pada auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Kebijakan RLS agar user yang sedang login bisa mengupdate profilnya sendiri (misal melengkapi no telfon)
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- 4. Perbarui RPC admin_get_users agar menyertakan data full_name dan phone untuk Master
drop function if exists public.admin_get_users();
create or replace function public.admin_get_users()
returns table (
  id uuid,
  email text,
  role public.user_role,
  full_name text,
  phone text,
  created_at timestamptz,
  last_sign_in_at timestamptz
) as $$
begin
  if not public.is_master(auth.uid()) then
    raise exception 'Hanya Akun Master yang berhak mengakses data ini.';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(p.role, 'user'::public.user_role) as role,
    p.full_name,
    p.phone,
    u.created_at,
    u.last_sign_in_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at asc;
end;
$$ language plpgsql security definer;

