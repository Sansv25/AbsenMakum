import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { getHolidays } from '@/lib/data/holidays';
import { HolidayManager } from './holiday-manager';
import { todayWITA } from '@/lib/dates';

export default async function LiburPage() {
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    redirect('/');
  }

  const holidays = await getHolidays();
  const currentYear = Number(todayWITA().split('-')[0]);

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Kelola Tanggal Merah</h1>
        <p className="text-xs text-gray-500 mt-1">
          Tanggal merah otomatis mengubah kewajiban piket pada hari kerja menjadi 2 shift (Pagi & Malam).
        </p>
      </div>

      <HolidayManager initialHolidays={holidays} currentYear={currentYear} />
    </div>
  );
}
