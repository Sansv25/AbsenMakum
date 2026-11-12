import { getCurrentUserProfile } from '@/lib/data/profile';
import { ProfileForm } from './profile-form';

export const dynamic = 'force-dynamic';

export default async function ProfilPage() {
  const profile = await getCurrentUserProfile();

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Profil Saya</h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          Pengaturan akun, preferensi tema gelap (Dark Mode), dan informasi nomor rekening/e-wallet.
        </p>
      </div>

      <ProfileForm
        initialData={{
          email: profile.email,
          fullName: profile.fullName,
          phone: profile.phone,
          description: profile.description,
          isMaster: profile.isMaster,
          role: profile.role,
          isApproved: profile.isApproved,
        }}
      />
    </div>
  );
}

