-- ==============================================================================
-- FIX LOGIN ERROR 500 / SCHEMA QUERY MISMATCH DI SUPABASE GOTRUE
-- Jalankan skrip ini langsung di Supabase SQL Editor
-- ==============================================================================

-- 1. Perbaiki kolom token NULL di auth.users yang menyebabkan GoTrue crash (error 500)
update auth.users
set 
  reauthentication_token = coalesce(reauthentication_token, ''),
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, '');

-- 2. Buat data auth.identities untuk user yang belum memiliki relasi provider email
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  u.id,
  u.id,
  format('{"sub":"%s","email":"%s"}', u.id::text, lower(u.email))::jsonb,
  'email',
  u.id::text,
  now(),
  now(),
  now()
from auth.users u
where not exists (
  select 1 from auth.identities i where i.user_id = u.id
);

-- 3. Perbarui fungsi admin_create_user agar setiap user baru otomatis dibuatkan auth.identities dan token string
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
