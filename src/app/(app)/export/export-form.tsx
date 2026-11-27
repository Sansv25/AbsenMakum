'use client';

import { useState } from 'react';
import { fetchExportData } from './actions';
import type { PdfAttendanceItem } from '@/lib/pdf';
import { NotaTableModal } from '@/components/export/nota-table-modal';
import { FileDown, Loader2, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface ExportFormProps {
  defaultStartDate: string;
  defaultEndDate: string;
}

export function ExportForm({ defaultStartDate, defaultEndDate }: ExportFormProps) {
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [filterMode, setFilterMode] = useState<'complete_only' | 'all_with_photos'>('complete_only');

  const [fetchingData, setFetchingData] = useState(false);
  const [fetchedItems, setFetchedItems] = useState<PdfAttendanceItem[]>([]);
  const [notaModalOpen, setNotaModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setFetchingData(true);

    try {
      const res = await fetchExportData(startDate, endDate, filterMode);

      if (res.error) {
        setError(res.error);
        return;
      }

      if (!res.data || res.data.length === 0) {
        setError('Tidak ada data absensi yang sesuai filter pada rentang tanggal tersebut.');
        return;
      }

      setFetchedItems(res.data);
      setNotaModalOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengambil data absensi.';
      setError(msg);
    } finally {
      setFetchingData(false);
    }
  }

  return (
    <>
      <form onSubmit={handleExport} className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-gray-100 dark:border-slate-800 shadow-sm space-y-5 transition-colors">
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
        <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex-shrink-0">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm sm:text-base">
              Export PDF Dokumentasi Piket
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Shift Pagi &amp; Malam
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Unduh laporan foto bukti piket shift (mulai, selesai, tiket &amp; aktivitas) standar kertas A4.
          </p>
        </div>
      </div>
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
              disabled={fetchingData}
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
              disabled={fetchingData}
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
              disabled={fetchingData}
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
              disabled={fetchingData}
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

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-300 text-xs">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>Dokumen PDF Nota &amp; Dokumentasi berhasil dibuat dan mulai diunduh otomatis.</span>
        </div>
      )}

      <button
        type="submit"
        disabled={fetchingData}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl text-sm transition-colors min-h-[44px] flex items-center justify-center gap-2 shadow-sm cursor-pointer"
      >
        {fetchingData ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Mengambil Data Absensi...
          </>
        ) : (
          <>
            <FileDown className="h-5 w-5" />
            Atur Tabel Nota &amp; Export PDF
          </>
        )}
      </button>
    </form>

    <NotaTableModal
      isOpen={notaModalOpen}
      attendances={fetchedItems}
      startDate={startDate}
      endDate={endDate}
      onClose={() => setNotaModalOpen(false)}
      onSuccess={() => {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 6000);
      }}
    />
    </>
  );
}
