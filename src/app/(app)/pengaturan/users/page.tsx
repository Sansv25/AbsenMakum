import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { adminGetUsers } from '@/lib/data/users';
import { UserManager } from './user-manager';
import Link from 'next/link';
import { SlidersHorizontal, Users } from 'lucide-react';

export default async function UsersManagementPage() {
  const { isMaster, userId } = await getCurrentUserProfile();

  if (!isMaster) {
    redirect('/pengaturan');
  }

  const { users, error } = await adminGetUsers();

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Pengaturan Sistem</h1>
        <p className="text-xs text-gray-500 mt-1">
          Kelola konfigurasi jam piket dan manajemen akun pengguna.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-1">
        <Link
          href="/pengaturan"
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Pengaturan Shift
        </Link>
        <Link
          href="/pengaturan/users"
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-xl"
        >
          <Users className="h-4 w-4" />
          Manajemen Akun
        </Link>
      </div>

      <UserManager
        initialUsers={users}
        fetchError={error}
        currentUserId={userId ?? ''}
      />
    </div>
  );
}

