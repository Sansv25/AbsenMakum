import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/';

  // Jika penyedia OAuth mengembalikan error (misal Client Secret salah di Supabase)
  if (errorParam || errorDescription) {
    const errorMsg = errorDescription || errorParam || 'Gagal autentikasi Google';
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Periksa apakah pengguna sudah melengkapi nomor telepon di profil
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone, is_approved, role')
          .eq('id', user.id)
          .maybeSingle();

        // Jika nomor telepon belum ada, wajib arahkan ke halaman lengkapi profil
        if (!profile?.phone || profile.phone.trim() === '') {
          return NextResponse.redirect(`${origin}/complete-profile`);
        }

        const isMaster =
          profile.role === 'master' ||
          user.email?.toLowerCase() === 'madesanjaya255@gmail.com';
        if (!isMaster && profile.is_approved === false) {
          return NextResponse.redirect(`${origin}/pending-approval`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    } else {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message || 'Gagal tukar sesi autentikasi')}`
      );
    }
  }

  // Jika code tidak ditemukan
  return NextResponse.redirect(`${origin}/login?error=Kode+autentikasi+tidak+ditemukan`);
}

