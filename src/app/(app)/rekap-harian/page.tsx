import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { todayWITA } from '@/lib/dates';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { getDailyAttendanceRecap } from '@/lib/data/daily-attendance-recap';
import { getEmailRecapSettings } from '@/lib/data/email-recap';
import { RekapHarianClient } from './rekap-harian-client';

export const dynamic = 'force-dynamic';

interface RekapHarianPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function RekapHarianPage({ searchParams }: RekapHarianPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getCurrentUserProfile();

  // Akun yang tidak memiliki role magang atau senior tidak bisa mengakses rekap absen harian
  const canAccessRekapHarian = profile.isMagang || profile.isSenior || profile.isOwner || profile.isAdmin;
  if (!canAccessRekapHarian) {
    if (profile.canAccessPiket) {
      redirect('/');
    }
    if (profile.canCreateTicket) {
      redirect('/ticketing');
    }
    redirect('/profil');
  }

  const { isMaster, isOwner, isAdmin, isSenior } = profile;
  // Tombol hubungi WhatsApp hanya diizinkan untuk role senior, admin, dan owner
  const canContactWA = isOwner || isAdmin || isSenior;

  const today = todayWITA();
  const params = await searchParams;
  const workDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;

  // Ambil data rekapan harian (anak magang & semua petugas)
  const recap = await getDailyAttendanceRecap(workDate);

  // Ambil data pengaturan email untuk info status dan penerima
  const emailSettings = await getEmailRecapSettings();

  // Cek apakah tanggal yang dilihat merupakan hari libur (dari tabel holidays atau akhir pekan)
  const { data: holidayData } = await supabase
    .from('holidays')
    .select('id, name')
    .eq('holiday_date', workDate)
    .maybeSingle();

  const [y, m, d] = workDate.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const isWeekend = dow === 0 || dow === 6;
  const isHoliday = Boolean(holidayData) || isWeekend;
  const holidayName = holidayData?.name || (isWeekend ? (dow === 0 ? 'Hari Minggu' : 'Hari Sabtu') : null);

  return (
    <RekapHarianClient
      initialDate={workDate}
      initialRecap={recap}
      isMaster={isMaster || isOwner}
      canContactWA={canContactWA}
      emailRecipientsCount={
        (emailSettings.dailyRecipients && emailSettings.dailyRecipients.length > 0)
          ? emailSettings.dailyRecipients.length
          : emailSettings.recipients.length
      }
      isHoliday={isHoliday}
      holidayName={holidayName}
    />
  );
}
