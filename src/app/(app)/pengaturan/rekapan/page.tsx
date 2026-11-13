import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { getEmailRecapSettings } from '@/lib/data/email-recap';
import { SettingsTabs } from '../settings-tabs';
import { EmailRecapForm } from './email-recap-form';

export default async function RekapanSettingsPage() {
  const { isOwner } = await getCurrentUserProfile();

  if (!isOwner) {
    redirect('/pengaturan');
  }

  const settings = await getEmailRecapSettings();

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Pengaturan Email Rekapan</h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          Kirimkan laporan rekapan piket dan absensi berformat PDF secara berkala via Brevo ke email manajemen &amp; supervisor.
        </p>
      </div>

      {/* Tabs Pengaturan */}
      <SettingsTabs activeTab="rekapan" isOwner={isOwner} />

      {/* Formulir Pengaturan Rekapan */}
      <EmailRecapForm initialSettings={settings} />
    </div>
  );
}

