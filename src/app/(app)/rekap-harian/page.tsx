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

  // Akun yang tidak memiliki role magang tidak bisa mengakses rekap absen harian
  if (!profile.isMagang) {
    if (profile.canAccessPiket) {
      redirect('/');
    }
    if (profile.canCreateTicket) {
      redirect('/ticketing');
    }
    redirect('/profil');
  }

  const { isMaster, isOwner } = profile;

  const today = todayWITA();
  const params = await searchParams;
  const workDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;

  // Ambil data rekapan harian (anak magang & semua petugas)
  const recap = await getDailyAttendanceRecap(workDate);

  // Ambil data pengaturan email untuk info status dan penerima
  const emailSettings = await getEmailRecapSettings();

  return (
    <RekapHarianClient
      initialDate={workDate}
      initialRecap={recap}
      isMaster={isMaster || isOwner}
      emailRecipientsCount={
        (emailSettings.dailyRecipients && emailSettings.dailyRecipients.length > 0)
          ? emailSettings.dailyRecipients.length
          : emailSettings.recipients.length
      }
    />
  );
}
