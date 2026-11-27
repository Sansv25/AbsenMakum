import Link from 'next/link';
import { FileText, ArrowLeft, Mail } from 'lucide-react';

export const metadata = {
  title: 'Syarat dan Ketentuan Layanan (Terms of Service) - ICONNET Attendance & Ticketing',
  description: 'Syarat dan Ketentuan penggunaan aplikasi absensi dan ticketing ICONNET',
};

export default function TermsOfServicePage() {
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
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Syarat dan Ketentuan Layanan (Terms of Service)
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
              1. Penerimaan Ketentuan
            </h2>
            <p>
              Dengan mengakses dan menggunakan aplikasi ini, Anda menyatakan setuju untuk terikat oleh Syarat dan Ketentuan Layanan ini serta Kebijakan Privasi kami. Jika Anda tidak menyetujui ketentuan ini, Anda tidak diperkenankan untuk menggunakan sistem ini.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-950 dark:text-white">
              2. Akun dan Hak Akses Pengguna
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Akun hanya diberikan kepada petugas dan administrator resmi operasional piket ICONNET.</li>
              <li>Pengguna bertanggung jawab penuh untuk menjaga kerahasiaan kata sandi dan kredensial akun masing-masing.</li>
              <li>Dilarang membagikan atau meminjamkan akun kepada pihak lain yang tidak berwenang.</li>
              <li>Penggunaan fitur pembuatan tiket hanya dapat dilakukan oleh akun yang telah diberikan hak akses (Role Tiket / Owner).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-950 dark:text-white">
              3. Penggunaan yang Diperbolehkan
            </h2>
            <p>
              Aplikasi ini disediakan khusus untuk keperluan pencatatan absensi shift kerja serta pemrosesan tiket penanganan gangguan pelanggan secara sah. Pengguna dilarang menyalahgunakan sistem untuk tujuan penipuan, pengunggahan konten ilegal, atau tindakan yang merusak integritas data layanan.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-950 dark:text-white">
              4. Integrasi Layanan Pihak Ketiga
            </h2>
            <p>
              Sistem ini dapat berinteraksi dengan layanan pihak ketiga seperti platform pesan Meta (Instagram/Facebook) dan basis data Supabase untuk memfasilitasi pelaporan tiket gangguan. Pengguna wajib mematuhi seluruh ketentuan dan kebijakan platform pihak ketiga tersebut saat beroperasi melalui sistem.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-950 dark:text-white">
              5. Perubahan Ketentuan
            </h2>
            <p>
              Kami berhak untuk mengubah atau memperbarui Syarat dan Ketentuan ini sewaktu-waktu. Perubahan akan berlaku efektif setelah dipublikasikan pada halaman ini.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-950 dark:text-white">
              6. Kontak Bantuan
            </h2>
            <p>
              Jika terdapat pertanyaan mengenai ketentuan layanan ini, Anda dapat menghubungi tim kami di:
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
