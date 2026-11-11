'use server';

import { updateCurrentUserProfile } from '@/lib/data/profile';
import { redirect } from 'next/navigation';

export async function saveProfileDetails(formData: FormData) {
  const fullName = (formData.get('fullName') as string) || '';
  const phone = (formData.get('phone') as string) || '';

  if (!fullName.trim()) {
    return { error: 'Nama Lengkap wajib diisi.' };
  }

  const cleanedPhone = phone.replace(/[^0-9+]/g, '');
  if (cleanedPhone.length < 9) {
    return { error: 'Nomor Telepon tidak valid (minimal 9 digit).' };
  }

  const result = await updateCurrentUserProfile(fullName, cleanedPhone);
  if (!result.success) {
    return { error: result.error || 'Gagal menyimpan profil.' };
  }

  redirect('/');
}

