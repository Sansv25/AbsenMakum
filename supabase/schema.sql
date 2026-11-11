create extension if not exists "pgcrypto";

create table public.shift_settings (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  shift_type text not null check (shift_type in ('pagi','malam')),
  start_time time not null,
  end_time time not null,
  primary key (user_id, shift_type)
);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  holiday_date date not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, holiday_date)
);

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  work_date date not null,
  shift_type text not null check (shift_type in ('pagi','malam')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date, shift_type)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendances(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('mulai','selesai','ticket')),
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.attachments (attendance_id, kind, sort_order);
create unique index attachments_single_kind on public.attachments (attendance_id, kind)
  where kind in ('mulai','selesai');

alter table public.shift_settings enable row level security;
alter table public.holidays enable row level security;
alter table public.attendances enable row level security;
alter table public.attachments enable row level security;

create policy "own rows" on public.shift_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.holidays for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.attendances for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.attachments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Storage: bucket privat
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false)
  on conflict (id) do nothing;

create policy "evidence own select" on storage.objects for select
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "evidence own insert" on storage.objects for insert
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "evidence own update" on storage.objects for update
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "evidence own delete" on storage.objects for delete
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
