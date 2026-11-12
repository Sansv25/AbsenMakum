'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Loader2, MailCheck, AlertCircle, ArrowLeft, RotateCw } from 'lucide-react';

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailParam);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Sync email from search params
  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleVerify(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const cleanToken = token.trim();
    if (!email.trim()) {
      setError('Email wajib diisi.');
      return;
    }
    if (cleanToken.length < 6) {
      setError('Masukkan kode OTP verifikasi (6 atau 8 digit).');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      
      // Coba verifikasi dengan type 'signup' terlebih dahulu
      let { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: cleanToken,
        type: 'signup',
      });

      // Jika gagal dengan 'signup', coba fallback dengan 'email'
      if (verifyError) {
        const fallbackRes = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: cleanToken,
          type: 'email',
        });
        verifyError = fallbackRes.error;
      }

      if (verifyError) {
        const lowerErr = verifyError.message.toLowerCase();
        if (lowerErr.includes('expired') || lowerErr.includes('invalid')) {
          setError(
            'Kode OTP salah atau telah kadaluarsa. Pastikan memasukkan seluruh digit kode (6 atau 8 digit) dari email TERAKHIR yang masuk.'
          );
        } else {
          setError(verifyError.message || 'Verifikasi OTP gagal.');
        }
        setLoading(false);
        return;
      }

      // Verifikasi berhasil! Sesi aktif, arahkan ke dashboard
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      setError(message);
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (cooldown > 0 || resending) return;
    setError(null);
    setInfoMessage(null);

    if (!email.trim()) {
      setError('Email wajib diisi untuk mengirim ulang OTP.');
      return;
    }

    setResending(true);

    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });

      if (resendError) {
        if (
          resendError.message.includes('504') ||
          resendError.message.toLowerCase().includes('timeout') ||
          resendError.message.toLowerCase().includes('deadline exceeded')
        ) {
          setError(
            'Layanan pengiriman email sedang sibuk atau timeout (HTTP 504). Silakan coba kirim ulang dalam beberapa saat.'
          );
        } else {
          setError(resendError.message || 'Gagal mengirim ulang OTP.');
        }
      } else {
        setInfoMessage('Kode OTP baru telah berhasil dikirim ke email Anda. Kode sebelumnya otomatis hangus/tidak berlaku lagi.');
        setCooldown(60); // Reset timer 60 detik
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.';
      setError(message);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 sm:p-8">
      {/* Icon & Title */}
      <div className="flex flex-col items-center mb-6">
        <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 shadow-xs mb-3 text-sky-600 flex items-center justify-center">
          <MailCheck className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-900">
          Verifikasi Email OTP
        </h1>
        <p className="text-center text-gray-500 text-xs mt-1.5 max-w-xs">
          Masukkan kode OTP yang telah dikirim ke alamat email:
        </p>
        <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 mt-2">
          {email || 'email@anda.com'}
        </span>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {infoMessage && (
        <div className="mb-4 text-emerald-700 text-xs bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          {infoMessage}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-5">
        <div>
          <label
            htmlFor="otp"
            className="block text-xs font-semibold text-gray-700 mb-2 text-center"
          >
            Kode Verifikasi OTP (6 atau 8 Digit)
          </label>
          <input
            ref={inputRef}
            id="otp"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={token}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
              setToken(val);
              // Otomatis submit jika 8 digit
              if (val.length === 8) {
                setTimeout(() => {
                  handleVerify();
                }, 100);
              }
            }}
            placeholder="••••••••"
            className="w-full text-center text-xl sm:text-2xl font-mono tracking-[0.3em] sm:tracking-[0.5em] py-3.5 px-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading || token.length < 6}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold text-sm rounded-xl transition-colors min-h-[44px] shadow-sm"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Memverifikasi OTP...</span>
            </>
          ) : (
            <span>Verifikasi & Masuk</span>
          )}
        </button>
      </form>

      {/* Kirim Ulang OTP */}
      <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col items-center gap-3">
        <p className="text-xs text-gray-500 text-center">
          Belum menerima kode OTP di inbox atau folder spam?
        </p>
        <button
          type="button"
          onClick={handleResendOtp}
          disabled={cooldown > 0 || resending}
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:text-gray-400 transition-colors"
        >
          {resending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCw className="h-3.5 w-3.5" />
          )}
          {cooldown > 0 ? (
            <span>Kirim ulang dalam {cooldown} detik</span>
          ) : (
            <span>Kirim Ulang Kode OTP</span>
          )}
        </button>

        <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
          <Link
            href="/register"
            className="flex items-center gap-1 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Ganti Email</span>
          </Link>
          <span>•</span>
          <Link
            href="/login"
            className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            Sudah Verifikasi? Masuk di sini
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 py-10">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        }
      >
        <VerifyOtpContent />
      </Suspense>
    </main>
  );
}

