# PRD — Web Dokumentasi Absensi Piket

## 1. Ringkasan
Web pribadi untuk mendokumentasikan absensi piket (foto mulai kerja, foto selesai kerja, screenshot picket ticket) per shift, lalu mengekspornya ke PDF seperti dokumen contoh. Aplikasi otomatis tahu shift mana yang wajib diabsen pada tiap tanggal.

- Pengguna: 1 orang (pribadi), login email + password.
- Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres, Auth, Storage), deploy di Vercel.
- Zona waktu: Asia/Makassar (WITA, UTC+8).

## 2. Aturan Bisnis Inti (WAJIB)
| Jenis hari | Shift yang wajib |
|---|---|
| Senin–Jumat, bukan tanggal merah | **Malam saja** (shift pagi tidak perlu dan tidak ditampilkan) |
| Sabtu, Minggu, atau tanggal merah | **Pagi + Malam** |

- Penamaan: Pagi = Shift 1, Malam = Shift 2 (sesuai judul dokumen contoh "Picket ticket shift 2").
- Tanggal merah diinput manual oleh pengguna (tabel `holidays`).
- Jam shift default bisa diubah di Pengaturan: Pagi 06:00–14:00, Malam 14:00–22:00. Jam ini hanya label/acuan tampilan, bukan validasi keras.
- Satu tanggal + satu shift hanya punya satu record absensi.

## 3. Isi Satu Absensi (per tanggal + shift)
1. **Mulai Kerja**: tepat 1 foto (selfie di meja kerja dengan timestamp/lokasi).
2. **Selesai Kerja**: tepat 1 foto.
3. **Picket Ticket**: 0 sampai banyak screenshot (opsional, urutan bisa diatur).
4. Catatan teks opsional.

Status shift:
- `kosong`: belum ada foto.
- `sebagian`: ada sebagian saja.
- `lengkap`: foto Mulai dan Selesai ada. Ticket kosong hanya memunculkan peringatan kuning, tidak menggagalkan "lengkap".

Status hari (dihitung dari shift yang wajib saja): lengkap jika semua shift wajib lengkap; sebagian jika ada yang belum; kosong jika tidak ada satu pun.

## 4. Fitur
### 4.1 Auth
- Login email + password (Supabase Auth). Sign-up publik dinonaktifkan; akun dibuat manual di dashboard Supabase.
- Semua halaman selain `/login` diproteksi.

### 4.2 Dashboard (`/`)
- Kartu "Hari ini": tanggal, jenis hari (Hari kerja / Akhir pekan / Tanggal merah + nama libur), daftar shift wajib dengan status dan tombol "Isi absen".
- Kalender bulanan: tiap tanggal diberi penanda status (hijau lengkap, kuning sebagian, merah terlewat tanpa absen, abu-abu belum waktunya). Tanggal merah/weekend diberi label.
- Navigasi bulan sebelumnya/berikutnya.

### 4.3 Form Absensi (`/absen/[tanggal]/[shift]`)
- Validasi: shift hanya bisa dibuka jika termasuk shift wajib tanggal itu. Jika tidak, tampilkan pesan dan tombol kembali. Jika data sudah ada dari sebelum aturan berubah, tetap bisa dilihat dengan lencana "di luar jadwal".
- Tiga bagian: Mulai Kerja, Selesai Kerja, Picket Ticket.
- Cara memasukkan gambar (semua bagian):
  - Upload dari galeri/file.
  - Ambil dari kamera (mobile: `input capture`; desktop: kamera web via `getUserMedia`).
  - Khusus Picket Ticket: **paste dari clipboard (Ctrl+V)** dan drag-and-drop (untuk screenshot WhatsApp Web).
- Kamera web: hasil foto diberi overlay teks tanggal-jam di pojok kanan bawah (format `5 Okt 2026 14.22.32`) dan koordinat GPS bila izin lokasi diberikan (opsional, tanpa reverse geocoding di v1).
- Semua gambar dikompres di browser sebelum upload (sisi terpanjang maks 1600 px, JPEG kualitas 0.8).
- Ganti/hapus foto, urutkan ulang screenshot ticket (naik/turun).
- Simpan otomatis tiap gambar selesai diupload; indikator "tersimpan".

### 4.4 Riwayat (`/riwayat`)
- Daftar per bulan, filter: shift, status. Klik untuk membuka form (mode lihat/edit). Thumbnail pratinjau.

### 4.5 Tanggal Merah (`/libur`)
- Tambah (tanggal + nama), hapus, daftar per tahun. Tanggal unik.
- Perubahan langsung memengaruhi shift wajib di dashboard dan riwayat.

### 4.6 Pengaturan (`/pengaturan`)
- Jam mulai/selesai default shift pagi dan malam (label).

### 4.7 Export PDF (`/export`)
- Pilih rentang tanggal (default bulan ini), pilih "hanya lengkap" atau "semua yang ada foto".
- PDF dibuat di browser (jsPDF), A4 portrait, meniru dokumen contoh. Per absensi (urut tanggal, lalu Pagi sebelum Malam):
  - Halaman judul absensi: teks "Senin, 5 Oktober 2026 — Shift Malam (Shift 2)".
  - "Mulai Kerja" + foto.
  - "Selesai kerja" + foto.
  - Halaman berikut: "Picket ticket shift 2" + semua screenshot ticket berurutan (otomatis lanjut halaman jika tidak muat).
- Nama file: `absensi-piket_YYYY-MM-DD_sd_YYYY-MM-DD.pdf`.
- Tampilkan progress bar saat memproses; batasi rentang maksimal 31 hari agar memori aman.

## 5. Model Data (Supabase)
- `shift_settings(user_id, shift_type, start_time, end_time)`
- `holidays(id, user_id, holiday_date, name)` — unik per user + tanggal
- `attendances(id, user_id, work_date, shift_type, note, created_at, updated_at)` — unik (user, tanggal, shift)
- `attachments(id, attendance_id, user_id, kind[mulai|selesai|ticket], storage_path, sort_order, created_at)` — maksimal 1 untuk mulai dan 1 untuk selesai per absensi
- Storage bucket privat `evidence`, path `{user_id}/{work_date}/{shift}/{kind}-{uuid}.jpg`, akses lewat signed URL.
- RLS aktif di semua tabel: hanya pemilik data (`user_id = auth.uid()`).
- SQL lengkap ada di EXECUTION_BRIEF.md.

## 6. Halaman & Alur
`/login` → `/` (dashboard) → `/absen/[tanggal]/[shift]` · `/riwayat` · `/libur` · `/pengaturan` · `/export`
Navigasi: bottom nav di mobile, sidebar di desktop.

## 7. Non-Fungsional
- Mobile-first (dipakai dari HP saat piket), tetap nyaman di desktop.
- Bahasa UI: Indonesia. Tanggal ditampilkan format Indonesia.
- Tanggal disimpan sebagai tipe `date` dan diproses sebagai string `YYYY-MM-DD` agar tidak bergeser karena zona waktu.
- Tidak ada service role key di sisi klien.
- Loading, empty, dan error state di setiap halaman.

## 8. Di Luar Cakupan v1
Multi-user/tim, export DOCX, reverse geocoding lokasi, notifikasi pengingat, impor libur nasional otomatis, mode offline/PWA.

## 9. Kriteria Selesai
1. Hari Senin–Jumat non-libur hanya menampilkan shift Malam; Sabtu/Minggu/tanggal merah menampilkan Pagi dan Malam.
2. Menambah tanggal merah pada hari kerja mengubahnya menjadi dua shift.
3. Foto Mulai dan Selesai bisa diupload (galeri, kamera) dan diganti; ticket bisa lewat paste/drag-drop/upload dan diurutkan.
4. Status shift/hari dan kalender sesuai aturan bagian 3.
5. Export PDF menghasilkan layout seperti contoh untuk rentang yang dipilih.
6. Data pengguna lain (akun uji kedua) tidak bisa membaca data dan foto (RLS terverifikasi).
7. Berjalan di Vercel dengan env Supabase.
