'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { createClient } from '@/lib/supabase/client';
import { GoogleIcon } from '@/components/ui/google-icon';
import { Loader2, User, Mail, Lock, AlertCircle, ArrowRight, Eye, EyeOff, GraduationCap, Clock, Ticket } from 'lucide-react';
import { normalizeIndonesianPhone, isValidIndonesianPhone, extractLocalPhoneDigits } from '@/lib/phone';

export default function RegisterPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'magang' | 'piket' | 'tiket'>('magang');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gisReady, setGisReady] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const rawNonceRef = useRef<string | null>(null);

  const handleGoogleSignUp = useCallback(async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (oauthError) {
        setError(oauthError.message || 'Gagal menghubungkan ke Google.');
        setGoogleLoading(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      setError(message);
      setGoogleLoading(false);
    }
  }, []);

  const handleGoogleCredentialResponse = useCallback(
    async (response: { credential?: string }) => {
      if (!response?.credential) return;
      setError(null);
      setGoogleLoading(true);

      try {
        const supabase = createClient();
        const { data, error: idTokenErr } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.credential,
          nonce: rawNonceRef.current || undefined,
        });

        if (idTokenErr) {
          console.warn('signInWithIdToken failed, falling back to signInWithOAuth:', idTokenErr.message);
          // Fallback otomatis ke OAuth jika One Tap / idToken gagal
          await handleGoogleSignUp();
          return;
        }

        if (data?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone, is_approved, role')
            .eq('id', data.user.id)
            .maybeSingle();

          const isMaster =
            profile?.role === 'master' ||
            data.user.email?.toLowerCase() === 'madesanjaya255@gmail.com';

          if (!profile?.phone || profile.phone.trim() === '') {
            window.location.href = '/complete-profile';
          } else if (!isMaster && (profile?.is_approved === false || !profile)) {
            window.location.href = '/pending-approval';
          } else {
            window.location.href = '/';
          }
        }
      } catch (err: unknown) {
        console.warn('Error in handleGoogleCredentialResponse, fallback to OAuth:', err);
        await handleGoogleSignUp();
      }
    },
    [handleGoogleSignUp]
  );

  const initGoogle = useCallback(async () => {
    if (typeof window === 'undefined' || !window.google?.accounts?.id) return;
    const clientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      '265734214863-3qgdbt7hu9jqh41bg5raoq7vrf5nibvq.apps.googleusercontent.com';

    let hashedNonce: string | undefined;
    try {
      if (window.crypto?.subtle) {
        const array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        const rawNonce = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
        rawNonceRef.current = rawNonce;

        const encoder = new TextEncoder();
        const encodedNonce = encoder.encode(rawNonce);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', encodedNonce);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        hashedNonce = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {
      console.warn('Could not generate crypto nonce:', e);
    }

    const initOptions: Record<string, unknown> = {
      client_id: clientId,
      callback: handleGoogleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    };

    if (hashedNonce) {
      initOptions.nonce = hashedNonce;
    }

    window.google.accounts.id.initialize(
      initOptions as unknown as Parameters<typeof window.google.accounts.id.initialize>[0]
    );

    if (googleBtnRef.current) {
      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signup_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 320,
      });
    }
    setGisReady(true);
  }, [handleGoogleCredentialResponse]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      initGoogle();
    }
  }, [initGoogle]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Validasi form
    if (!fullName.trim()) {
      setError('Nama wajib diisi.');
      return;
    }
    const normalizedPhone = normalizeIndonesianPhone(phone);
    if (!phone.trim() || !isValidIndonesianPhone(normalizedPhone)) {
      setError('Nomor Telepon / WhatsApp tidak valid. Masukkan nomor HP aktif (contoh: 81234567890).');
      return;
    }
    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const cleanEmail = email.trim().toLowerCase();

      // 1. Cek apakah email sudah terdaftar sebelumnya di database
      const { data: alreadyRegistered } = await supabase.rpc('check_email_registered', {
        check_email: cleanEmail,
      });

      if (alreadyRegistered) {
        setError('Email ini sudah terdaftar. Silakan masuk (login) atau gunakan email lain.');
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            name: fullName.trim(),
            phone: normalizedPhone,
            selected_role: selectedRole,
            requested_role: selectedRole,
          },
        },
      });

      if (signUpError) {
        const lowerErr = signUpError.message.toLowerCase();
        if (lowerErr.includes('already registered') || lowerErr.includes('user already exists')) {
          setError('Email ini sudah terdaftar. Silakan masuk (login) atau gunakan email lain.');
        } else if (
          lowerErr.includes('504') ||
          lowerErr.includes('timeout') ||
          lowerErr.includes('deadline exceeded')
        ) {
          setError(
            'Layanan pengiriman email sedang sibuk atau timeout (HTTP 504). Silakan coba lagi beberapa saat atau pasang Custom SMTP di Supabase.'
          );
        } else if (lowerErr.includes('error sending confirmation email')) {
          setError(
            'Gagal mengirim email OTP: Kredensial SMTP di Supabase ditolak (Authentication failed). Pastikan Username dan SMTP Key Brevo sudah sesuai.'
          );
        } else {
          setError(signUpError.message || 'Gagal mendaftarkan akun.');
        }
        setLoading(false);
        return;
      }

      // Deteksi proteksi enumerasi Supabase (user sudah ada mengembalikan identities kosong)
      if (data?.user?.identities && data.user.identities.length === 0) {
        setError('Email ini sudah terdaftar. Silakan masuk (login) atau gunakan email lain.');
        setLoading(false);
        return;
      }

      // Jika pendaftaran berhasil dan membutuhkan konfirmasi OTP
      if (data?.user) {
        router.push(`/verify-otp?email=${encodeURIComponent(cleanEmail)}&type=signup`);
      } else {
        router.push('/login');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.';
      setError(message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-slate-950 py-10 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-md p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 rounded-2xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 shadow-sm mb-3 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/iconnet-colored.svg"
              alt="ICONNET"
              className="h-14 w-auto object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.includes('logo.svg')) {
                  target.src = '/images/logo.svg';
                }
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-slate-100">
            Daftar Akun Petugas &amp; Magang ICONNET
          </h1>
          <p className="text-center text-sky-700 dark:text-sky-400 text-xs font-semibold mt-0.5">
            ICONNET
          </p>
          <p className="text-center text-gray-500 dark:text-slate-400 text-xs mt-1">
            Pilih peran akun dan lengkapi data pendaftaran di bawah ini
          </p>
        </div>

        {/* Script Google Identity Services */}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={initGoogle}
        />

        {/* Tombol Google OAuth */}
        <div className="space-y-4 mb-6">
          <div className="w-full flex justify-center items-center min-h-[44px]">
            <div
              ref={googleBtnRef}
              className={gisReady ? 'w-full flex justify-center overflow-hidden rounded-xl' : 'hidden'}
            />
            {!gisReady && (
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium text-sm rounded-xl border border-gray-300 dark:border-slate-700 shadow-xs transition-colors disabled:opacity-50 min-h-[44px]"
              >
                {googleLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-500 dark:text-slate-400" />
                ) : (
                  <GoogleIcon className="h-5 w-5" />
                )}
                <span>Daftar dengan Google</span>
              </button>
            )}
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-gray-200 dark:border-slate-800 w-full" />
            <span className="bg-white dark:bg-slate-900 px-3 text-xs text-gray-400 dark:text-slate-500 font-medium absolute">
              atau daftar manual dengan email
            </span>
          </div>
        </div>

        {/* Form Registrasi Manual */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pilihan Peran Akun */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              Pilih Peran / Posisi Akun <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedRole('magang')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  selectedRole === 'magang'
                    ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                    : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-gray-600 dark:text-slate-400 hover:border-gray-300'
                }`}
              >
                <GraduationCap className={`h-4 w-4 mb-1 ${selectedRole === 'magang' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`} />
                <span className="text-xs font-bold leading-tight">Anak Magang</span>
                <span className="text-[10px] opacity-75 mt-0.5 leading-tight">Presensi Harian</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('piket')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  selectedRole === 'piket'
                    ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 ring-2 ring-indigo-500/30'
                    : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-gray-600 dark:text-slate-400 hover:border-gray-300'
                }`}
              >
                <Clock className={`h-4 w-4 mb-1 ${selectedRole === 'piket' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                <span className="text-xs font-bold leading-tight">Petugas Piket</span>
                <span className="text-[10px] opacity-75 mt-0.5 leading-tight">Shift &amp; Piket</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('tiket')}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                  selectedRole === 'tiket'
                    ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/30'
                    : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-gray-600 dark:text-slate-400 hover:border-gray-300'
                }`}
              >
                <Ticket className={`h-4 w-4 mb-1 ${selectedRole === 'tiket' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} />
                <span className="text-xs font-bold leading-tight">Layanan Tiket</span>
                <span className="text-[10px] opacity-75 mt-0.5 leading-tight">Tiket &amp; Helpdesk</span>
              </button>
            </div>
          </div>
          {error && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl p-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
              {error.includes('sudah terdaftar') && (
                <Link
                  href="/login"
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs font-semibold transition-colors"
                >
                  <span>Masuk ke Halaman Login</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="fullName"
              className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1"
            >
              Nama <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1"
            >
              Nomor Telepon / WhatsApp <span className="text-red-500">*</span>
            </label>
            <div className="relative flex rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 bg-gray-50 dark:bg-slate-800/80 border-r border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-slate-300 select-none">
                <span className="text-sm">🇮🇩</span>
                <span>+62</span>
              </div>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => {
                  const cleaned = extractLocalPhoneDigits(e.target.value);
                  setPhone(cleaned);
                }}
                placeholder="812-3456-7890"
                className="w-full px-3 py-2.5 bg-transparent text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 text-sm focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>Format tersimpan: <strong>+62 {phone || '8xx-xxxx-xxxx'}</strong></span>
              <span className="text-[10px] text-gray-400">Cukup ketik mulai 8... (atau 08...)</span>
            </p>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1"
            >
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@contoh.com"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1"
            >
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full pl-10 pr-11 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors"
                title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1"
            >
              Konfirmasi Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password"
                className="w-full pl-10 pr-11 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors"
                title={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-900 text-white font-semibold text-sm rounded-xl transition-colors min-h-[44px] shadow-sm mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Mendaftarkan & Mengirim OTP...</span>
              </>
            ) : (
              <span>Daftar & Kirim Kode OTP</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-slate-800 flex flex-col items-center gap-2">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Sudah memiliki akun?{' '}
            <Link
              href="/login"
              className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
            >
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

