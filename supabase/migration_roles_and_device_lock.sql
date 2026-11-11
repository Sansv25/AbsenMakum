-- ============================================================
-- MIGRATION: Roles (Master vs User) & Device Lock (Penguncian Perangkat)
-- Dijalankan di SQL Editor Supabase Dashboard (Salin seluruh file ini dan klik Run)
-- ============================================================

-- 1. Buat tipe enum role jika belum ada
do $$ begin
  create type public.user_role as enum ('master', 'user');
exception
  when duplicate_object then null;
end $$;

-- 2. Buat tabel public.profiles
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

-- Kebijakan RLS Profiles:
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (public.is_master(auth.uid()));

-- 3. Trigger otomatis isi profiles saat ada user baru terdaftar di auth.users
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

-- Migrasikan data user yang sudah ada ke public.profiles
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

-- 4. Tambah kolom Device Lock & Completion Lock di public.attendances
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

-- 8. Kebijakan RLS Baru untuk Storage (Bucket evidence)
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
