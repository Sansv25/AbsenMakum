'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

function ApproveContent() {
  const searchParams = useSearchParams();
  const email = (searchParams.get('email') || '').trim();
  const token = (searchParams.get('token') || '').trim();

  const [status, setStatus] = useState<'approving' | 'approved' | 'error'>('approving');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasTriggered = useRef(false);

  // Fungsi untuk mengirim sinyal broadcast Realtime ke perangkat utama (HP)
  async function triggerApproval() {
    if (!email || !token) {
      setStatus('error');
      setErrorMessage('Parameter email atau token verifikasi tidak valid.');
      return;
    }

    try {
      const supabase = createClient();
      const cleanEmail = email.toLowerCase();
      const channelName = `login-sync-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '-')}`;

      const channel = supabase.channel(channelName, {
        config: {
          broadcast: { ack: false },
        },
      });

      channel.subscribe(async (subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          const sendPayload = async () => {
            try {
              await channel.send({
                type: 'broadcast',
                event: 'approved',
                payload: { token },
              });
            } catch {
              // Abaikan error individual retry
            }
          };

          // Kirim sinyal berulang beberapa kali untuk menjamin sampai ke HP meski ada latensi jaringan
          await sendPayload();
          setTimeout(sendPayload, 300);
          setTimeout(sendPayload, 700);
          setTimeout(sendPayload, 1200);
          setTimeout(sendPayload, 2000);

          setStatus('approved');
        }
      });
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Terjadi kendala saat mengirim persetujuan realtime.'
      );
    }
  }

  // Langsung picu persetujuan otomatis begitu halaman dibuka
  useEffect(() => {
    if (!email || !token) {
      setStatus('error');
      setErrorMessage('Tautan tidak lengkap.');
      return;
    }

    if (!hasTriggered.current) {
      hasTriggered.current = true;
      triggerApproval();
    }
  }, [email, token]);

  // Tampilan jika parameter tidak lengkap
  if (!email || !token) {
    return (
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-md p-6 sm:p-8 text-center">
        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 mx-auto w-fit text-red-600 dark:text-red-400 mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          Tautan Tidak Lengkap
        </h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed mb-6">
          Tautan persetujuan ini tidak memuat parameter akun atau token yang sah.
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
            className="h-14 w-auto object-contain"
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
          ICONNET
        </p>
      </div>

      {/* Info Akun Petugas */}
      <div className="mb-6 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-800">
        <p className="text-[11px] text-gray-500 dark:text-slate-400">Akun Petugas:</p>
        <p className="text-xs font-semibold text-gray-900 dark:text-slate-100 truncate mt-0.5">
          {email}
        </p>
      </div>

      {/* Konten Status */}
      {status === 'approved' ? (
        <div className="space-y-4">
          <div className="p-5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-2.5" />
            <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
              Login Berhasil Disetujui!
            </h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1.5 leading-relaxed">
              Sinyal persetujuan telah dikirim secara realtime ke perangkat Anda (HP). Perangkat tersebut sekarang telah otomatis masuk ke dashboard.
            </p>
          </div>

          <p className="text-center text-xs text-gray-400 dark:text-slate-500 pt-2">
            Anda dapat menutup tab browser ini dengan aman.
          </p>
        </div>
      ) : status === 'approving' ? (
        <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">
            Menyetujui login ke perangkat Anda...
          </p>
        </div>
      ) : (
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
