import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { logout } from '@/app/(auth)/login/actions';
import { Clock, ShieldAlert, User, Mail, Phone, RefreshCw, LogOut } from 'lucide-react';
import Link from 'next/link';

export default async function PendingApprovalPage() {
  const profile = await getCurrentUserProfile();

  // Jika belum login, redirect ke login
  if (!profile.userId) {
    redirect('/login');
  }

  // Jika nomor telepon belum diisi, wajib lengkapi profil & buat password dulu
  if (!profile.phone || profile.phone.trim() === '') {
    redirect('/complete-profile');
  }

  // Jika sudah disetujui atau akun master, langsung masuk dashboard
  if (profile.isMaster || profile.isApproved) {
    redirect('/');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-slate-950 py-10 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-md p-6 sm:p-8">
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 shadow-sm mb-3 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock className="h-10 w-10 animate-pulse" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-3 py-1 rounded-full mb-2 flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> Menunggu Persetujuan
          </span>
          <h1 className="text-xl font-bold text-center text-gray-900 dark:text-slate-100">
            Akun Sedang Ditinjau Admin
          </h1>
          <p className="text-center text-gray-500 dark:text-slate-400 text-xs mt-1.5 max-w-xs leading-relaxed">
            Pendaftaran akun Anda berhasil. Untuk keamanan data, akun Anda memerlukan persetujuan dari <strong>Akun Master</strong> sebelum dapat mengakses aplikasi.
          </p>
        </div>

        {/* Informasi Akun Pendaftar */}
        <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 border border-gray-200/80 dark:border-slate-700 mb-6 space-y-2.5">
          <div className="text-xs font-semibold text-gray-700 dark:text-slate-200 border-b border-gray-200 dark:border-slate-700 pb-1.5 mb-2">
            Data Pendaftaran Anda
          </div>

          <div className="flex items-center gap-2.5 text-xs text-gray-700 dark:text-slate-300">
            <User className="h-4 w-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
            <span className="text-gray-500 dark:text-slate-400">Nama:</span>
            <span className="font-semibold text-gray-900 dark:text-slate-100 truncate">
              {profile.fullName || '(Belum ada nama)'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-gray-700 dark:text-slate-300">
            <Mail className="h-4 w-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
            <span className="text-gray-500 dark:text-slate-400">Email:</span>
            <span className="font-semibold text-gray-900 dark:text-slate-100 truncate">{profile.email}</span>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-gray-700 dark:text-slate-300">
            <Phone className="h-4 w-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
            <span className="text-gray-500 dark:text-slate-400">No. HP:</span>
            <span className="font-semibold text-gray-900 dark:text-slate-100">{profile.phone || '-'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors min-h-[44px] shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Cek Status / Muat Ulang</span>
          </Link>

          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs font-medium rounded-xl border border-gray-200 dark:border-slate-700 transition-colors min-h-[44px]"
            >
              <LogOut className="h-4 w-4 text-gray-400 dark:text-slate-500" />
              <span>Keluar dari Akun Ini</span>
            </button>
          </form>
        </div>

        <p className="text-[11px] text-gray-400 dark:text-slate-500 text-center mt-6">
          ICONNET
        </p>
      </div>
    </main>
  );
}

