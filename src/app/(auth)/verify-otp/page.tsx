'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Loader2, MailCheck, AlertCircle, ArrowLeft, RotateCw } from 'lucide-react';

function VerifyOtpContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const typeParam = searchParams.get('type') || '';

  const [email, setEmail] = useState(emailParam);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [realtimeListening, setRealtimeListening] = useState(false);
  const [approvedViaRealtime, setApprovedViaRealtime] = useState(false);

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

  async function executeVerify(rawToken?: string) {
    setError(null);
    setInfoMessage(null);

    const cleanToken = (rawToken || token).trim();
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
      
      // Tentukan prioritas tipe verifikasi berdasarkan alur (signup vs login 2FA)
      const primaryType = typeParam === 'signup' ? 'signup' : 'email';
      const secondaryType = primaryType === 'email' ? 'signup' : 'email';

      let { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: cleanToken,
        type: primaryType as 'email' | 'signup',
      });

      // Jika gagal dengan tipe utama, coba fallback
      if (verifyError) {
        const fallbackRes = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: cleanToken,
          type: secondaryType as 'email' | 'signup',
        });
        if (!fallbackRes.error) {
          verifyError = null;
          data = fallbackRes.data;
        } else {
          // Fallback ketiga: coba tipe magiclink jika keduanya gagal
          const magicRes = await supabase.auth.verifyOtp({
            email: email.trim().toLowerCase(),
            token: cleanToken,
            type: 'magiclink',
          });
          if (!magicRes.error) {
            verifyError = null;
            data = magicRes.data;
          } else {
            verifyError = fallbackRes.error;
          }
        }
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
        setApprovedViaRealtime(false);
        return;
      }

      // Verifikasi berhasil! Sesi aktif
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
          return;
        }

        if (!isMaster && profile?.is_approved === false) {
          window.location.href = '/pending-approval';
          return;
        }
      }

      window.location.href = '/';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      setError(message);
      setLoading(false);
      setApprovedViaRealtime(false);
    }
  }

  async function handleVerify(e?: React.FormEvent) {
    if (e) e.preventDefault();
    await executeVerify(token);
  }

  // Supabase Realtime: Dengarkan sinyal persetujuan instan jika link di email dibuka di perangkat lain (PC/Laptop)
  useEffect(() => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    const supabase = createClient();
    const channelName = `login-sync-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '-')}`;

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    channel
      .on('broadcast', { event: 'approved' }, async (payload) => {
        const incomingToken = payload.payload?.token;
        if (incomingToken) {
          setApprovedViaRealtime(true);
          setToken(incomingToken);
          setInfoMessage('Persetujuan login diterima dari email! Memproses masuk ke dashboard...');
          await executeVerify(incomingToken);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeListening(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [email, typeParam]);

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
      const cleanEmail = email.trim().toLowerCase();

      let resendError = null;
      if (typeParam === 'signup') {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: cleanEmail,
        });
        resendError = error;
        if (error) {
          const fallbackRes = await supabase.auth.signInWithOtp({
            email: cleanEmail,
            options: { shouldCreateUser: false },
          });
          resendError = fallbackRes.error;
        }
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: { shouldCreateUser: false },
        });
        resendError = error;
        if (error) {
          const fallbackRes = await supabase.auth.resend({
            type: 'signup',
            email: cleanEmail,
          });
          resendError = fallbackRes.error;
        }
      }

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
    <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-md p-6 sm:p-8">
      {/* Icon & Title */}
      <div className="flex flex-col items-center mb-6">
        <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 shadow-xs mb-3 text-sky-600 dark:text-sky-400 flex items-center justify-center">
          <MailCheck className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-slate-100">
          {typeParam === 'email' ? 'Verifikasi Masuk (2FA)' : 'Verifikasi Email OTP'}
        </h1>
        <p className="text-center text-gray-500 dark:text-slate-400 text-xs mt-1.5 max-w-xs text-balance">
          {typeParam === 'email'
            ? 'Untuk keamanan akun di perangkat ini, masukkan kode OTP 6-digit yang dikirim ke email:'
            : 'Masukkan kode OTP yang telah dikirim ke alamat email:'}
        </p>
        <span className="text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800 mt-2">
          {email || 'email@anda.com'}
        </span>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl p-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {infoMessage && (
        <div className="mb-4 text-emerald-700 dark:text-emerald-400 text-xs bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3">
          {infoMessage}
        </div>
      )}

      {/* Realtime Live Indicator */}
      {realtimeListening && (
        <div className="mb-5 flex items-center justify-center gap-2 py-2 px-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 rounded-xl text-xs text-sky-700 dark:text-sky-300">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
          </span>
          <span className="text-[11px] font-medium leading-tight text-center">
            {approvedViaRealtime
              ? 'Persetujuan terdeteksi! Memverifikasi sesi Anda...'
              : 'Realtime Aktif: Anda dapat ketik OTP di bawah atau klik link di email Anda.'}
          </span>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-5">
        <div>
          <label
            htmlFor="otp"
            className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2 text-center"
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
            className="w-full text-center text-xl sm:text-2xl font-mono tracking-[0.3em] sm:tracking-[0.5em] py-3.5 px-4 border-2 border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading || token.length < 6}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold text-sm rounded-xl transition-colors min-h-[44px] shadow-sm"
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
      <div className="mt-6 pt-5 border-t border-gray-100 dark:border-slate-800 flex flex-col items-center gap-3">
        <p className="text-xs text-gray-500 dark:text-slate-400 text-center">
          Belum menerima kode OTP di inbox atau folder spam?
        </p>
        <button
          type="button"
          onClick={handleResendOtp}
          disabled={cooldown > 0 || resending}
          className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:text-gray-400 dark:disabled:text-slate-600 transition-colors"
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

        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400 mt-2">
          {typeParam === 'email' ? (
            <Link
              href="/login"
              className="flex items-center gap-1 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Kembali ke Halaman Login</span>
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Ganti Email</span>
              </Link>
              <span>•</span>
              <Link
                href="/login"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
              >
                Sudah Verifikasi? Masuk di sini
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-slate-950 py-10 transition-colors">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-md p-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        }
      >
        <VerifyOtpContent />
      </Suspense>
    </main>
  );
}

