import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSafeRedirectPath } from '@/lib/url';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const publicPaths = [
    '/login',
    '/register',
    '/verify-otp',
    '/auth/callback',
    '/pending-approval',
    '/auth/approve',
    '/privacy',
    '/terms',
    '/api/cron',
  ];
  const isPublicPage =
    publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith('/api/cron');

  // Jika belum login dan mengakses halaman yang dilindungi
  if (!user && !isPublicPage) {
    const originalTarget = pathname + (request.nextUrl.search || '');
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    if (pathname !== '/') {
      url.searchParams.set('redirect_to', originalTarget);
    }
    return NextResponse.redirect(url);
  }

  // Jika sudah login dan mencoba mengakses halaman login/register
  if (user && (pathname === '/login' || pathname === '/register')) {
    const redirectTo = getSafeRedirectPath(request.nextUrl.searchParams.get('redirect_to'), '/');
    const targetUrl = new URL(redirectTo, request.url);
    const url = request.nextUrl.clone();
    url.pathname = targetUrl.pathname;
    url.search = targetUrl.search;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
