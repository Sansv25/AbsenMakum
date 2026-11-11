-- ==============================================================================
-- MIGRATION: SISTEM APPROVAL & EDIT AKUN REGISTRASI OLEH MASTER
-- Jalankan skrip ini di SQL Editor Supabase Dashboard (Klik Run)
-- ==============================================================================

-- 1. Tambah kolom is_approved di public.profiles
alter table public.profiles
  add column if not exists is_approved boolean not null default false;

-- 2. Setujui (approve) semua akun yang sudah ada sebelumnya dan akun master
update public.profiles
set is_approved = true
where role = 'master' 
   or lower(email) = 'madesanjaya255@gmail.com'
   or is_approved is false; -- Approve akun yang sudah ada agar tidak terblokir

-- 3. Perbarui trigger handle_new_user:
-- Pendaftar baru non-master otomatis statusnya is_approved = false (perlu review master)
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_full_name text;
  v_phone text;
  v_role public.user_role;
  v_approved boolean;
begin
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

  -- Akun master otomatis disetujui (is_approved = true)
  -- Pendaftar umum harus menunggu approval master (is_approved = false)
  if lower(new.email) = 'madesanjaya255@gmail.com' then
    v_role := 'master'::public.user_role;
    v_approved := true;
  else
    v_role := 'user'::public.user_role;
    v_approved := false;
  end if;

  insert into public.profiles (id, email, full_name, phone, role, is_approved, created_at, updated_at)
  values (new.id, new.email, v_full_name, v_phone, v_role, v_approved, now(), now())
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

-- 4. Fungsi Master untuk langsung menyetujui akun (Approve)
create or replace function public.admin_approve_user(target_user_id uuid)
returns boolean as $$
begin
  if not public.is_master(auth.uid()) then
    raise exception 'Hanya Akun Master yang berhak menyetujui akun.';
  end if;

  update public.profiles
  set is_approved = true, updated_at = now()
  where id = target_user_id;

  return true;
end;
$$ language plpgsql security definer;

-- 5. Fungsi Master untuk mengedit data pengguna (nama, no hp, role) dan/atau approve
create or replace function public.admin_update_user_profile(
  target_user_id uuid,
  new_full_name text,
  new_phone text,
  new_role public.user_role default 'user',
  set_approved boolean default true
)
returns boolean as $$
begin
  if not public.is_master(auth.uid()) then
    raise exception 'Hanya Akun Master yang berhak mengubah data akun.';
  end if;

  update public.profiles
  set 
    full_name = trim(new_full_name),
    phone = trim(new_phone),
    role = new_role,
    is_approved = set_approved,
    updated_at = now()
  where id = target_user_id;

  return true;
end;
$$ language plpgsql security definer;

-- 6. Perbarui RPC admin_get_users agar menyertakan status is_approved dan mengurutkan pending di paling atas
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
    coalesce(p.is_approved, false) as is_approved,
    u.created_at,
    u.last_sign_in_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by 
    case when coalesce(p.is_approved, false) = false then 0 else 1 end asc,
    u.created_at desc;
end;
$$ language plpgsql security definer;
