import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/(auth)/login/actions';
import { CompleteProfileForm } from './complete-profile-form';

export default async function CompleteProfilePage() {
  const profile = await getCurrentUserProfile();

  // Jika belum login sama sekali, lempar ke login
  if (!profile.userId) {
    redirect('/login');
  }

  // Jika nomor telepon sudah ada dan akun sudah disetujui, arahkan ke dashboard
  if (profile.phone && profile.phone.trim() !== '') {
    if (!profile.isMaster && !profile.isApproved) {
      redirect('/pending-approval');
    }
    redirect('/');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const prefilledName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    profile.fullName ||
    '';

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-slate-950 py-10 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-md p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 rounded-2xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 shadow-sm mb-3 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/iconnet-colored.svg"
              alt="ICONNET"
              className="h-10 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-slate-100">
            Lengkapi Profil Petugas
          </h1>
          <p className="text-center text-sky-700 dark:text-sky-400 text-xs font-semibold mt-0.5">
            ICONNET &bull; Macan Kumbang
          </p>
          <p className="text-center text-gray-500 dark:text-slate-400 text-xs mt-1.5 max-w-xs leading-relaxed">
            Akun Google Anda berhasil terhubung. Silakan lengkapi nomor telepon dan buat password akun Anda untuk akses di semua perangkat.
          </p>
        </div>

        <CompleteProfileForm
          email={profile.email || user?.email || ''}
          initialFullName={prefilledName}
          initialPhone={profile.phone || ''}
        />

        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-slate-800 flex flex-col items-center">
          <form action={logout}>
            <button
              type="submit"
              className="text-xs text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              Keluar dan gunakan akun lain
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

