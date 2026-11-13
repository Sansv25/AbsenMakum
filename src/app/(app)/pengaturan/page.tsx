import { redirect } from 'next/navigation';
import { getOrInitShiftSettings } from '@/lib/data/shifts';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { SettingsForm } from './settings-form';
import { SettingsTabs } from './settings-tabs';

export default async function PengaturanPage() {
  const { canManageSettings, isOwner } = await getCurrentUserProfile();

  if (!canManageSettings) {
    redirect('/');
  }

  const settings = await getOrInitShiftSettings();

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Pengaturan Sistem</h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          Atur jam mulai dan selesai untuk shift pagi dan malam, manajemen pengguna, dan monitoring sistem.
        </p>
      </div>

      {/* Tabs Navigasi Pengaturan */}
      <SettingsTabs activeTab="shifts" isOwner={isOwner} />

      <SettingsForm settings={settings} isMaster={canManageSettings} isOwner={isOwner} />
    </div>
  );
}
