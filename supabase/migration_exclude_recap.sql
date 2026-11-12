-- ==============================================================================
-- MIGRATION: FITUR JANGAN REKAP UNTUK AKUN MONITORING / MASTER
-- Jalankan skrip ini di SQL Editor Supabase Dashboard (Klik Run)
-- ==============================================================================

-- 1. Tambah kolom exclude_from_recap di public.profiles
alter table public.profiles
  add column if not exists exclude_from_recap boolean not null default false;

-- 2. Otomatis set akun master utama madesanjaya255@gmail.com ke true (hanya monitoring)
update public.profiles
set exclude_from_recap = true
where lower(email) = 'madesanjaya255@gmail.com';

-- 3. Perbarui RPC admin_get_users agar menyertakan kolom exclude_from_recap
drop function if exists public.admin_get_users();
create or replace function public.admin_get_users()
returns table (
  id uuid,
  email text,
  role public.user_role,
  full_name text,
  phone text,
  is_approved boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  exclude_from_recap boolean
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
    coalesce(p.is_approved, false) as is_approved,
    u.created_at,
    u.last_sign_in_at,
    coalesce(p.exclude_from_recap, false) as exclude_from_recap
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by 
    case when coalesce(p.is_approved, false) = false then 0 else 1 end asc,
    u.created_at desc;
end;
$$ language plpgsql security definer;

