import Link from 'next/link';
import { Shield, ArrowLeft, Mail } from 'lucide-react';

export const metadata = {
  title: 'Kebijakan Privasi (Privacy Policy) - ICONNET Attendance & Ticketing',
  description: 'Kebijakan Privasi untuk platform otomasi tiket dan absensi ICONNET',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-800 dark:text-slate-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
        {/* Header */}
        <div className="border-b border-gray-100 dark:border-slate-800 pb-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Halaman Utama
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Kebijakan Privasi (Privacy Policy)
              </h1>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Terakhir diperbarui: 16 November 2026
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-950 dark:text-white">
              1. Pendahuluan
            </h2>
            <p>
              Aplikasi ini adalah platform internal pengelolaan absensi piket petugas dan sistem otomasi pelaporan tiket keluhan pelanggan layanan ICONNET. Kami menghargai privasi pengguna dan berkomitmen untuk melindungi informasi pribadi Anda sesuai dengan standar keamanan yang berlaku.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-950 dark:text-white">
              2. Data yang Kami Kumpulkan
            </h2>
            <p>Kami hanya mengumpulkan data yang diperlukan untuk mendukung fungsi operasional sistem, meliputi:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Data Akun Pengguna:</strong> Nama lengkap, alamat email, nomor telepon, dan role akses petugas.</li>
              <li><strong>Data Absensi &amp; Aktivitas:</strong> Tanggal, jam kerja shift, jenis pekerjaan (marketer, qontak, tiket), dan foto bukti kehadiran kerja.</li>
              <li><strong>Data Pelaporan Tiket:</strong> ID Pelanggan, ID PLN, nama pelanggan, alamat, nomor telepon/WhatsApp, foto bukti modem, dan catatan keluhan gangguan untuk diteruskan ke layanan penanganan gangguan ICONNET.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-950 dark:text-white">
              3. Penggunaan Informasi
            </h2>
            <p>Informasi yang dikumpulkan digunakan untuk:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Memverifikasi identitas pengguna saat login ke dalam sistem.</li>
              <li>Merekapitulasi kehadiran shift harian dan pembuatan laporan kerja bulanan.</li>
              <li>Memproses dan menerbitkan nomor tiket resmi pelaporan gangguan ke saluran resmi ICONNET.</li>
              <li>Mengirimkan notifikasi operasional terkait status penanganan tiket atau kehadiran kerja.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-950 dark:text-white">
              4. Perlindungan dan Keamanan Data
            </h2>
            <p>
              Kami menerapkan langkah-langkah keamanan teknis standar industri seperti enkripsi SSL/TLS, otentikasi aman berbasis token Supabase, dan pembatasan hak akses berbasis peran (Role-Based Access Control). Kami tidak menjual atau membagikan data pribadi Anda kepada pihak ketiga untuk tujuan komersial.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-950 dark:text-white">
              5. Hak Pengguna &amp; Penghapusan Data
            </h2>
            <p>
              Pengguna berhak untuk mengakses, memperbarui, atau meminta penghapusan data akun mereka kapan saja dengan menghubungi administrator melalui email yang tercantum di bawah ini.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-950 dark:text-white">
              6. Hubungi Kami
            </h2>
            <p>
              Apabila Anda memiliki pertanyaan atau kendala seputar kebijakan privasi ini, silakan hubungi kami melalui email:
            </p>
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-800 text-xs font-mono">
              <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>madesanjaya255@gmail.com</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
