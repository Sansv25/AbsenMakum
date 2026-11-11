# AI EXECUTION BRIEF — Web Dokumentasi Absensi Piket

Baca dulu `PRD.md` dan `RULES.md` di folder ini. Proyek dibangun dari folder kosong. Kerjakan per fase, berhenti di akhir tiap fase, laporkan hasil, dan tunggu konfirmasi sebelum lanjut.

## Prasyarat (dilakukan manusia, bukan AI)
1. Buat project Supabase baru.
2. Authentication → Providers → Email aktif; matikan "Allow new users to sign up".
3. Authentication → Users → Add user (email + password pribadi).
4. Catat Project URL dan anon key (Settings → API).

## Fase 0 — Inisialisasi
- `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
- `npm i @supabase/ssr @supabase/supabase-js date-fns zod jspdf browser-image-compression lucide-react`
- Buat `.env.example` berisi `NEXT_PUBLIC_SUPABASE_URL=` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY=`; pastikan `.env.local` di `.gitignore`.
- Buat struktur folder sesuai RULES.md.
- Selesai bila: `npm run dev` jalan tanpa error.

## Fase 1 — Database (file `supabase/schema.sql`, dijalankan manusia di SQL Editor)
```sql
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
```
- Default `shift_settings` dibuat dari aplikasi saat pertama kali membuka Pengaturan (pagi 06:00–14:00, malam 14:00–22:00) bila belum ada.
- Selesai bila: tabel dan bucket terbentuk; AI membuat helper `src/lib/supabase/{client,server}.ts` dan tipe TypeScript untuk keempat tabel.

## Fase 2 — Auth & Layout
- Halaman `/login`, middleware proteksi route, tombol logout.
- Layout aplikasi: bottom nav (mobile) / sidebar (desktop) dengan menu Dashboard, Riwayat, Libur, Pengaturan, Export.
- Selesai bila: tanpa login selalu diarahkan ke `/login`; login berhasil masuk dashboard; logout bekerja.

## Fase 3 — Aturan Shift & Tanggal Merah
- Implementasi `src/lib/shifts.ts` (persis seperti di RULES.md), `src/lib/dates.ts` (hari ini di Asia/Makassar, format Indonesia).
- Halaman `/libur`: tambah, hapus, daftar per tahun.
- Halaman `/pengaturan`: edit jam shift (label).
- Selesai bila (uji unit sederhana atau skrip): Rabu non-libur → `['malam']`; Sabtu → `['pagi','malam']`; Minggu → dua shift; Rabu yang dimasukkan ke `holidays` → dua shift.

## Fase 4 — Form Absensi & Upload
- Route `/absen/[date]/[shift]` dengan penjagaan shift wajib (PRD 4.3).
- Komponen upload tunggal (Mulai, Selesai) dan multi (Ticket): pilih file, kamera, paste Ctrl+V, drag-drop (Ticket), kompres via `src/lib/image.ts`, upload ke Storage, simpan baris `attachments`, ganti/hapus (hapus juga file Storage), urutkan ulang ticket.
- Kamera web: `getUserMedia`, preview, tombol ambil; overlay tanggal-jam WITA dan koordinat GPS opsional di kanvas sebelum dikompres.
- Catatan teks opsional; simpan otomatis.
- Selesai bila: foto tampil lewat signed URL setelah refresh; mengganti Mulai tidak meninggalkan file lama di bucket; kriteria 3 PRD terpenuhi.

## Fase 5 — Dashboard & Riwayat
- Dashboard: kartu "Hari ini" dan kalender bulanan dengan status sesuai PRD bagian 3 dan 4.2.
- Riwayat: daftar per bulan, filter shift dan status, thumbnail.
- Selesai bila: kriteria 1, 2, dan 4 PRD terpenuhi (uji: tambah tanggal merah pada hari kerja, lihat dua shift muncul).

## Fase 6 — Export PDF
- `/export`: pilih rentang (maks 31 hari), pilihan "hanya lengkap" atau "semua yang ada foto".
- `src/lib/pdf.ts` membuat PDF sesuai layout PRD 4.7, memproses gambar berurutan dengan progress bar.
- Selesai bila: PDF contoh untuk satu hari dua shift tampil rapi (Mulai Kerja, Selesai kerja, lalu Picket ticket shift N), gambar tidak terdistorsi, halaman lanjut otomatis.

## Fase 7 — Poles & Deploy
- Loading/empty/error state di semua halaman, uji di lebar HP (375 px).
- `npm run build` dan `npm run lint` bersih.
- Deploy ke Vercel (manusia: import repo, isi 2 env var). Tambahkan URL Vercel di Supabase → Authentication → URL Configuration.
- Uji keamanan: buat akun kedua, pastikan tidak bisa melihat data/foto akun pertama (kriteria 6 PRD).
- Selesai bila: semua Kriteria Selesai PRD bagian 9 tercentang.

## Cara melapor di akhir tiap fase
Tulis singkat: apa yang dibuat, file utama yang berubah, cara mengujinya, dan pertanyaan terbuka (jika ada).
