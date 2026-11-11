'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { GoogleIcon } from '@/components/ui/google-icon';
import { Loader2, User, Phone, Mail, Lock, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignUp() {
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
        setError(oauthError.message || 'Gagal menghubungkan ke Google.');
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

    // Validasi form
    if (!fullName.trim()) {
      setError('Nama Lengkap wajib diisi.');
      return;
    }
    if (!phone.trim()) {
      setError('Nomor Telepon wajib diisi.');
      return;
    }
    // Validasi nomor telepon sederhana
    const cleanedPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanedPhone.length < 9) {
      setError('Nomor Telepon tidak valid (minimal 9 digit).');
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

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: cleanedPhone,
          },
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already registered')) {
          setError('Email sudah terdaftar. Silakan login atau gunakan email lain.');
        } else {
          setError(signUpError.message || 'Gagal mendaftarkan akun.');
        }
        setLoading(false);
        return;
      }

      // Jika pendaftaran berhasil dan membutuhkan konfirmasi OTP
      if (data?.user) {
        router.push(`/verify-otp?email=${encodeURIComponent(cleanEmail)}`);
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
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 rounded-2xl bg-sky-50/80 border border-sky-100 shadow-sm mb-3 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/iconnet-colored.svg"
              alt="ICONNET"
              className="h-10 w-auto object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.includes('logo.svg')) {
                  target.src = '/images/logo.svg';
                }
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900">
            Daftar Akun Piket
          </h1>
          <p className="text-center text-sky-700 text-xs font-semibold mt-0.5">
            ICONNET &bull; Macan Kumbang
          </p>
          <p className="text-center text-gray-500 text-xs mt-1">
            Pilih metode registrasi di bawah ini
          </p>
        </div>

        {/* Tombol Google OAuth */}
        <div className="space-y-4 mb-6">
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm rounded-xl border border-gray-300 shadow-xs transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            ) : (
              <GoogleIcon className="h-5 w-5" />
            )}
            <span>Daftar dengan Google</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-gray-200 w-full" />
            <span className="bg-white px-3 text-xs text-gray-400 font-medium absolute">
              atau daftar manual dengan email
            </span>
          </div>
        </div>

        {/* Form Registrasi Manual */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="fullName"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Nomor Telepon / WhatsApp <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@contoh.com"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Konfirmasi Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm rounded-xl transition-colors min-h-[44px] shadow-sm mt-2"
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

        <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col items-center gap-2">
          <p className="text-xs text-gray-500">
            Sudah memiliki akun?{' '}
            <Link
              href="/login"
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

