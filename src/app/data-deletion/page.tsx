import Link from 'next/link';
import { Trash2, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: 'Instruksi Penghapusan Data Pengguna (User Data Deletion) - ICONNET',
  description: 'Petunjuk cara menghapus akun dan data pengguna dari platform ICONNET',
};

export default function DataDeletionPage() {
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
            <div className="p-2.5 rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Instruksi Penghapusan Data Pengguna
              </h1>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                User Data Deletion Instructions &bull; Sesuai Kebijakan Platform Meta &amp; Facebook
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <p>
              Sesuai dengan ketentuan kebijakan Platform Meta (Facebook / Instagram), pengguna memiliki hak untuk meminta penghapusan seluruh data pribadi mereka yang tersimpan di dalam sistem aplikasi ini.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-gray-950 dark:text-white">
              Cara Meminta Penghapusan Data:
            </h2>

            <div className="space-y-3">
              {/* Metode 1 */}
              <div className="p-4 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Metode 1: Menghubungi Administrator Melalui Email (Rekomendasi)</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-300">
                  Kirimkan email permohonan penghapusan akun atau data Anda kepada tim administrator kami dengan format berikut:
                </p>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 font-mono text-xs text-gray-700 dark:text-slate-300 space-y-1">
                  <div><strong>Kepada:</strong> madesanjaya255@gmail.com</div>
                  <div><strong>Subjek:</strong> Permohonan Penghapusan Data Akun - [Nama Anda]</div>
                  <div><strong>Isi Pesan:</strong> Mohon hapus seluruh data pribadi akun saya yang terdaftar dengan email: [Email Anda].</div>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 pt-1">
                  Tim kami akan memproses dan menghapus data akun Anda (profil, log aktivitas, dan file terkait) dalam waktu maksimal <strong>3–7 hari kerja</strong>, dan akan mengirimkan konfirmasi melalui email balasan.
                </p>
              </div>

              {/* Metode 2 */}
              <div className="p-4 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Metode 2: Memutus Akses Melalui Pengaturan Facebook / Instagram</span>
                </div>
                <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-600 dark:text-slate-300">
                  <li>Buka aplikasi Facebook atau Instagram Anda.</li>
                  <li>Buka <strong>Pengaturan &amp; Privasi</strong> &rarr; <strong>Pengaturan</strong>.</li>
                  <li>Gulir ke bawah dan pilih <strong>Izin</strong> &rarr; <strong>Aplikasi dan Situs Web</strong>.</li>
                  <li>Temukan aplikasi ini dari daftar aplikasi aktif.</li>
                  <li>Klik tombol <strong>Hapus</strong> atau <strong>Cabut Akses</strong>.</li>
                </ol>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-950 dark:text-white">
              Data yang Dihapus
            </h2>
            <p>Setelah permohonan penghapusan disetujui, kami akan menghapus secara permanen:</p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-gray-600 dark:text-slate-300">
              <li>Informasi profil akun (nama, email, nomor telepon, dan password terenkripsi).</li>
              <li>Data token otentikasi sesi yang tersimpan.</li>
              <li>File foto atau lampiran dokumen yang Anda unggah ke penyimpanan cloud.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-950 dark:text-white">
              Kontak Bantuan &amp; Dukungan
            </h2>
            <p>Jika Anda membutuhkan bantuan lebih lanjut mengenai data pribadi Anda:</p>
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
