'use server';

import { updateCurrentUserProfile, getCurrentUserProfile } from '@/lib/data/profile';
import { redirect } from 'next/navigation';

export async function saveProfileDetails(formData: FormData) {
  const fullName = (formData.get('fullName') as string) || '';
  const phone = (formData.get('phone') as string) || '';

  if (!fullName.trim()) {
    return { error: 'Nama wajib diisi.' };
  }

  const cleanedPhone = phone.replace(/[^0-9+]/g, '');
  if (cleanedPhone.length < 9) {
    return { error: 'Nomor Telepon tidak valid (minimal 9 digit).' };
  }

  const result = await updateCurrentUserProfile(fullName, cleanedPhone);
  if (!result.success) {
    return { error: result.error || 'Gagal menyimpan profil.' };
  }

  const profile = await getCurrentUserProfile();
  if (!profile.isMaster && !profile.isApproved) {
    redirect('/pending-approval');
  }

  redirect('/');
}

