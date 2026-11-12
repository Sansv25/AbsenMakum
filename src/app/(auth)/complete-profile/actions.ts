'use server';

import { updateCurrentUserProfile, getCurrentUserProfile } from '@/lib/data/profile';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function saveProfileDetails(formData: FormData) {
  const fullName = (formData.get('fullName') as string) || '';
  const phone = (formData.get('phone') as string) || '';
  const password = (formData.get('password') as string) || '';
  const confirmPassword = (formData.get('confirmPassword') as string) || '';

  if (!fullName.trim()) {
    return { error: 'Nama lengkap wajib diisi.' };
  }

  const cleanedPhone = phone.replace(/[^0-9+]/g, '');
  if (cleanedPhone.length < 9) {
    return { error: 'Nomor Telepon tidak valid (minimal 9 digit).' };
  }

  if (!password || password.length < 6) {
    return { error: 'Password minimal 6 karakter.' };
  }

  if (password !== confirmPassword) {
    return { error: 'Konfirmasi password tidak cocok dengan password.' };
  }

  const supabase = await createClient();

  // 1. Simpan password ke akun Supabase Auth pengguna
  const { error: pwdError } = await supabase.auth.updateUser({
    password: password.trim(),
  });

  if (pwdError) {
    return { error: `Gagal membuat password akun: ${pwdError.message}` };
  }

  // 2. Simpan nama dan nomor telepon ke tabel profiles
  const result = await updateCurrentUserProfile(fullName, cleanedPhone);
  if (!result.success) {
    return { error: result.error || 'Gagal menyimpan data profil.' };
  }

  // 3. Cek status persetujuan akun
  const profile = await getCurrentUserProfile();
  if (!profile.isMaster && !profile.isApproved) {
    redirect('/pending-approval');
  }

  redirect('/');
}

