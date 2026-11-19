import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentUserProfile } from '@/lib/data/profile';
import type { AttendanceFeedMessage, FeedType, GroupMemberInfo, FeedUser } from '@/lib/types/attendance-feed';

export interface ParsedManualAdminTag {
  targetUserId: string | null;
  adminName: string | null;
  isManualAdmin: boolean;
}

/**
 * Mengurai metadata kehadiran manual admin dari kolom reply_to_text
 */
export function parseManualAdminTag(replyToText?: string | null): ParsedManualAdminTag {
  if (!replyToText) {
    return { targetUserId: null, adminName: null, isManualAdmin: false };
  }
  if (replyToText.startsWith('__manual_admin_for__:')) {
    const rest = replyToText.slice('__manual_admin_for__:'.length);
    const [targetUserId, ...adminParts] = rest.split('|');
    return {
      targetUserId: targetUserId?.trim() || null,
      adminName: adminParts.join('|').trim() || 'Admin',
      isManualAdmin: true,
    };
  }
  if (replyToText.startsWith('__manual_admin__:')) {
    const adminName = replyToText.slice('__manual_admin__:'.length).trim();
    return {
      targetUserId: null,
      adminName: adminName || 'Admin',
      isManualAdmin: true,
    };
  }
  return { targetUserId: null, adminName: null, isManualAdmin: false };
}

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

  // 168 jam = 7 hari: pesan obrolan biasa ('chat') yang lebih lama dari 168 jam tidak lagi ditampilkan
  const sevenDaysAgo = new Date(Date.now() - 168 * 60 * 60 * 1000).toISOString();
  const activeRawMessages = rawMessages.filter(
    (msg) => msg.feed_type !== 'chat' || msg.created_at >= sevenDaysAgo
  );

  // Jalankan pembersihan obrolan > 168 jam di background
  cleanupOldChatMessages(168).catch(() => {});

  if (activeRawMessages.length === 0) {
    return { messages: [] };
  }

  // Ambil data anggota grup jika ada pesan group_attendance
  const groupSessionIds = activeRawMessages
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

  // Kumpulkan target user_id untuk kehadiran manual admin (fallback RLS)
  const manualTargetUserIds = new Set<string>();
  for (const msg of activeRawMessages) {
    const manualInfo = parseManualAdminTag(msg.reply_to_text);
    if (manualInfo.targetUserId) {
      manualTargetUserIds.add(manualInfo.targetUserId);
    }
  }

  const manualTargetProfileMap = new Map<string, FeedUser>();
  if (manualTargetUserIds.size > 0) {
    const { data: targetProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, roles')
      .in('id', Array.from(manualTargetUserIds));

    if (targetProfiles) {
      for (const tp of targetProfiles) {
        manualTargetProfileMap.set(tp.id, {
          id: tp.id,
          full_name: tp.full_name,
          email: tp.email,
          role: tp.role,
          roles: tp.roles,
        });
      }
    }
  }

  // Generate signed URLs untuk gambar bukti absen
  const formattedMessages: AttendanceFeedMessage[] = await Promise.all(
    activeRawMessages.map(async (msg) => {
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
      const manualInfo = parseManualAdminTag(msg.reply_to_text);
      const effectiveUserId = manualInfo.targetUserId || msg.user_id;
      const effectiveUser: FeedUser | undefined =
        manualInfo.targetUserId && manualTargetProfileMap.has(manualInfo.targetUserId)
          ? manualTargetProfileMap.get(manualInfo.targetUserId)
          : prof
          ? {
              id: prof.id,
              full_name: prof.full_name,
              email: prof.email,
              role: prof.role,
              roles: prof.roles,
            }
          : undefined;

      return {
        id: msg.id,
        work_date: msg.work_date,
        user_id: effectiveUserId,
        feed_type: msg.feed_type as FeedType,
        message: msg.message,
        media_paths,
        media_urls,
        group_session_id: msg.group_session_id,
        reply_to_id: msg.reply_to_id,
        reply_to_text: manualInfo.isManualAdmin ? null : msg.reply_to_text,
        reply_to_user: msg.reply_to_user,
        created_at: msg.created_at,
        user: effectiveUser,
        group_members: msg.group_session_id ? groupMembersMap[msg.group_session_id] || [] : undefined,
        manual_admin_by: manualInfo.isManualAdmin ? manualInfo.adminName : null,
        manual_target_user_id: manualInfo.isManualAdmin ? effectiveUserId : null,
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

  const profile = await getCurrentUserProfile();
  const canSend = profile.isMagang || profile.isSenior || profile.isOwner || profile.isAdmin;
  if (!canSend) {
    return { message: null, error: 'Hanya akun dengan role magang atau senior yang dapat mengirim pesan di absensi harian.' };
  }

  const isAdminOrOwner = profile.canManageSettings || profile.isOwner || profile.isAdmin || profile.isMaster;
  const hasPhoto = Boolean(payload.media_paths && payload.media_paths.length > 0);

  // Non-admin tetap wajib menyertakan foto saat absen_pagi
  if (payload.feed_type === 'absen_pagi' && !hasPhoto && !isAdminOrOwner) {
    return { message: null, error: 'Foto wajib dilampirkan untuk melakukan Absen Masuk.' };
  }

  const adminName = profile.fullName || profile.email || 'Admin';
  const finalReplyToText =
    payload.feed_type === 'absen_pagi' && !hasPhoto && isAdminOrOwner && !payload.reply_to_user
      ? `__manual_admin__:${adminName}`
      : payload.reply_to_text || null;

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
      reply_to_text: finalReplyToText,
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

  // Jalankan pembersihan obrolan lama di background
  cleanupOldChatMessages(168).catch(() => {});

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

  const manualInfo = parseManualAdminTag(data.reply_to_text);

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
      reply_to_text: manualInfo.isManualAdmin ? null : data.reply_to_text,
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
      manual_admin_by: manualInfo.isManualAdmin ? manualInfo.adminName : null,
      manual_target_user_id: manualInfo.isManualAdmin ? data.user_id : null,
    },
  };
}

/**
 * Menghapus pesan obrolan biasa (feed_type = 'chat') yang sudah berumur lebih lama dari 168 jam (7 hari).
 * Catatan Penting:
 * - Data absensi masuk resmi ('absen_pagi' dan 'group_attendance') TETAP DIPERTAHANKAN untuk riwayat & rekapan bulanan.
 * - File media lampiran dari obrolan yang dihapus juga dibersihkan dari Supabase Storage.
 */
export async function cleanupOldChatMessages(
  hoursThreshold = 168,
  customClient?: SupabaseClient | null
): Promise<{ deletedCount: number; error?: string }> {
  try {
    const supabase = customClient || (await createClient());

    // Ambang batas waktu: 168 jam (7 hari) yang lalu
    const thresholdDate = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000).toISOString();

    // 1. Cari pesan obrolan biasa yang sudah melebihi 168 jam
    const { data: oldChats, error: fetchErr } = await supabase
      .from('attendance_feed')
      .select('id, media_paths')
      .eq('feed_type', 'chat')
      .lt('created_at', thresholdDate);

    if (fetchErr) {
      return { deletedCount: 0, error: fetchErr.message };
    }

    if (!oldChats || oldChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = oldChats.map((c) => c.id);
    const mediaPaths: string[] = [];

    for (const c of oldChats) {
      if (Array.isArray(c.media_paths)) {
        for (const p of c.media_paths) {
          if (p && typeof p === 'string') {
            mediaPaths.push(p);
          }
        }
      }
    }

    // 2. Bersihkan file media obrolan lama di storage jika ada
    if (mediaPaths.length > 0) {
      try {
        await supabase.storage.from('evidence').remove(mediaPaths);
      } catch (storageErr) {
        console.warn('Gagal menghapus beberapa file lampiran obrolan lama:', storageErr);
      }
    }

    // 3. Hapus baris pesan obrolan dari tabel attendance_feed
    const { error: deleteErr } = await supabase
      .from('attendance_feed')
      .delete()
      .in('id', chatIds);

    if (deleteErr) {
      return { deletedCount: 0, error: deleteErr.message };
    }

    return { deletedCount: chatIds.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return { deletedCount: 0, error: msg };
  }
}
