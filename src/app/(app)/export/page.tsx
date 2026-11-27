import { redirect } from 'next/navigation';
import { todayWITA, toYearMonth, getDatesInMonth } from '@/lib/dates';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { ExportView } from './export-view';

export const dynamic = 'force-dynamic';

export default async function ExportPage() {
  const profile = await getCurrentUserProfile();

  // Halaman Export Rekapan khusus untuk pengguna dengan akses piket (Owner, Admin Piket, Senior, Petugas Piket)
  if (!profile.canAccessPiket) {
    if (profile.isMagang || profile.isSenior) {
      redirect('/absen-chat');
    }
    if (profile.canCreateTicket) {
      redirect('/ticketing');
    }
    redirect('/profil');
  }

  const today = todayWITA();
  const currentMonth = toYearMonth(today);
  const dates = getDatesInMonth(currentMonth);
  const defaultStartDate = dates[0];
  const defaultEndDate = dates[dates.length - 1];

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-5 md:p-6 space-y-6">
      <ExportView
        defaultStartDate={defaultStartDate}
        defaultEndDate={defaultEndDate}
      />
    </div>
  );
}
