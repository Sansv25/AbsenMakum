'use server';

import { revalidatePath } from 'next/cache';
import { addHoliday, deleteHoliday } from '@/lib/data/holidays';
import { getCurrentUserProfile } from '@/lib/data/profile';

export async function addHolidayAction(formData: FormData) {
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { error: 'Hanya Akun Master yang diizinkan mengelola hari libur.' };
  }

  const holidayDate = formData.get('holiday_date') as string;
  const name = formData.get('name') as string;

  if (!holidayDate || !name) {
    return { error: 'Tanggal dan nama libur wajib diisi.' };
  }

  const result = await addHoliday(holidayDate, name);
  if (!result.success) {
    return { error: result.error || 'Gagal menambahkan tanggal merah.' };
  }

  revalidatePath('/libur');
  revalidatePath('/');
  revalidatePath('/riwayat');
  return { success: true };
}

export async function deleteHolidayAction(id: string) {
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { error: 'Hanya Akun Master yang diizinkan mengelola hari libur.' };
  }

  const result = await deleteHoliday(id);
  if (!result.success) {
    return { error: result.error || 'Gagal menghapus tanggal merah.' };
  }

  revalidatePath('/libur');
  revalidatePath('/');
  revalidatePath('/riwayat');
  return { success: true };
}
