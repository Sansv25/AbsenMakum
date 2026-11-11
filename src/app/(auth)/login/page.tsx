'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { login } from './actions';
import { createClient } from '@/lib/supabase/client';
import { GoogleIcon } from '@/components/ui/google-icon';
import { Loader2, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');

  const [error, setError] = useState<string | null>(errorParam || null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [needsOtpEmail, setNeedsOtpEmail] = useState<string | null>(null);

  useEffect(() => {
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [errorParam]);

  async function handleGoogleLogin() {
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
            prompt: 'consent',
          },
        },
      });
      if (oauthError) {
        setError(oauthError.message || 'Gagal login via Google.');
        setGoogleLoading(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      setError(message);
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNeedsOtpEmail(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await login(formData);

    if (result?.error) {
      setError(result.error);
      if (result.needsOtp && result.email) {
        setNeedsOtpEmail(result.email);
      }
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-100 shadow-sm mb-3 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/iconnet-colored.svg"
            alt="ICONNET"
            className="h-11 w-auto object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (!target.src.includes('logo.svg')) {
                target.src = '/images/logo.svg';
              }
            }}
          />
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-900">
          Absensi Piket
        </h1>
        <p className="text-center text-sky-700 text-xs font-semibold mt-0.5">
          ICONNET &bull; Macan Kumbang
        </p>
        <p className="text-center text-gray-500 text-xs mt-1">
          Masuk untuk melanjutkan
        </p>
      </div>

      {/* Login Google */}
      <div className="space-y-4 mb-6">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm rounded-xl border border-gray-300 shadow-xs transition-colors disabled:opacity-50 min-h-[44px]"
        >
          {googleLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
          ) : (
            <GoogleIcon className="h-5 w-5" />
          )}
          <span>Masuk dengan Google</span>
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-gray-200 w-full" />
          <span className="bg-white px-3 text-xs text-gray-400 font-medium absolute">
            atau masuk dengan email
          </span>
        </div>
      </div>

      {/* Form Email Login */}
      <form onSubmit={handleSubmit} className="space-y-4" suppressHydrationWarning>
        {error && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {needsOtpEmail && (
              <button
                type="button"
                onClick={() =>
                  router.push(`/verify-otp?email=${encodeURIComponent(needsOtpEmail)}`)
                }
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold transition-colors"
              >
                <span>Masukkan Kode OTP Sekarang</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              suppressHydrationWarning
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="email@contoh.com"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              suppressHydrationWarning
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          suppressHydrationWarning
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm rounded-xl transition-colors min-h-[44px] shadow-sm mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Memproses Masuk...</span>
            </>
          ) : (
            <span>Masuk</span>
          )}
        </button>
      </form>

      {/* Footer Registrasi */}
      <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col items-center gap-2">
        <p className="text-xs text-gray-500 text-center">
          Belum memiliki akun?{' '}
          <Link
            href="/register"
            className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            Daftar Akun Baru
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 py-10">
      <Suspense
        fallback={
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </main>
  );
}
