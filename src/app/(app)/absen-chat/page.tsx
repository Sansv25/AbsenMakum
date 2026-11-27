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

  const myProfile = await getCurrentUserProfile();

  // Pengguna yang tidak memiliki role magang, senior, atau owner tidak diizinkan mengakses absen harian
  const canAccessAbsenHarian = myProfile.isMagang || myProfile.isSenior || myProfile.isOwner;
  if (!canAccessAbsenHarian) {
    if (myProfile.canAccessPiket) {
      redirect('/');
    }
    if (myProfile.canCreateTicket) {
      redirect('/ticketing');
    }
    redirect('/profil');
  }

  const today = todayWITA();
  const params = await searchParams;
  const workDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;

  // Ambil pesan awal absen pagi di server
  const { messages } = await getAttendanceFeedMessages(workDate);

  // Ambil daftar user untuk fitur @ tag / mention dan daftar anak magang (untuk absen manual admin)
  const { data: rawProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, roles, is_approved, exclude_from_recap')
    .order('full_name');

  const availableProfiles = (rawProfiles || []).map((p) => ({
    id: p.id,
    full_name: p.full_name || p.email || 'Petugas',
    email: p.email || null,
  }));

  const internProfiles = (rawProfiles || [])
    .filter((p) => {
      if (!p.is_approved || p.exclude_from_recap) return false;
      const roles = Array.isArray(p.roles) ? (p.roles as string[]) : [];
      if (
        roles.includes('senior') ||
        roles.includes('owner') ||
        roles.includes('admin') ||
        p.role === 'senior' ||
        p.role === 'master'
      ) {
        return false;
      }
      return roles.includes('magang');
    })
    .map((p) => ({
      id: p.id,
      full_name: p.full_name || p.email || 'Anak Magang',
      email: p.email || null,
    }));

  const isAdmin =
    myProfile.canManageSettings || myProfile.isOwner || myProfile.isAdmin || myProfile.isMaster;

  return (
    <AttendanceChatClient
      initialDate={workDate}
      currentUserId={user.id}
      currentUserName={myProfile.fullName || user.email || 'Petugas'}
      initialMessages={messages}
      availableProfiles={availableProfiles}
      internProfiles={internProfiles}
      isAdmin={isAdmin}
      canViewRecap={myProfile.canAccessRekapHarian}
    />
  );
}
