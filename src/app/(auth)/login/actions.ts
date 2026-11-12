'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = (formData.get('email') as string || '').trim().toLowerCase();
  const password = formData.get('password') as string || '';

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message?.toLowerCase().includes('email not confirmed')) {
      await supabase.auth.resend({
        type: 'signup',
        email,
      });
      return {
        error: 'Email Anda belum diverifikasi. Kode OTP baru telah dikirim ke email.',
        needsOtp: true,
        email,
      };
    }
    if (error.status === 400 || error.code === 'invalid_credentials' || error.message?.toLowerCase().includes('invalid login credentials')) {
      return { error: 'Email atau password salah.' };
    }
    return { error: error.message || 'Gagal login, periksa koneksi atau kredensial Anda.' };
  }

  // Kredensial email & password valid!
  // Terapkan alur 2-Step Verification (2FA via Email OTP):
  // 1. Cabut sesi sementara agar pengguna wajib memverifikasi OTP terlebih dahulu
  await supabase.auth.signOut();

  // 2. Kirim kode OTP 6-digit ke email pengguna
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  });

  if (otpError) {
    return {
      error: otpError.message || 'Gagal mengirim kode verifikasi OTP ke email.',
    };
  }

  // 3. Kembalikan respons berhasil agar antarmuka mengalihkan ke /verify-otp
  return {
    success: true,
    needsOtp: true,
    email,
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
