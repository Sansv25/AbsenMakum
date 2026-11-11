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
      return {
        error: 'Email Anda belum diverifikasi.',
        needsOtp: true,
        email,
      };
    }
    if (error.status === 400 || error.code === 'invalid_credentials' || error.message?.toLowerCase().includes('invalid login credentials')) {
      return { error: 'Email atau password salah.' };
    }
    return { error: error.message || 'Gagal login, periksa koneksi atau kredensial Anda.' };
  }

  // Cek apakah user perlu melengkapi profil (no telepon)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, is_approved, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.phone || profile.phone.trim() === '') {
      redirect('/complete-profile');
    }

    const isMaster = profile?.role === 'master' || user.email?.toLowerCase() === 'madesanjaya255@gmail.com';
    if (!isMaster && profile?.is_approved === false) {
      redirect('/pending-approval');
    }
  }

  redirect('/');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
