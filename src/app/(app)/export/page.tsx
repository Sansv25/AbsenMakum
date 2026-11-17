import { redirect } from 'next/navigation';
import { todayWITA, toYearMonth, getDatesInMonth } from '@/lib/dates';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { getDailyAttendanceRecap } from '@/lib/data/daily-attendance-recap';
import { getEmailRecapSettings } from '@/lib/data/email-recap';
import { ExportView } from './export-view';

export const dynamic = 'force-dynamic';

export default async function ExportPage() {
  const profile = await getCurrentUserProfile();

  // Pengguna tanpa akses piket dan tanpa role magang tidak diizinkan masuk
  if (!profile.canAccessPiket && !profile.isMagang) {
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

  // Rekap harian magang hanya diambil jika akun memiliki role magang
  const dailyRecap = profile.isMagang ? await getDailyAttendanceRecap(today) : null;
  const emailSettings = await getEmailRecapSettings();

  const emailCount =
    emailSettings.dailyRecipients && emailSettings.dailyRecipients.length > 0
      ? emailSettings.dailyRecipients.length
      : emailSettings.recipients.length;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-5 md:p-6 space-y-6">
      <ExportView
        defaultStartDate={defaultStartDate}
        defaultEndDate={defaultEndDate}
        todayDate={today}
        initialDailyRecap={dailyRecap}
        isMaster={profile.canManageSettings}
        canAccessPiket={profile.canAccessPiket}
        isMagang={profile.isMagang}
        emailRecipientsCount={emailCount}
      />
    </div>
  );
}
