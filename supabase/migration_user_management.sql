-- ============================================================
-- MIGRATION: Fitur Manajemen Akun (Khusus Akun Master)
-- Jalankan di SQL Editor Supabase
-- ============================================================

create extension if not exists "pgcrypto";

-- 1. Function untuk Master mengambil daftar seluruh akun user
create or replace function public.admin_get_users()
returns table (
  id uuid,
  email text,
  role public.user_role,
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
    u.created_at,
    u.last_sign_in_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at asc;
end;
$$ language plpgsql security definer;

-- 2. Function untuk Master membuat akun baru (Petugas atau Master)
create or replace function public.admin_create_user(
  new_email text,
  new_password text,
  new_role public.user_role default 'user'
) returns uuid as $$
declare
  new_user_id uuid := gen_random_uuid();
  encrypted_pw text;
begin
  if not public.is_master(auth.uid()) then
    raise exception 'Hanya Akun Master yang berhak membuat user baru.';
  end if;

  if exists (select 1 from auth.users where lower(email) = lower(new_email)) then
    raise exception 'Email % sudah terdaftar.', new_email;
  end if;

  encrypted_pw := crypt(new_password, gen_salt('bf'));

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    lower(new_email),
    encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

  insert into public.profiles (id, email, role)
  values (new_user_id, lower(new_email), new_role)
  on conflict (id) do update set role = excluded.role;

  return new_user_id;
end;
$$ language plpgsql security definer;

-- 3. Function untuk Master mengubah role user (master <-> user)
create or replace function public.admin_set_user_role(
  target_user_id uuid,
  target_role public.user_role
) returns boolean as $$
begin
  if not public.is_master(auth.uid()) then
    raise exception 'Hanya Akun Master yang berhak mengubah role.';
  end if;

  update public.profiles
  set role = target_role,
      updated_at = now()
  where id = target_user_id;

  return true;
end;
$$ language plpgsql security definer;

-- 4. Function untuk Master mereset password akun user
create or replace function public.admin_update_user_password(
  target_user_id uuid,
  new_password text
) returns boolean as $$
begin
  if not public.is_master(auth.uid()) then
    raise exception 'Hanya Akun Master yang berhak mereset password.';
  end if;

  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  where id = target_user_id;

  return true;
end;
$$ language plpgsql security definer;

-- 5. Function untuk Master menghapus akun user
create or replace function public.admin_delete_user(
  target_user_id uuid
) returns boolean as $$
begin
  if not public.is_master(auth.uid()) then
    raise exception 'Hanya Akun Master yang berhak menghapus akun.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Tidak dapat menghapus akun Anda sendiri.';
  end if;

  delete from auth.users where id = target_user_id;
  return true;
end;
$$ language plpgsql security definer;

