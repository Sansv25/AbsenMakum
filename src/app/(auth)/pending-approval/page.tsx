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

  // Jika sudah disetujui atau akun master, langsung masuk dashboard
  if (profile.isMaster || profile.isApproved) {
    redirect('/');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 sm:p-8">
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm mb-3 text-amber-600 flex items-center justify-center">
            <Clock className="h-10 w-10 animate-pulse" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full mb-2 flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> Menunggu Persetujuan
          </span>
          <h1 className="text-xl font-bold text-center text-gray-900">
            Akun Sedang Ditinjau Admin
          </h1>
          <p className="text-center text-gray-500 text-xs mt-1.5 max-w-xs leading-relaxed">
            Pendaftaran akun Anda berhasil. Untuk keamanan data, akun Anda memerlukan persetujuan dari <strong>Akun Master</strong> sebelum dapat mengakses aplikasi.
          </p>
        </div>

        {/* Informasi Akun Pendaftar */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/80 mb-6 space-y-2.5">
          <div className="text-xs font-semibold text-gray-700 border-b border-gray-200 pb-1.5 mb-2">
            Data Pendaftaran Anda
          </div>

          <div className="flex items-center gap-2.5 text-xs text-gray-700">
            <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-500">Nama:</span>
            <span className="font-semibold text-gray-900 truncate">
              {profile.fullName || '(Belum ada nama)'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-gray-700">
            <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-500">Email:</span>
            <span className="font-semibold text-gray-900 truncate">{profile.email}</span>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-gray-700">
            <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-500">No. HP:</span>
            <span className="font-semibold text-gray-900">{profile.phone || '-'}</span>
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
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-xl border border-gray-200 transition-colors min-h-[44px]"
            >
              <LogOut className="h-4 w-4 text-gray-400" />
              <span>Keluar dari Akun Ini</span>
            </button>
          </form>
        </div>

        <p className="text-[11px] text-gray-400 text-center mt-6">
          ICONNET &bull; Macan Kumbang
        </p>
      </div>
    </main>
  );
}

