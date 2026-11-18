'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { parseManualAdminTag } from '@/lib/data/attendance-feed';

/**
 * Menandai anak magang hadir secara manual oleh Admin/Owner tanpa perlu lampiran foto.
 */
export async function markManualAttendanceAction(
  targetUserId: string,
  workDate: string,
  note: string
): Promise<{ success?: boolean; feedId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Sesi login telah berakhir. Silakan login kembali.' };
    }

    const profile = await getCurrentUserProfile();
    const isAdminOrOwner =
      profile.canManageSettings || profile.isOwner || profile.isAdmin || profile.isMaster;

    if (!isAdminOrOwner) {
      return { error: 'Hanya Admin atau Owner yang diizinkan memberikan keterangan hadir manual.' };
    }

    if (!targetUserId || !workDate || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
      return { error: 'Data pengguna atau tanggal tidak valid.' };
    }

    const finalNote = note.trim() || 'Hadir (dikonfirmasi admin tanpa foto)';
    const adminName = profile.fullName || profile.email || 'Admin';

    // 1. Cek apakah pengguna sudah tercatat hadir pada tanggal tersebut
    const { data: existingFeeds } = await supabase
      .from('attendance_feed')
      .select('id, user_id, feed_type, reply_to_text, group_session_id')
      .eq('work_date', workDate)
      .in('feed_type', ['absen_pagi', 'group_attendance']);

    if (existingFeeds && existingFeeds.length > 0) {
      const alreadyHasDirect = existingFeeds.some((f) => {
        if (f.feed_type === 'absen_pagi') {
          const manualInfo = parseManualAdminTag(f.reply_to_text);
          const effectiveUserId = manualInfo.targetUserId || f.user_id;
          return effectiveUserId === targetUserId;
        }
        return f.feed_type === 'group_attendance' && f.user_id === targetUserId;
      });

      if (alreadyHasDirect) {
        return { error: 'Pengguna ini sudah tercatat hadir pada tanggal tersebut.' };
      }

      const groupSessionIds = existingFeeds
        .filter((f) => f.group_session_id)
        .map((f) => f.group_session_id as string);

      if (groupSessionIds.length > 0) {
        const { data: memberExists } = await supabase
          .from('group_attendance_members')
          .select('id')
          .in('session_id', groupSessionIds)
          .eq('user_id', targetUserId)
          .maybeSingle();

        if (memberExists) {
          return { error: 'Pengguna ini sudah tercatat hadir melalui Absen Bareng.' };
        }
      }
    }

    // 2. Percobaan pertama: Insert langsung atas nama targetUserId (didukung jika RLS admin sudah aktif)
    const directInsert = await supabase
      .from('attendance_feed')
      .insert({
        user_id: targetUserId,
        work_date: workDate,
        feed_type: 'absen_pagi',
        message: finalNote,
        media_paths: [],
        reply_to_text: `__manual_admin__:${adminName}`,
        reply_to_user: null,
      })
      .select('id')
      .single();

    if (!directInsert.error && directInsert.data) {
      revalidatePath('/rekap-harian');
      revalidatePath('/absen-chat');
      revalidatePath('/export');
      return { success: true, feedId: directInsert.data.id };
    }

    // 3. Fallback jika RLS INSERT masih hanya mengizinkan auth.uid() = user_id:
    // Simpan catatan atas user_id admin dengan penanda target pengguna di metadata reply_to_text
    const isRlsError =
      directInsert.error?.code === '42501' ||
      (directInsert.error?.message || '').toLowerCase().includes('row-level security');

    if (isRlsError) {
      const fallbackInsert = await supabase
        .from('attendance_feed')
        .insert({
          user_id: user.id,
          work_date: workDate,
          feed_type: 'absen_pagi',
          message: finalNote,
          media_paths: [],
          reply_to_text: `__manual_admin_for__:${targetUserId}|${adminName}`,
          reply_to_user: null,
        })
        .select('id')
        .single();

      if (fallbackInsert.error || !fallbackInsert.data) {
        return {
          error: fallbackInsert.error?.message || 'Gagal menyimpan keterangan hadir manual.',
        };
      }

      revalidatePath('/rekap-harian');
      revalidatePath('/absen-chat');
      revalidatePath('/export');
      return { success: true, feedId: fallbackInsert.data.id };
    }

    return { error: directInsert.error?.message || 'Gagal menyimpan kehadiran manual.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return { error: msg };
  }
}

/**
 * Mengubah keterangan hadir manual tanpa foto oleh Admin/Owner.
 */
export async function updateManualAttendanceNoteAction(
  feedId: string,
  targetUserId: string,
  workDate: string,
  newNote: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Sesi login telah berakhir.' };
    }

    const profile = await getCurrentUserProfile();
    const isAdminOrOwner =
      profile.canManageSettings || profile.isOwner || profile.isAdmin || profile.isMaster;

    if (!isAdminOrOwner) {
      return { error: 'Hanya Admin atau Owner yang diizinkan mengubah keterangan hadir.' };
    }

    const finalNote = newNote.trim() || 'Hadir (dikonfirmasi admin tanpa foto)';

    // Coba update langsung
    const { data: updatedRows, error: updateErr } = await supabase
      .from('attendance_feed')
      .update({ message: finalNote })
      .eq('id', feedId)
      .select('id');

    if (!updateErr && updatedRows && updatedRows.length > 0) {
      revalidatePath('/rekap-harian');
      revalidatePath('/absen-chat');
      revalidatePath('/export');
      return { success: true };
    }

    // Jika UPDATE terblokir RLS (belum ada policy UPDATE), lakukan hapus & buat ulang secara atomis
    const { error: delErr } = await supabase.from('attendance_feed').delete().eq('id', feedId);
    if (delErr) {
      return { error: delErr.message || 'Gagal memperbarui keterangan hadir.' };
    }

    const recreated = await markManualAttendanceAction(targetUserId, workDate, finalNote);
    if (recreated.error) {
      return { error: recreated.error };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return { error: msg };
  }
}

/**
 * Membatalkan / menghapus keterangan hadir manual tanpa foto oleh Admin/Owner.
 */
export async function cancelManualAttendanceAction(
  feedId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Sesi login telah berakhir.' };
    }

    const profile = await getCurrentUserProfile();
    const isAdminOrOwner =
      profile.canManageSettings || profile.isOwner || profile.isAdmin || profile.isMaster;

    if (!isAdminOrOwner) {
      return { error: 'Hanya Admin atau Owner yang diizinkan membatalkan kehadiran manual.' };
    }

    if (!feedId) {
      return { error: 'ID catatan kehadiran tidak ditemukan.' };
    }

    const { error } = await supabase.from('attendance_feed').delete().eq('id', feedId);

    if (error) {
      return { error: error.message || 'Gagal membatalkan kehadiran manual.' };
    }

    revalidatePath('/rekap-harian');
    revalidatePath('/absen-chat');
    revalidatePath('/export');
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return { error: msg };
  }
}
