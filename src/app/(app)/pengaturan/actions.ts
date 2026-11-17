'use server';

import { revalidatePath } from 'next/cache';
import { updateShiftSetting } from '@/lib/data/shifts';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data/profile';

export async function saveShiftSettingsAction(formData: FormData) {
  const { canManageSettings } = await getCurrentUserProfile();
  if (!canManageSettings) {
    return { error: 'Hanya Admin atau Owner yang diizinkan mengubah jam shift.' };
  }

  const pagiStart = formData.get('pagi_start') as string;
  const pagiEnd = formData.get('pagi_end') as string;
  const malamStart = formData.get('malam_start') as string;
  const malamEnd = formData.get('malam_end') as string;

  if (!pagiStart || !pagiEnd || !malamStart || !malamEnd) {
    return { error: 'Semua jam shift wajib diisi.' };
  }

  const res1 = await updateShiftSetting('pagi', pagiStart, pagiEnd);
  if (!res1.success) return { error: res1.error };

  const res2 = await updateShiftSetting('malam', malamStart, malamEnd);
  if (!res2.success) return { error: res2.error };

  revalidatePath('/pengaturan');
  return { success: true };
}

export async function resetAllAttendanceDataAction() {
  const supabase = await createClient();
  const { isOwner } = await getCurrentUserProfile();
  if (!isOwner) {
    return { error: 'Hanya Akun Owner yang diizinkan mereset database absensi.' };
  }

  try {
    // 1. Ambil list attachments untuk dihapus dari storage
    const { data: attachments } = await supabase.from('attachments').select('storage_path');
    if (attachments && attachments.length > 0) {
      const paths = attachments.map((a) => a.storage_path);
      await supabase.storage.from('evidence').remove(paths);
    }

    // 2. Hapus rows di attachments & attendances
    await supabase.from('attachments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('attendances').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    revalidatePath('/');
    revalidatePath('/riwayat');
    revalidatePath('/export');
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal membersihkan data.';
    return { error: msg };
  }
}

/**
 * Server Action: Membersihkan pesan obrolan (feed_type = 'chat') yang lebih lama dari 168 jam (7 hari).
 */
export async function cleanupOldChatAction(
  hours: number = 168
): Promise<{ deletedCount: number; error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile.canManageSettings) {
    return { deletedCount: 0, error: 'Hanya Admin, Senior, atau Owner yang diizinkan membersihkan obrolan.' };
  }

  const { cleanupOldChatMessages } = await import('@/lib/data/attendance-feed');
  const res = await cleanupOldChatMessages(hours);

  revalidatePath('/absen-chat');
  return res;
}

/**
 * Server Action: Membersihkan seluruh pesan obrolan chat (feed_type = 'chat') tanpa menghapus kartu presensi.
 */
export async function cleanupAllChatAction(): Promise<{ deletedCount: number; error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile.canManageSettings) {
    return { deletedCount: 0, error: 'Hanya Admin, Senior, atau Owner yang diizinkan membersihkan obrolan.' };
  }

  const { cleanupOldChatMessages } = await import('@/lib/data/attendance-feed');
  const res = await cleanupOldChatMessages(0);

  revalidatePath('/absen-chat');
  return res;
}
