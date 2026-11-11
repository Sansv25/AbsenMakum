import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

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
          .select('phone')
          .eq('id', user.id)
          .maybeSingle();

        // Jika nomor telepon belum ada, wajib arahkan ke halaman lengkapi profil
        if (!profile?.phone || profile.phone.trim() === '') {
          return NextResponse.redirect(`${origin}/complete-profile`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Jika gagal tukar kode atau ada error
  return NextResponse.redirect(`${origin}/login?error=Gagal+autentikasi+Google`);
}

