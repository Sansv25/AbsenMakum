'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessagesSquare,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export default function JoinGroupAttendancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorMsg('Token verifikasi tidak ditemukan di link QR Code.');
      return;
    }

    async function verifyToken() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const res = await fetch('/api/attendance/group/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (res.status === 401) {
          // Arahkan ke login dengan redirect_to kembali ke halaman ini
          router.push(`/login?redirect_to=${encodeURIComponent(`/absen/join?token=${token}`)}`);
          return;
        }

        if (!res.ok || !data.success) {
          setSuccess(false);
          setErrorMsg(data.message || data.error || 'Gagal memverifikasi kehadiran');
        } else {
          setSuccess(true);
          setMessage(data.message || 'Verifikasi kehadiran berhasil!');
        }
      } catch (err: unknown) {
        setSuccess(false);
        setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
      } finally {
        setLoading(false);
      }
    }

    verifyToken();
  }, [token, router]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl text-center transition-all animate-in zoom-in-95 duration-200">
        {loading && (
          <div className="space-y-4 py-8">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                Memverifikasi QR Code...
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Sedang menghubungkan ke sesi absen bersama rekan Anda.
              </p>
            </div>
          </div>
        )}

        {!loading && success && (
          <div className="space-y-5 py-4">
            <div className="h-20 w-20 mx-auto rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-md shadow-emerald-500/10">
              <CheckCircle2 className="h-10 w-10 animate-in zoom-in-50 duration-300" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                <Sparkles className="h-3.5 w-3.5" />
                Terverifikasi Hadir
              </div>
              <h1 className="text-xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
                Absen Bersama Berhasil!
              </h1>
              <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed px-2">
                {message}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 text-[11px] text-gray-500 dark:text-slate-400 flex items-center justify-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <span>Kehadiran Anda telah dicatat secara otomatis via Google Lens.</span>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/absen-chat"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md transition-all active:scale-98"
              >
                <MessagesSquare className="h-4 w-4" />
                Buka Feed Chat Absen
              </Link>
              <Link
                href="/"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 font-semibold text-xs transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" />
                Kembali ke Dashboard
              </Link>
            </div>
          </div>
        )}

        {!loading && errorMsg && (
          <div className="space-y-5 py-4">
            <div className="h-20 w-20 mx-auto rounded-3xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 flex items-center justify-center text-red-600 dark:text-red-400 shadow-md shadow-red-500/10">
              <AlertCircle className="h-10 w-10 animate-in zoom-in-50 duration-300" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                Verifikasi Gagal
              </h1>
              <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed px-2">
                {errorMsg}
              </p>
            </div>

            <div className="pt-4 flex flex-col gap-2">
              <Link
                href="/absen-chat"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-900 dark:bg-slate-100 text-white dark:text-gray-900 font-semibold text-xs transition-all active:scale-98"
              >
                <MessagesSquare className="h-4 w-4" />
                Ke Halaman Chat Absen
              </Link>
              <Link
                href="/"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 font-semibold text-xs transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" />
                Kembali ke Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
