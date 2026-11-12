'use server';

import { revalidatePath } from 'next/cache';
import { updateCurrentUserProfile } from '@/lib/data/profile';
import { createClient } from '@/lib/supabase/server';

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

export async function changePasswordAction(formData: FormData) {
  const newPassword = (formData.get('newPassword') as string) || '';
  const confirmPassword = (formData.get('confirmPassword') as string) || '';

  if (!newPassword || newPassword.length < 6) {
    return { error: 'Password baru minimal 6 karakter.' };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'Konfirmasi password tidak cocok dengan password baru.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: newPassword.trim(),
  });

  if (error) {
    return { error: error.message || 'Gagal mengubah password akun.' };
  }

  return { success: true };
}

