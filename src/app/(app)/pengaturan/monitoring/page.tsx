import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { getStorageStats } from '@/lib/data/monitoring';
import { SettingsTabs } from '../settings-tabs';
import { MonitoringView } from './monitoring-view';

export default async function MonitoringPage() {
  const { isMaster } = await getCurrentUserProfile();

  if (!isMaster) {
    redirect('/');
  }

  const { stats, error } = await getStorageStats();

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Monitoring Kapasitas Supabase</h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          Pantau sisa kuota penyimpanan foto (Storage Bucket), ukuran database PostgreSQL, dan daya tampung sistem.
        </p>
      </div>

      {/* Tabs Navigasi Pengaturan */}
      <SettingsTabs activeTab="monitoring" />

      {error || !stats ? (
        <div className="bg-red-50 dark:bg-red-950/40 p-4 rounded-2xl border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs">
          <p className="font-semibold">Gagal memuat metrik monitoring</p>
          <p className="mt-1">{error || 'Terjadi kesalahan sistem.'}</p>
        </div>
      ) : (
        <MonitoringView initialStats={stats} />
      )}
    </div>
  );
}

