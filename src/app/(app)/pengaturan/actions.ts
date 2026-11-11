'use server';

import { revalidatePath } from 'next/cache';
import { updateShiftSetting } from '@/lib/data/shifts';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data/profile';

export async function saveShiftSettingsAction(formData: FormData) {
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
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { error: 'Hanya Akun Master yang diizinkan mereset database absensi.' };
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
