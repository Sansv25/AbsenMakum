import { createClient } from '@/lib/supabase/server';
import type { AttendanceFeedMessage, FeedType, GroupMemberInfo } from '@/lib/types/attendance-feed';

/**
 * Mengambil daftar pesan feed chat absen pagi untuk tanggal tertentu
 */
export async function getAttendanceFeedMessages(
  work_date: string
): Promise<{ messages: AttendanceFeedMessage[]; error?: string }> {
  const supabase = await createClient();

  const { data: rawMessages, error } = await supabase
    .from('attendance_feed')
    .select(`
      id,
      work_date,
      user_id,
      feed_type,
      message,
      media_paths,
      group_session_id,
      reply_to_id,
      reply_to_text,
      reply_to_user,
      created_at,
      profiles:user_id (
        id,
        full_name,
        email,
        role,
        roles
      )
    `)
    .eq('work_date', work_date)
    .order('created_at', { ascending: true });

  if (error) {
    return { messages: [], error: error.message };
  }

  if (!rawMessages || rawMessages.length === 0) {
    return { messages: [] };
  }

  // Ambil data anggota grup jika ada pesan group_attendance
  const groupSessionIds = rawMessages
    .filter((m) => m.group_session_id)
    .map((m) => m.group_session_id as string);

  const groupMembersMap: Record<string, GroupMemberInfo[]> = {};

  if (groupSessionIds.length > 0) {
    const { data: membersData } = await supabase
      .from('group_attendance_members')
      .select(`
        session_id,
        user_id,
        verified_at,
        profiles:user_id (
          full_name,
          email
        )
      `)
      .in('session_id', groupSessionIds);

    if (membersData) {
      for (const m of membersData) {
        if (!groupMembersMap[m.session_id]) {
          groupMembersMap[m.session_id] = [];
        }
        const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        groupMembersMap[m.session_id].push({
          user_id: m.user_id,
          full_name: prof?.full_name ?? null,
          email: prof?.email ?? null,
          verified_at: m.verified_at,
        });
      }
    }
  }

  // Generate signed URLs untuk gambar bukti absen
  const formattedMessages: AttendanceFeedMessage[] = await Promise.all(
    rawMessages.map(async (msg) => {
      const media_paths = (msg.media_paths || []) as string[];
      const media_urls: string[] = [];

      for (const p of media_paths) {
        if (p) {
          const { data: signData } = await supabase.storage
            .from('evidence')
            .createSignedUrl(p, 3600);
          if (signData?.signedUrl) {
            media_urls.push(signData.signedUrl);
          }
        }
      }

      const prof = Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles;

      return {
        id: msg.id,
        work_date: msg.work_date,
        user_id: msg.user_id,
        feed_type: msg.feed_type as FeedType,
        message: msg.message,
        media_paths,
        media_urls,
        group_session_id: msg.group_session_id,
        reply_to_id: msg.reply_to_id,
        reply_to_text: msg.reply_to_text,
        reply_to_user: msg.reply_to_user,
        created_at: msg.created_at,
        user: prof
          ? {
              id: prof.id,
              full_name: prof.full_name,
              email: prof.email,
              role: prof.role,
              roles: prof.roles,
            }
          : undefined,
        group_members: msg.group_session_id ? groupMembersMap[msg.group_session_id] || [] : undefined,
      };
    })
  );

  return { messages: formattedMessages };
}

/**
 * Menambahkan pesan / absen baru ke feed chat absen pagi
 */
export async function createAttendanceFeedMessage(payload: {
  work_date: string;
  feed_type: FeedType;
  message?: string | null;
  media_paths?: string[];
  group_session_id?: string | null;
  reply_to_id?: string | null;
  reply_to_text?: string | null;
  reply_to_user?: string | null;
}): Promise<{ message: AttendanceFeedMessage | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: null, error: 'Tidak terautentikasi' };
  }

  const { data, error } = await supabase
    .from('attendance_feed')
    .insert({
      user_id: user.id,
      work_date: payload.work_date,
      feed_type: payload.feed_type,
      message: payload.message?.trim() || null,
      media_paths: payload.media_paths || [],
      group_session_id: payload.group_session_id || null,
      reply_to_id: payload.reply_to_id || null,
      reply_to_text: payload.reply_to_text || null,
      reply_to_user: payload.reply_to_user || null,
    })
    .select(`
      id,
      work_date,
      user_id,
      feed_type,
      message,
      media_paths,
      group_session_id,
      reply_to_id,
      reply_to_text,
      reply_to_user,
      created_at,
      profiles:user_id (
        id,
        full_name,
        email,
        role,
        roles
      )
    `)
    .single();

  if (error || !data) {
    return { message: null, error: error?.message || 'Gagal mengirim pesan feed' };
  }

  const prof = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

  const media_paths = (data.media_paths || []) as string[];
  const media_urls: string[] = [];
  for (const p of media_paths) {
    if (p) {
      const { data: signData } = await supabase.storage.from('evidence').createSignedUrl(p, 3600);
      if (signData?.signedUrl) {
        media_urls.push(signData.signedUrl);
      }
    }
  }

  return {
    message: {
      id: data.id,
      work_date: data.work_date,
      user_id: data.user_id,
      feed_type: data.feed_type as FeedType,
      message: data.message,
      media_paths,
      media_urls,
      group_session_id: data.group_session_id,
      reply_to_id: data.reply_to_id,
      reply_to_text: data.reply_to_text,
      reply_to_user: data.reply_to_user,
      created_at: data.created_at,
      user: prof
        ? {
            id: prof.id,
            full_name: prof.full_name,
            email: prof.email,
            role: prof.role,
            roles: prof.roles,
          }
        : undefined,
    },
  };
}
