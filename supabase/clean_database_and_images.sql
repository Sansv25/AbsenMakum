-- ============================================================
-- SQL: PEMBERSIHAN DATA ABSENSI, FOTO STORAGE, DAN MIGRASI ROLE
-- Salin seluruh isi file ini, tempel ke SQL Editor Supabase, lalu klik RUN.
-- ============================================================

-- 1. Hapus seluruh data absensi dan lampiran
truncate table public.attachments cascade;
truncate table public.attendances cascade;

-- 2. Hapus seluruh file gambar di bucket storage 'evidence'
delete from storage.objects where bucket_id = 'evidence';

-- 3. Pastikan tipe role dan tabel profiles ada
do $$ begin
  create type public.user_role as enum ('master', 'user');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper function: cek apakah user adalah master
create or replace function public.is_master(uid uuid)
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'master'
  );
$$ language sql security definer stable;

-- Kebijakan RLS Profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (public.is_master(auth.uid()));

-- Trigger otomatis isi profiles saat ada user baru
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case
      when lower(new.email) = 'madesanjaya255@gmail.com' then 'master'::public.user_role
      else 'user'::public.user_role
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Daftarkan akun yang sudah ada ke profiles (madesanjaya255@gmail.com sebagai Master)
insert into public.profiles (id, email, role)
select
  id,
  email,
  case
    when lower(email) = 'madesanjaya255@gmail.com' then 'master'::public.user_role
    else 'user'::public.user_role
  end
from auth.users
on conflict (id) do update set
  role = excluded.role;

-- 4. Tambah kolom Device Lock & Completion Lock di attendances jika belum ada
alter table public.attendances
  add column if not exists device_id text,
  add column if not exists device_info text,
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references auth.users(id);

-- 5. Kebijakan RLS Baru untuk Attendances
drop policy if exists "own rows" on public.attendances;
drop policy if exists "attendances_select_all" on public.attendances;
create policy "attendances_select_all" on public.attendances
  for select using (auth.role() = 'authenticated');

drop policy if exists "attendances_insert" on public.attendances;
create policy "attendances_insert" on public.attendances
  for insert with check (user_id = auth.uid() or public.is_master(auth.uid()));

drop policy if exists "attendances_update" on public.attendances;
create policy "attendances_update" on public.attendances
  for update using (user_id = auth.uid() or public.is_master(auth.uid()));

drop policy if exists "attendances_delete" on public.attendances;
create policy "attendances_delete" on public.attendances
  for delete using (public.is_master(auth.uid()));

-- 6. Kebijakan RLS Baru untuk Attachments
drop policy if exists "own rows" on public.attachments;
drop policy if exists "attachments_select_all" on public.attachments;
create policy "attachments_select_all" on public.attachments
  for select using (auth.role() = 'authenticated');

drop policy if exists "attachments_insert" on public.attachments;
create policy "attachments_insert" on public.attachments
  for insert with check (user_id = auth.uid() or public.is_master(auth.uid()));

drop policy if exists "attachments_update" on public.attachments;
create policy "attachments_update" on public.attachments
  for update using (user_id = auth.uid() or public.is_master(auth.uid()));

drop policy if exists "attachments_delete" on public.attachments;
create policy "attachments_delete" on public.attachments
  for delete using (user_id = auth.uid() or public.is_master(auth.uid()));

-- 7. Kebijakan RLS Baru untuk Holidays
drop policy if exists "own rows" on public.holidays;
drop policy if exists "holidays_select_all" on public.holidays;
create policy "holidays_select_all" on public.holidays
  for select using (auth.role() = 'authenticated');

drop policy if exists "holidays_modify" on public.holidays;
create policy "holidays_modify" on public.holidays
  for all using (user_id = auth.uid() or public.is_master(auth.uid()))
  with check (user_id = auth.uid() or public.is_master(auth.uid()));

-- 8. Kebijakan RLS Baru untuk Storage
drop policy if exists "evidence own select" on storage.objects;
drop policy if exists "evidence_select_authenticated" on storage.objects;
create policy "evidence_select_authenticated" on storage.objects
  for select using (bucket_id = 'evidence' and auth.role() = 'authenticated');

drop policy if exists "evidence own insert" on storage.objects;
create policy "evidence own insert" on storage.objects
  for insert with check (
    bucket_id = 'evidence' and (
      (storage.foldername(name))[1] = auth.uid()::text or public.is_master(auth.uid())
    )
  );

drop policy if exists "evidence own update" on storage.objects;
create policy "evidence own update" on storage.objects
  for update using (
    bucket_id = 'evidence' and (
      (storage.foldername(name))[1] = auth.uid()::text or public.is_master(auth.uid())
    )
  );

drop policy if exists "evidence own delete" on storage.objects;
create policy "evidence own delete" on storage.objects
  for delete using (
    bucket_id = 'evidence' and (
      (storage.foldername(name))[1] = auth.uid()::text or public.is_master(auth.uid())
    )
  );


-- ============================================================
-- FITUR MANAJEMEN AKUN OLEH MASTER
-- ============================================================

-- Function mengambil daftar akun user
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

-- Function membuat user baru
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
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    reauthentication_token,
    phone_change,
    phone_change_token,
    is_sso_user
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    lower(new_email),
    encrypted_pw,
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    false
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    new_user_id,
    new_user_id,
    format('{"sub":"%s","email":"%s"}', new_user_id::text, lower(new_email))::jsonb,
    'email',
    new_user_id::text,
    now(),
    now(),
    now()
  );

  insert into public.profiles (id, email, role)
  values (new_user_id, lower(new_email), new_role)
  on conflict (id) do update set role = excluded.role;

  return new_user_id;
end;
$$ language plpgsql security definer;

-- Function mengubah role user
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

-- Function mereset password user
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

-- Function menghapus akun user
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
