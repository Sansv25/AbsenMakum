# RULES — Proyek Absensi Piket

Aturan ini wajib diikuti AI IDE sepanjang pengerjaan. Jika ada konflik dengan permintaan lain, tanyakan dulu. (Salin isi file ini ke file rules IDE yang dipakai, misalnya AGENTS.md atau .cursorrules.)

## Stack (jangan diganti tanpa izin)
- Next.js (App Router) + TypeScript strict + Tailwind CSS
- Supabase: `@supabase/ssr` + `@supabase/supabase-js` (Auth, Postgres, Storage)
- `date-fns`, `zod`, `jspdf`, `browser-image-compression`, `lucide-react`
- Deploy: Vercel. Package manager: npm.

## Aturan bisnis (sumber kebenaran tunggal)
Semua logika jenis hari dan shift wajib ada di SATU fungsi: `src/lib/shifts.ts`. Dilarang menduplikasi logika ini di komponen.

```ts
export type ShiftType = 'pagi' | 'malam';

export function getRequiredShifts(dateStr: string, holidays: Set<string>): ShiftType[] {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Min, 6=Sab
  const isOff = dow === 0 || dow === 6 || holidays.has(dateStr);
  return isOff ? ['pagi', 'malam'] : ['malam'];
}
```
- Hari kerja biasa: hanya `malam`. Pagi tidak ditampilkan dan tidak bisa dibuka.
- Sabtu, Minggu, tanggal merah: `pagi` + `malam`.
- Pagi = "Shift 1", Malam = "Shift 2".
- Status shift: `lengkap` jika ada foto `mulai` dan `selesai`; ticket opsional (hanya peringatan).
- Status hari dihitung hanya dari shift yang wajib.

## Tanggal & zona waktu
- Tanggal selalu string `YYYY-MM-DD` dan kolom DB bertipe `date`. Jangan konversi lewat `new Date('YYYY-MM-DD')` lokal.
- "Hari ini" dihitung di zona `Asia/Makassar` (`Intl.DateTimeFormat` dengan `timeZone`), bukan zona server Vercel (UTC).
- Format tampilan Indonesia: "Senin, 5 Oktober 2026".

## Keamanan
- RLS wajib di semua tabel; semua policy `user_id = auth.uid()`.
- Bucket `evidence` privat; tampilkan gambar lewat signed URL (berlaku 1 jam), jangan public URL.
- Jangan pernah memakai atau menaruh service role key di kode klien atau repo. Hanya `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `.env.local` masuk `.gitignore`; sediakan `.env.example`.
- Sign-up publik dimatikan; middleware memproteksi semua route kecuali `/login`.

## Kode
- TypeScript strict, tanpa `any`. Validasi input form dengan zod.
- Komponen server secara default; `'use client'` hanya jika perlu (kamera, paste, drag-drop, PDF).
- Akses Supabase hanya lewat `src/lib/supabase/{client,server}.ts` dan fungsi di `src/lib/data/*`. Komponen tidak memanggil query mentah.
- Struktur folder:
```
src/
  app/(auth)/login/
  app/(app)/{page.tsx, absen/[date]/[shift]/, riwayat/, libur/, pengaturan/, export/}
  components/{calendar, attendance, upload, pdf, ui}/
  lib/{shifts.ts, dates.ts, image.ts, pdf.ts, supabase/, data/}
  middleware.ts
supabase/schema.sql
```
- Satu tanggung jawab per file; fungsi kecil dan bernama jelas. Tidak ada kode mati atau console.log tersisa.

## Gambar
- Kompres sebelum upload: sisi terpanjang maks 1600 px, JPEG kualitas 0.8.
- Terima `image/*`. Tolak file bukan gambar dan lebih dari 10 MB (sebelum kompres) dengan pesan jelas.
- Mulai dan Selesai: tepat satu; mengganti berarti menghapus file lama di Storage dan baris `attachments` lama.
- Hapus baris DB juga menghapus file di Storage (tidak boleh ada file yatim).

## UI/UX
- Mobile-first, target sentuh minimal 44 px, bottom nav di mobile.
- Seluruh teks UI bahasa Indonesia.
- Setiap halaman punya state loading, kosong, dan error.
- Warna status konsisten: hijau lengkap, kuning sebagian/peringatan, merah terlewat, abu-abu belum waktunya.

## PDF
- Dibuat di browser dengan jsPDF, A4 portrait, margin 15 mm; gambar diskalakan proporsional (tanpa distorsi) mengikuti lebar halaman.
- Layout mengikuti PRD bagian 4.7. Proses gambar satu per satu (bukan paralel semua) agar memori aman; tampilkan progress.

## Cara kerja AI
- Kerjakan per fase sesuai EXECUTION_BRIEF.md, berhenti dan laporkan di akhir tiap fase.
- Jalankan `npm run build` dan `npm run lint` sebelum menyatakan fase selesai.
- Jika ada hal yang ambigu atau butuh keputusan di luar dokumen, tanya dulu, jangan berasumsi.
- Jangan menambah fitur di luar PRD (lihat bagian "Di Luar Cakupan v1").
