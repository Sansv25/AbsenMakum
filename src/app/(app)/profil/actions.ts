'use server';

import { revalidatePath } from 'next/cache';
import { updateCurrentUserProfile } from '@/lib/data/profile';

export async function updateProfileAction(formData: FormData) {
  const fullName = (formData.get('fullName') as string) || '';
  const phone = (formData.get('phone') as string) || '';
  const description = (formData.get('description') as string) || '';

  if (!fullName.trim()) {
    return { error: 'Nama wajib diisi.' };
  }

  const cleanedPhone = phone.replace(/[^0-9+]/g, '');
  if (cleanedPhone.length < 9) {
    return { error: 'Nomor Telepon tidak valid (minimal 9 digit).' };
  }

  const result = await updateCurrentUserProfile(fullName, cleanedPhone, description);
  if (!result.success) {
    return { error: result.error || 'Gagal menyimpan profil.' };
  }

  revalidatePath('/profil');
  revalidatePath('/');
  revalidatePath('/riwayat');
  return { success: true };
}

