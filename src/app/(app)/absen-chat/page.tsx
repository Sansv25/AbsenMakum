import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { todayWITA } from '@/lib/dates';
import { getRequiredShifts, type ShiftType } from '@/lib/shifts';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { getAttendanceFeedMessages } from '@/lib/data/attendance-feed';
import { AttendanceChatClient } from '@/components/attendance/attendance-chat-client';
import type { Holiday } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

interface AbsenChatPageProps {
  searchParams: Promise<{ date?: string; shift?: string }>;
}

export default async function AbsenChatPage({ searchParams }: AbsenChatPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { isMaster, fullName, roles, email } = await getCurrentUserProfile();

  const today = todayWITA();
  const params = await searchParams;
  const workDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;

  // Ambil daftar libur untuk menentukan shift yang valid
  const { data: holidaysData } = await supabase.from('holidays').select('*');
  const holidays = (holidaysData ?? []) as Holiday[];
  const holidaySet = new Set(holidays.map((h) => h.holiday_date));

  const availableShifts = getRequiredShifts(workDate, holidaySet);

  let initialShift: ShiftType = 'malam';
  if (params.shift === 'pagi' || params.shift === 'malam') {
    initialShift = params.shift as ShiftType;
  } else if (availableShifts.includes('pagi')) {
    // Cek jam sekarang di WITA
    const witaHour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Makassar',
        hour: 'numeric',
        hour12: false,
      }).format(new Date()),
      10
    );
    if (witaHour < 15) {
      initialShift = 'pagi';
    } else {
      initialShift = 'malam';
    }
  }

  // Ambil pesan awal di server
  const { messages } = await getAttendanceFeedMessages(workDate, initialShift);

  return (
    <AttendanceChatClient
      initialDate={workDate}
      initialShift={initialShift}
      availableShifts={availableShifts.length > 0 ? availableShifts : ['pagi', 'malam']}
      currentUserId={user.id}
      currentUserName={fullName || email || 'Petugas'}
      currentUserRoles={roles || []}
      isMaster={isMaster}
      initialMessages={messages}
    />
  );
}
