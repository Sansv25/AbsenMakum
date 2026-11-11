'use client';

import { useState } from 'react';
import { saveShiftSettingsAction, resetAllAttendanceDataAction } from './actions';
import type { ShiftSetting } from '@/lib/supabase/types';
import { Clock, Check, Loader2, AlertOctagon, Trash2 } from 'lucide-react';

interface SettingsFormProps {
  settings: ShiftSetting[];
  isMaster?: boolean;
}

export function SettingsForm({ settings, isMaster = false }: SettingsFormProps) {
  const pagi = settings.find((s) => s.shift_type === 'pagi');
  const malam = settings.find((s) => s.shift_type === 'malam');

  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResetData() {
    if (!confirm('PERINGATAN: Apakah Anda yakin ingin menghapus SELURUH data absensi, catatan, dan foto piket? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }
    if (!confirm('Konfirmasi terakhir: Seluruh foto di storage dan riwayat absensi akan dihapus bersih. Lanjutkan?')) {
      return;
    }

    try {
      setResetting(true);
      setError(null);
      const res = await resetAllAttendanceDataAction();
      if (res.error) {
        alert(`Gagal mereset data: ${res.error}\n\nJika ada pembatasan RLS, Anda juga dapat menjalankan script pembersihan di SQL Editor Supabase.`);
      } else {
        alert('Seluruh data absensi dan foto berhasil dibersihkan!');
        window.location.href = '/';
      }
    } catch {
      alert('Terjadi kesalahan saat mereset data.');
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
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-gray-900 font-semibold text-base">
          <Clock className="h-5 w-5 text-amber-500" />
          Shift 1 (Pagi)
        </div>
        <p className="text-xs text-gray-500">
          Berlaku pada akhir pekan (Sabtu/Minggu) dan tanggal merah.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pagi_start" className="block text-xs font-medium text-gray-700 mb-1">
              Jam Mulai
            </label>
            <input
              id="pagi_start"
              name="pagi_start"
              type="time"
              defaultValue={pagi?.start_time.slice(0, 5) ?? '06:00'}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor="pagi_end" className="block text-xs font-medium text-gray-700 mb-1">
              Jam Selesai
            </label>
            <input
              id="pagi_end"
              name="pagi_end"
              type="time"
              defaultValue={pagi?.end_time.slice(0, 5) ?? '14:00'}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
        </div>
      </div>

      {/* Shift Malam */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-gray-900 font-semibold text-base">
          <Clock className="h-5 w-5 text-indigo-500" />
          Shift 2 (Malam)
        </div>
        <p className="text-xs text-gray-500">
          Berlaku setiap hari (hari kerja biasa, akhir pekan, maupun tanggal merah).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="malam_start" className="block text-xs font-medium text-gray-700 mb-1">
              Jam Mulai
            </label>
            <input
              id="malam_start"
              name="malam_start"
              type="time"
              defaultValue={malam?.start_time.slice(0, 5) ?? '14:00'}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor="malam_end" className="block text-xs font-medium text-gray-700 mb-1">
              Jam Selesai
            </label>
            <input
              id="malam_end"
              name="malam_end"
              type="time"
              defaultValue={malam?.end_time.slice(0, 5) ?? '22:00'}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-xs bg-red-50 p-3 rounded-xl border border-red-200">
          {error}
        </p>
      )}

      {success && (
        <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 p-3 rounded-xl border border-green-200">
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

      {/* Zona Bahaya Khusus Master: Reset Data */}
      {isMaster && (
        <div className="pt-6 border-t border-gray-200">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-red-900 font-semibold text-sm">
              <AlertOctagon className="h-4 w-4 text-red-600" />
              Zona Khusus Master: Bersihkan Data Absensi
            </div>
            <p className="text-xs text-red-700">
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
