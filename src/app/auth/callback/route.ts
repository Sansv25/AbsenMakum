import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/';

  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';
  const redirectBase = isLocalEnv ? origin : (forwardedHost ? `https://${forwardedHost}` : origin);

  // Jika penyedia OAuth mengembalikan error (misal Client Secret salah di Supabase)
  if (errorParam || errorDescription) {
    const errorMsg = errorDescription || errorParam || 'Gagal autentikasi Google';
    return NextResponse.redirect(`${redirectBase}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone, is_approved, role')
          .eq('id', user.id)
          .maybeSingle();

        const isMaster =
          profile?.role === 'master' ||
          user.email?.toLowerCase() === 'madesanjaya255@gmail.com';

        // 1. Jika bukan master dan akun belum disetujui, langsung arahkan ke pending approval
        if (!isMaster && (profile?.is_approved === false || !profile)) {
          return NextResponse.redirect(`${redirectBase}/pending-approval`);
        }

        // 2. Jika sudah disetujui namun nomor telepon belum diisi, arahkan untuk lengkapi profil
        if (!profile?.phone || profile.phone.trim() === '') {
          return NextResponse.redirect(`${redirectBase}/complete-profile`);
        }
      }

      return NextResponse.redirect(`${redirectBase}${next}`);
    } else {
      return NextResponse.redirect(
        `${redirectBase}/login?error=${encodeURIComponent(error.message || 'Gagal tukar sesi autentikasi')}`
      );
    }
  }

  // Jika code tidak ditemukan
  return NextResponse.redirect(`${redirectBase}/login?error=Kode+autentikasi+tidak+ditemukan`);
}

