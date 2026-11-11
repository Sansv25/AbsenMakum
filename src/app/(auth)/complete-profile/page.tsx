import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { logout } from '@/app/(auth)/login/actions';
import { CompleteProfileForm } from './complete-profile-form';

export default async function CompleteProfilePage() {
  const profile = await getCurrentUserProfile();

  // Jika belum login sama sekali, lempar ke login
  if (!profile.userId) {
    redirect('/login');
  }

  // Jika nomor telepon sudah ada, tidak perlu mengisi lagi
  if (profile.phone && profile.phone.trim() !== '') {
    redirect('/');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 rounded-2xl bg-sky-50/80 border border-sky-100 shadow-sm mb-3 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/iconnet-colored.svg"
              alt="ICONNET"
              className="h-10 w-auto object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.includes('logo.svg')) {
                  target.src = '/images/logo.svg';
                }
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900">
            Lengkapi Profil Petugas
          </h1>
          <p className="text-center text-sky-700 text-xs font-semibold mt-0.5">
            ICONNET &bull; Macan Kumbang
          </p>
          <p className="text-center text-gray-500 text-xs mt-1.5 max-w-xs">
            Akun Google Anda berhasil terhubung. Harap lengkapi nomor telepon aktif Anda untuk keperluan koordinasi piket.
          </p>
        </div>

        <CompleteProfileForm
          email={profile.email || ''}
          initialFullName={profile.fullName || ''}
          initialPhone={profile.phone || ''}
        />

        <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col items-center">
          <form action={logout}>
            <button
              type="submit"
              className="text-xs text-gray-400 hover:text-red-600 transition-colors"
            >
              Keluar dan gunakan akun lain
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

