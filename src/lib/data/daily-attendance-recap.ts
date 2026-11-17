import { createClient } from '@/lib/supabase/server';
import type { AppRole } from '@/lib/supabase/types';

export interface DailyAttendanceRecord {
  user: {
    id: string;
    full_name: string;
    email: string;
    phone?: string | null;
    role: string;
    roles?: AppRole[];
  };
  isHadir: boolean;
  attendanceTime?: string | null; // e.g. "07:45 WITA"
  feedType?: 'absen_pagi' | 'group_attendance' | null;
  methodLabel?: string | null; // e.g. "Absen Foto (Selfie)" atau "Absen Bareng (QR)"
  photoUrl?: string | null;
  message?: string | null;
  verifiedAtRaw?: string | null;
}

export interface DailyAttendanceRecapResult {
  workDate: string;
  totalInterns: number;
  totalHadir: number;
  totalTidakHadir: number;
  persentaseHadir: number;
  records: DailyAttendanceRecord[];
  allActiveRecords: DailyAttendanceRecord[];
  error?: string;
}

/**
 * Mengambil rekapan kehadiran absen harian (khusus anak magang & semua petugas) untuk tanggal tertentu
 */
export async function getDailyAttendanceRecap(
  workDate: string
): Promise<DailyAttendanceRecapResult> {
  try {
    const supabase = await createClient();

    // 1. Ambil semua profil pengguna yang disetujui (aktif)
    const { data: rawProfiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, roles, is_approved, exclude_from_recap')
      .eq('is_approved', true)
      .order('full_name', { ascending: true });

    if (profErr) {
      return {
        workDate,
        totalInterns: 0,
        totalHadir: 0,
        totalTidakHadir: 0,
        persentaseHadir: 0,
        records: [],
        allActiveRecords: [],
        error: profErr.message,
      };
    }

    const profiles = rawProfiles || [];

    // 2. Ambil data attendance_feed pada tanggal tersebut
    const { data: feedData, error: feedErr } = await supabase
      .from('attendance_feed')
      .select(`
        id,
        work_date,
        user_id,
        feed_type,
        message,
        media_paths,
        group_session_id,
        created_at
      `)
      .eq('work_date', workDate)
      .order('created_at', { ascending: true });

    if (feedErr) {
      return {
        workDate,
        totalInterns: 0,
        totalHadir: 0,
        totalTidakHadir: 0,
        persentaseHadir: 0,
        records: [],
        allActiveRecords: [],
        error: feedErr.message,
      };
    }

    const feedList = feedData || [];

    // 3. Ambil data group_attendance_members untuk sesi group pada tanggal tersebut
    const groupSessionIds = feedList
      .filter((f) => f.group_session_id)
      .map((f) => f.group_session_id as string);

    interface GroupMemberRow {
      session_id: string;
      user_id: string;
      verified_at: string;
    }

    let groupMembers: GroupMemberRow[] = [];
    if (groupSessionIds.length > 0) {
      const { data: gmData } = await supabase
        .from('group_attendance_members')
        .select('session_id, user_id, verified_at')
        .in('session_id', groupSessionIds);

      if (gmData) groupMembers = gmData;
    }

    // Map: sessionId -> group feed item (untuk ambil foto dan catatan group)
    const groupFeedMap = new Map<string, (typeof feedList)[0]>();
    for (const f of feedList) {
      if (f.group_session_id) {
        groupFeedMap.set(f.group_session_id, f);
      }
    }

    // Map: userId -> group member row
    const userGroupMemberMap = new Map<string, GroupMemberRow>();
    for (const gm of groupMembers) {
      userGroupMemberMap.set(gm.user_id, gm);
    }

    // Map: userId -> individual absen_pagi feed
    const userAbsenPagiMap = new Map<string, (typeof feedList)[0]>();
    // Map: userId -> initiator group feed
    const userGroupInitiatorMap = new Map<string, (typeof feedList)[0]>();

    for (const f of feedList) {
      if (f.feed_type === 'absen_pagi' && !userAbsenPagiMap.has(f.user_id)) {
        userAbsenPagiMap.set(f.user_id, f);
      } else if (f.feed_type === 'group_attendance' && !userGroupInitiatorMap.has(f.user_id)) {
        userGroupInitiatorMap.set(f.user_id, f);
      }
    }

    // Kumpulkan semua media paths yang perlu di-generate signed URL
    const mediaPathsToSign = new Set<string>();
    for (const f of feedList) {
      if (f.media_paths && Array.isArray(f.media_paths) && f.media_paths[0]) {
        mediaPathsToSign.add(f.media_paths[0]);
      }
    }

    // Generate signed URLs secara efisien
    const signedUrlMap = new Map<string, string>();
    for (const path of Array.from(mediaPathsToSign)) {
      try {
        const { data: signData } = await supabase.storage.from('evidence').createSignedUrl(path, 3600);
        if (signData?.signedUrl) {
          signedUrlMap.set(path, signData.signedUrl);
        }
      } catch {
        // Fallback jika storage path gagal
      }
    }

    // Helper format waktu WITA
    function formatTimeWITA(isoStr?: string | null): string | null {
      if (!isoStr) return null;
      try {
        return new Date(isoStr).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Makassar',
        }) + ' WITA';
      } catch {
        return null;
      }
    }

    // 4. Bangun data rekapan untuk setiap profil
    const allRecords: DailyAttendanceRecord[] = profiles.map((p) => {
      const roles = (p.roles || []) as AppRole[];
      const isInitiator = userGroupInitiatorMap.has(p.id);
      const isMemberOfGroup = userGroupMemberMap.has(p.id);
      const hasAbsenPagi = userAbsenPagiMap.has(p.id);

      const isHadir = hasAbsenPagi || isInitiator || isMemberOfGroup;

      let attendanceTime: string | null = null;
      let feedType: 'absen_pagi' | 'group_attendance' | null = null;
      let methodLabel: string | null = null;
      let photoUrl: string | null = null;
      let message: string | null = null;
      let verifiedAtRaw: string | null = null;

      if (hasAbsenPagi) {
        const item = userAbsenPagiMap.get(p.id)!;
        verifiedAtRaw = item.created_at;
        attendanceTime = formatTimeWITA(item.created_at);
        feedType = 'absen_pagi';
        methodLabel = 'Absen Foto (Selfie)';
        message = item.message;
        if (item.media_paths?.[0]) {
          photoUrl = signedUrlMap.get(item.media_paths[0]) || null;
        }
      } else if (isInitiator) {
        const item = userGroupInitiatorMap.get(p.id)!;
        verifiedAtRaw = item.created_at;
        attendanceTime = formatTimeWITA(item.created_at);
        feedType = 'group_attendance';
        methodLabel = 'Absen Bareng';
        message = item.message;
        if (item.media_paths?.[0]) {
          photoUrl = signedUrlMap.get(item.media_paths[0]) || null;
        }
      } else if (isMemberOfGroup) {
        const memberRow = userGroupMemberMap.get(p.id)!;
        verifiedAtRaw = memberRow.verified_at;
        attendanceTime = formatTimeWITA(memberRow.verified_at);
        feedType = 'group_attendance';
        methodLabel = 'Absen Bareng';
        const groupFeed = groupFeedMap.get(memberRow.session_id);
        if (groupFeed) {
          message = groupFeed.message;
          if (groupFeed.media_paths?.[0]) {
            photoUrl = signedUrlMap.get(groupFeed.media_paths[0]) || null;
          }
        }
      }

      return {
        user: {
          id: p.id,
          full_name: p.full_name || p.email,
          email: p.email,
          phone: p.phone,
          role: p.role,
          roles,
        },
        isHadir,
        attendanceTime,
        feedType,
        methodLabel,
        photoUrl,
        message,
        verifiedAtRaw,
      };
    });

    // 5. Filter khusus Anak Magang (Senior, Owner, Admin, Master TIDAK ikut di rekap absen harian)
    const internRecords = allRecords.filter((rec) => {
      const p = profiles.find((prof) => prof.id === rec.user.id);
      if (p?.exclude_from_recap) return false;

      const roles = rec.user.roles || [];

      // Senior, Owner, Admin, Master tidak boleh ikut di rekap absen harian
      if (
        roles.includes('senior') ||
        roles.includes('owner') ||
        roles.includes('admin') ||
        rec.user.role === 'senior' ||
        rec.user.role === 'master'
      ) {
        return false;
      }

      // Hanya akun yang memiliki role magang yang masuk rekap
      return roles.includes('magang');
    });

    // Urutkan: Hadir lebih dulu (berdasarkan jam), baru yang Belum Hadir (alfabet)
    function sortRecords(arr: DailyAttendanceRecord[]) {
      return [...arr].sort((a, b) => {
        if (a.isHadir && !b.isHadir) return -1;
        if (!a.isHadir && b.isHadir) return 1;
        if (a.isHadir && b.isHadir) {
          return (a.verifiedAtRaw || '').localeCompare(b.verifiedAtRaw || '');
        }
        return (a.user.full_name || '').localeCompare(b.user.full_name || '');
      });
    }

    const sortedInterns = sortRecords(internRecords);

    // allActiveRecords juga mengecualikan Senior, Owner, Admin agar konsisten tidak ikut di rekap
    const nonStaffRecords = allRecords.filter((rec) => {
      const p = profiles.find((prof) => prof.id === rec.user.id);
      if (p?.exclude_from_recap) return false;
      const roles = rec.user.roles || [];
      if (
        roles.includes('senior') ||
        roles.includes('owner') ||
        roles.includes('admin') ||
        rec.user.role === 'senior' ||
        rec.user.role === 'master'
      ) {
        return false;
      }
      return true;
    });
    const sortedAll = sortRecords(nonStaffRecords);

    const totalInterns = sortedInterns.length;
    const totalHadir = sortedInterns.filter((r) => r.isHadir).length;
    const totalTidakHadir = totalInterns - totalHadir;
    const persentaseHadir = totalInterns > 0 ? Math.round((totalHadir / totalInterns) * 100) : 0;

    return {
      workDate,
      totalInterns,
      totalHadir,
      totalTidakHadir,
      persentaseHadir,
      records: sortedInterns,
      allActiveRecords: sortedAll,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil rekapan harian';
    return {
      workDate,
      totalInterns: 0,
      totalHadir: 0,
      totalTidakHadir: 0,
      persentaseHadir: 0,
      records: [],
      allActiveRecords: [],
      error: msg,
    };
  }
}
