'use client';

import { useState } from 'react';
import { fetchExportData } from './actions';
import { generateAttendancePdf } from '@/lib/pdf';
import { FileDown, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface ExportFormProps {
  defaultStartDate: string;
  defaultEndDate: string;
}

export function ExportForm({ defaultStartDate, defaultEndDate }: ExportFormProps) {
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [filterMode, setFilterMode] = useState<'complete_only' | 'all_with_photos'>('complete_only');

  const [generating, setGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setProgressMsg('Mengambil data absensi...');
    setProgressPercent(10);
    setGenerating(true);

    try {
      const res = await fetchExportData(startDate, endDate, filterMode);

      if (res.error) {
        setError(res.error);
        setGenerating(false);
        return;
      }

      if (!res.data || res.data.length === 0) {
        setError('Tidak ada data absensi yang sesuai filter pada rentang tanggal tersebut.');
        setGenerating(false);
        return;
      }

      setProgressMsg('Memulai pembuatan dokumen PDF...');
      setProgressPercent(20);

      await generateAttendancePdf(
        res.data,
        startDate,
        endDate,
        (current, total, msg) => {
          const percent = 20 + Math.round((current / total) * 75);
          setProgressPercent(percent);
          setProgressMsg(msg);
        }
      );

      setProgressPercent(100);
      setProgressMsg('Dokumen PDF berhasil diunduh!');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat dokumen PDF.';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <form onSubmit={handleExport} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-100 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm">Rentang Tanggal</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="start_date" className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Dari Tanggal
            </label>
            <input
              id="start_date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              disabled={generating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor="end_date" className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Sampai Tanggal
            </label>
            <input
              id="end_date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              disabled={generating}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-slate-500">
          Maksimal rentang tanggal adalah 31 hari per ekspor demi kestabilan memori browser.
        </p>
      </div>

      <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-slate-800">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm">Kriteria Absensi</h2>
        <div className="space-y-2">
          <label
            className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
              filterMode === 'complete_only'
                ? 'border-blue-500 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/40'
                : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            <input
              type="radio"
              name="filter_mode"
              value="complete_only"
              checked={filterMode === 'complete_only'}
              onChange={() => setFilterMode('complete_only')}
              disabled={generating}
              className="mt-0.5 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Hanya shift yang lengkap</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Hanya menyertakan shift yang memiliki foto Mulai Kerja, Selesai Kerja, dan Aktivitas.
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
              filterMode === 'all_with_photos'
                ? 'border-blue-500 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/40'
                : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            <input
              type="radio"
              name="filter_mode"
              value="all_with_photos"
              checked={filterMode === 'all_with_photos'}
              onChange={() => setFilterMode('all_with_photos')}
              disabled={generating}
              className="mt-0.5 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Semua shift yang memiliki foto</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Menyertakan semua shift yang memiliki setidaknya satu foto (Mulai, Selesai, Aktivitas, atau Ticket).
              </p>
            </div>
          </label>
        </div>
      </div>

      {generating && (
        <div className="space-y-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300 font-medium">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
              {progressMsg}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>Dokumen PDF berhasil dibuat dan mulai diunduh otomatis.</span>
        </div>
      )}

      <button
        type="submit"
        disabled={generating}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl text-sm transition-colors min-h-[44px] flex items-center justify-center gap-2 shadow-sm"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sedang Membuat PDF...
          </>
        ) : (
          <>
            <FileDown className="h-5 w-5" />
            Export Dokumen PDF
          </>
        )}
      </button>
    </form>
  );
}
