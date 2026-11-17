'use client';

import { useState } from 'react';
import {
  saveShiftSettingsAction,
  resetAllAttendanceDataAction,
  cleanupOldChatAction,
  cleanupAllChatAction,
} from './actions';
import { showAlert, showConfirm } from '@/lib/swal';
import type { ShiftSetting } from '@/lib/supabase/types';
import {
  Clock,
  Check,
  Loader2,
  AlertOctagon,
  Trash2,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface SettingsFormProps {
  settings: ShiftSetting[];
  isMaster?: boolean;
  isOwner?: boolean;
}

export function SettingsForm({ settings, isOwner = false }: SettingsFormProps) {
  const pagi = settings.find((s) => s.shift_type === 'pagi');
  const malam = settings.find((s) => s.shift_type === 'malam');

  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [cleaningChat, setCleaningChat] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCleanupOldChat() {
    const confirmed = await showConfirm(
      'Bersihkan Obrolan > 168 Jam (7 Hari)?',
      'Pesan obrolan biasa (feed chat) yang usianya sudah lebih dari 168 jam (7 hari) beserta file lampiran medianya akan dibersihkan. Data kartu presensi harian anak magang tetap tersimpan aman.',
      'Ya, Bersihkan'
    );
    if (!confirmed) return;

    try {
      setCleaningChat(true);
      const res = await cleanupOldChatAction(168);
      if (res?.error) {
        showAlert('Gagal Membersihkan', res.error, 'error');
      } else {
        showAlert(
          'Pembersihan Selesai! ✨',
          `Berhasil membersihkan ${res.deletedCount ?? 0} pesan obrolan lama (> 168 jam).`,
          'success'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      showAlert('Error', msg, 'error');
    } finally {
      setCleaningChat(false);
    }
  }

  async function handleCleanupAllChat() {
    const confirmed = await showConfirm(
      'Bersihkan Seluruh Obrolan Chat?',
      'PERINGATAN: Tindakan ini akan menghapus SEMUA pesan obrolan teks biasa dan lampiran media obrolan di feed absen harian. Data kartu presensi resmi magang (absen masuk & bareng) TIDAK akan terhapus.',
      'Ya, Hapus Semua Obrolan',
      true
    );
    if (!confirmed) return;

    try {
      setCleaningChat(true);
      const res = await cleanupAllChatAction();
      if (res?.error) {
        showAlert('Gagal Membersihkan', res.error, 'error');
      } else {
        showAlert(
          'Pembersihan Selesai! ✨',
          `Berhasil membersihkan ${res.deletedCount ?? 0} pesan obrolan di feed absen harian.`,
          'success'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      showAlert('Error', msg, 'error');
    } finally {
      setCleaningChat(false);
    }
  }

  async function handleResetData() {
    const firstConfirm = await showConfirm(
      'Hapus Seluruh Data Absensi?',
      'PERINGATAN: Tindakan ini akan menghapus SELURUH data absensi, catatan, dan foto piket di storage. Tindakan ini tidak dapat dibatalkan.',
      'Ya, Lanjutkan',
      true
    );
    if (!firstConfirm) return;

    const secondConfirm = await showConfirm(
      'Konfirmasi Terakhir',
      'Seluruh foto di storage dan riwayat absensi akan dibersihkan secara total. Anda yakin?',
      'Ya, Bersihkan Semua',
      true
    );
    if (!secondConfirm) return;

    try {
      setResetting(true);
      setError(null);
      const res = await resetAllAttendanceDataAction();
      if (res.error) {
        showAlert(
          'Gagal Reset',
          `Gagal mereset data: ${res.error}\n\nJika ada batasan RLS, Anda dapat menjalankan script pembersihan di SQL Editor Supabase.`,
          'error'
        );
      } else {
        await showAlert('Berhasil', 'Seluruh data absensi dan foto berhasil dibersihkan!', 'success');
        window.location.href = '/';
      }
    } catch {
      showAlert('Error', 'Terjadi kesalahan saat mereset data.', 'error');
    } finally {
      setResetting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const res = await saveShiftSettingsAction(formData);

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Shift Pagi */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-2 text-gray-900 dark:text-slate-100 font-semibold text-base">
          <Clock className="h-5 w-5 text-amber-500" />
          Shift 1 (Pagi)
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Berlaku pada akhir pekan (Sabtu/Minggu) dan tanggal merah.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pagi_start" className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Jam Mulai
            </label>
            <input
              id="pagi_start"
              name="pagi_start"
              type="time"
              defaultValue={pagi?.start_time.slice(0, 5) ?? '06:00'}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor="pagi_end" className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Jam Selesai
            </label>
            <input
              id="pagi_end"
              name="pagi_end"
              type="time"
              defaultValue={pagi?.end_time.slice(0, 5) ?? '14:00'}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
        </div>
      </div>

      {/* Shift Malam */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-2 text-gray-900 dark:text-slate-100 font-semibold text-base">
          <Clock className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
          Shift 2 (Malam)
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Berlaku setiap hari (hari kerja biasa, akhir pekan, maupun tanggal merah).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="malam_start" className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Jam Mulai
            </label>
            <input
              id="malam_start"
              name="malam_start"
              type="time"
              defaultValue={malam?.start_time.slice(0, 5) ?? '14:00'}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor="malam_end" className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Jam Selesai
            </label>
            <input
              id="malam_end"
              name="malam_end"
              type="time"
              defaultValue={malam?.end_time.slice(0, 5) ?? '22:00'}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-900/60">
          {error}
        </p>
      )}

      {success && (
        <div className="flex items-center gap-2 text-green-700 dark:text-green-300 text-sm bg-green-50 dark:bg-green-950/40 p-3 rounded-xl border border-green-200 dark:border-green-800">
          <Check className="h-4 w-4" />
          Pengaturan jam shift berhasil disimpan.
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl text-sm transition-colors min-h-[44px] flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Menyimpan...
          </>
        ) : (
          'Simpan Pengaturan'
        )}
      </button>

      {/* Pembersihan Obrolan Chat Absen Harian */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-gray-900 dark:text-slate-100 font-semibold text-base">
            <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Pembersihan Chat Absen Harian
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Auto-cleanup 168 Jam (7 Hari)
          </span>
        </div>

        <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
          Pesan obrolan biasa (diskusi/chat) secara otomatis disaring dan dibersihkan jika telah berumur lebih dari <strong>168 jam (7 hari)</strong>. 
          Anda dapat memicu pembersihan obrolan secara manual menggunakan tombol di bawah.
        </p>

        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300">
          🛡️ <strong>Keamanan Data:</strong> Pembersihan ini <strong>HANYA</strong> menghapus pesan obrolan teks dan lampiran media obrolan. Kartu bukti presensi resmi (absen masuk &amp; absen bareng) <strong>TETAP TERSIMPAN AMAN</strong> untuk riwayat &amp; rekapan bulanan.
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleCleanupOldChat}
            disabled={cleaningChat}
            className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 min-h-[42px] shadow-xs"
          >
            {cleaningChat ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Membersihkan Obrolan...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>Bersihkan Chat &gt; 7 Hari (168 Jam)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCleanupAllChat}
            disabled={cleaningChat}
            className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 min-h-[42px]"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Bersihkan Semua Obrolan Sekarang</span>
          </button>
        </div>
      </div>

      {/* Zona Bahaya Khusus Owner: Reset Data */}
      {isOwner && (
        <div className="pt-6 border-t border-gray-200 dark:border-slate-800">
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-red-900 dark:text-red-200 font-semibold text-sm">
              <AlertOctagon className="h-4 w-4 text-red-600 dark:text-red-400" />
              Zona Khusus Owner: Bersihkan Data Absensi
            </div>
            <p className="text-xs text-red-700 dark:text-red-300">
              Menghapus seluruh riwayat absensi, tiket, catatan, dan foto di storage. Akun user dan pengaturan shift tidak akan terhapus.
            </p>
            <button
              type="button"
              onClick={handleResetData}
              disabled={resetting}
              className="py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shadow-sm min-h-[44px]"
            >
              {resetting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sedang membersihkan data...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Bersihkan Seluruh Data Absensi & Gambar
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
