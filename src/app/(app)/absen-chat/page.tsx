import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { todayWITA } from '@/lib/dates';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { getAttendanceFeedMessages } from '@/lib/data/attendance-feed';
import { AttendanceChatClient } from '@/components/attendance/attendance-chat-client';

export const dynamic = 'force-dynamic';

interface AbsenChatPageProps {
  searchParams: Promise<{ date?: string }>;
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

  // Ambil pesan awal absen pagi di server
  const { messages } = await getAttendanceFeedMessages(workDate);

  return (
    <AttendanceChatClient
      initialDate={workDate}
      currentUserId={user.id}
      currentUserName={fullName || email || 'Petugas'}
      currentUserRoles={roles || []}
      isMaster={isMaster}
      initialMessages={messages}
    />
  );
}
