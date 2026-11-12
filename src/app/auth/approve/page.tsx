'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, Smartphone, Laptop, Loader2, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';

function ApproveContent() {
  const searchParams = useSearchParams();
  const email = (searchParams.get('email') || '').trim();
  const token = (searchParams.get('token') || '').trim();

  const [status, setStatus] = useState<'idle' | 'approving' | 'approved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [loggingInHere, setLoggingInHere] = useState(false);
  const hasTriggered = useRef(false);

  // Fungsi untuk mengirim sinyal broadcast Realtime ke perangkat utama (HP)
  async function triggerApproval() {
    if (!email || !token) {
      setStatus('error');
      setErrorMessage('Parameter email atau token verifikasi tidak valid.');
      return;
    }

    setStatus('approving');
    try {
      const supabase = createClient();
      const cleanEmail = email.toLowerCase();
      const channelName = `login-sync-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '-')}`;

      const channel = supabase.channel(channelName, {
        config: {
          broadcast: { ack: true },
        },
      });

      channel.subscribe(async (subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          // Kirim sinyal broadcast Realtime ke HP
          await channel.send({
            type: 'broadcast',
            event: 'approved',
            payload: { token },
          });

          // Tunggu sebentar untuk memastikan pesan terkirim di jaringan
          setTimeout(() => {
            setStatus('approved');
          }, 600);
        }
      });
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Terjadi kendala saat mengirim persetujuan realtime.'
      );
    }
  }

  // Hitung mundur otomatis untuk persetujuan cepat (3 detik)
  useEffect(() => {
    if (!email || !token) return;
    if (status !== 'idle') return;

    if (countdown <= 0) {
      if (!hasTriggered.current) {
        hasTriggered.current = true;
        triggerApproval();
      }
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, status, email, token]);

  // Handler jika user ingin login di perangkat ini (PC/Browser ini) juga
  async function handleLoginThisDevice() {
    if (!email || !token) return;
    setLoggingInHere(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.toLowerCase(),
        token,
        type: 'email',
      });

      if (error) {
        // Jika token sudah terpakai oleh HP
        window.location.href = `/login?email=${encodeURIComponent(email)}`;
        return;
      }

      if (data?.user) {
        window.location.href = '/';
      }
    } catch {
      window.location.href = '/login';
    }
  }

  // Tampilan jika link tidak memiliki parameter valid
  if (!email || !token) {
    return (
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-md p-6 sm:p-8 text-center">
        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 mx-auto w-fit text-red-600 dark:text-red-400 mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          Tautan Persetujuan Tidak Lengkap
        </h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed mb-6">
          Tautan ini tidak memuat parameter akun atau token persetujuan yang sah. Silakan gunakan kode OTP secara manual di aplikasi Anda.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
        >
          <span>Kembali ke Halaman Login</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-md p-6 sm:p-8">
      {/* Header ICONNET */}
      <div className="flex flex-col items-center mb-6">
        <div className="p-3 rounded-2xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 shadow-xs mb-3 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/iconnet-colored.svg"
            alt="ICONNET"
            className="h-9 w-auto object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (!target.src.includes('logo.svg')) {
                target.src = '/images/logo.svg';
              }
            }}
          />
        </div>
        <h1 className="text-xl font-bold text-center text-gray-900 dark:text-slate-100">
          Persetujuan Login Perangkat
        </h1>
        <p className="text-center text-sky-700 dark:text-sky-400 text-xs font-semibold mt-0.5">
          ICONNET &bull; Macan Kumbang
        </p>
      </div>

      {/* Ilustrasi Perangkat */}
      <div className="flex items-center justify-center gap-3 py-4 px-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl mb-6">
        <div className="flex flex-col items-center gap-1 text-slate-600 dark:text-slate-400">
          <Laptop className="h-6 w-6 text-sky-600 dark:text-sky-400" />
          <span className="text-[10px] font-semibold">Perangkat Ini</span>
        </div>
        <div className="flex items-center gap-1 text-sky-500 font-mono text-xs px-2">
          <span>&bull;&bull;&bull;</span>
          <ArrowRight className="h-4 w-4 animate-pulse text-sky-600" />
        </div>
        <div className="flex flex-col items-center gap-1 text-slate-600 dark:text-slate-400">
          <Smartphone className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[10px] font-semibold">HP Anda</span>
        </div>
      </div>

      {/* Info Permintaan */}
      <div className="space-y-3 mb-6">
        <div className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-800">
          <p className="text-[11px] text-gray-500 dark:text-slate-400">Akun Petugas:</p>
          <p className="text-xs font-semibold text-gray-900 dark:text-slate-100 truncate mt-0.5">
            {email}
          </p>
        </div>

        <div className="flex items-center justify-between p-3 bg-sky-50/60 dark:bg-sky-950/30 rounded-xl border border-sky-100 dark:border-sky-900/50">
          <span className="text-[11px] text-sky-700 dark:text-sky-300 font-medium">Kode Verifikasi OTP:</span>
          <span className="font-mono text-base font-bold text-sky-800 dark:text-sky-200 tracking-wider">
            {token}
          </span>
        </div>
      </div>

      {/* Status Persetujuan */}
      {status === 'approved' ? (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
              Login Berhasil Disetujui!
            </h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 leading-relaxed">
              Sinyal persetujuan telah dikirim secara realtime ke perangkat Anda (HP). Perangkat tersebut sekarang telah otomatis masuk ke dashboard.
            </p>
          </div>

          <p className="text-center text-[11px] text-gray-400 dark:text-slate-500">
            Anda dapat menutup tab browser ini dengan aman.
          </p>

          <button
            type="button"
            onClick={handleLoginThisDevice}
            disabled={loggingInHere}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-gray-300 dark:border-slate-700 transition-colors disabled:opacity-50 min-h-[40px]"
          >
            {loggingInHere ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
            )}
            <span>Masuk ke Dashboard di Perangkat Ini Juga</span>
          </button>
        </div>
      ) : status === 'approving' ? (
        <div className="py-6 flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
            Mengirim persetujuan realtime ke perangkat Anda...
          </p>
        </div>
      ) : status === 'error' ? (
        <div className="space-y-4">
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-red-600 dark:text-red-400 text-xs text-center">
            {errorMessage || 'Gagal mengirimkan persetujuan.'}
          </div>
          <button
            type="button"
            onClick={triggerApproval}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
          >
            Coba Kirim Ulang Persetujuan
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={triggerApproval}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors min-h-[44px] shadow-sm"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Setujui Login Sekarang</span>
          </button>

          <p className="text-center text-[11px] text-gray-400 dark:text-slate-500">
            Menyetujui otomatis dalam <span className="font-bold text-sky-600">{countdown}</span> detik...
          </p>
        </div>
      )}
    </div>
  );
}

export default function ApprovePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-slate-950 py-10 transition-colors">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-md p-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        }
      >
        <ApproveContent />
      </Suspense>
    </main>
  );
}

