import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { adminGetUsers } from '@/lib/data/users';
import { UserManager } from './user-manager';
import { SettingsTabs } from '../settings-tabs';

export default async function UsersManagementPage() {
  const { canManageSettings, isOwner, userId } = await getCurrentUserProfile();

  if (!canManageSettings) {
    redirect('/');
  }

  const { users, error } = await adminGetUsers();

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Pengaturan Sistem</h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          Kelola konfigurasi jam piket, manajemen akun pengguna, dan monitoring sistem.
        </p>
      </div>

      {/* Tabs */}
      <SettingsTabs activeTab="users" isOwner={isOwner} />

      <UserManager
        initialUsers={users}
        fetchError={error}
        currentUserId={userId ?? ''}
        currentUserIsOwner={isOwner}
      />
    </div>
  );
}

