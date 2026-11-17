'use client';

import { useState } from 'react';
import { ExportForm } from './export-form';
import { ExportHarianSection } from './export-harian-section';
import { Clock, GraduationCap, FileDown } from 'lucide-react';
import type { DailyAttendanceRecapResult } from '@/lib/data/daily-attendance-recap';

interface ExportViewProps {
  defaultStartDate: string;
  defaultEndDate: string;
  todayDate: string;
  initialDailyRecap: DailyAttendanceRecapResult;
  isMaster: boolean;
  emailRecipientsCount: number;
}

export function ExportView({
  defaultStartDate,
  defaultEndDate,
  todayDate,
  initialDailyRecap,
  isMaster,
  emailRecipientsCount,
}: ExportViewProps) {
  const [activeTab, setActiveTab] = useState<'piket' | 'harian'>('piket');

  return (
    <div className="space-y-6">
      {/* 1. Header Informasi Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <FileDown className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Pusat Export &amp; Rekapitulasi Laporan
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">
            Unduh atau cetak laporan resmi: Pilih antara <strong>Rekapan Piket Shift</strong> atau <strong>Rekapan Absensi Harian Magang</strong>.
          </p>
        </div>
      </div>

      {/* 2. TAB SWITCHER (Jelas, Besar & Sangat Mudah Dibedakan) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 no-print">
        {/* Tab 1: Rekap Piket Shift */}
        <button
          type="button"
          onClick={() => setActiveTab('piket')}
          className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
            activeTab === 'piket'
              ? 'border-indigo-500 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-sm ring-2 ring-indigo-500/20'
              : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <div
            className={`p-2.5 rounded-xl flex-shrink-0 ${
              activeTab === 'piket'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
            }`}
          >
            <Clock className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-gray-900 dark:text-slate-100">
                1. Rekap Absen Piket
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                PDF Shift Pagi &amp; Malam
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-snug">
              Ekspor dokumen PDF dokumentasi shift lengkap dengan foto bukti kerja (mulai, selesai, tiket, aktivitas).
            </p>
          </div>
        </button>

        {/* Tab 2: Rekap Absen Harian Magang */}
        <button
          type="button"
          onClick={() => setActiveTab('harian')}
          className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
            activeTab === 'harian'
              ? 'border-emerald-500 dark:border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-sm ring-2 ring-emerald-500/20'
              : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <div
            className={`p-2.5 rounded-xl flex-shrink-0 ${
              activeTab === 'harian'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
            }`}
          >
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-gray-900 dark:text-slate-100">
                2. Rekap Absen Harian
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Khusus Anak Magang
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-snug">
              Cetak / unduh rekapitulasi kehadiran anak magang: rincian siapa yang hadir, jam absen, dan siapa yang tidak hadir.
            </p>
          </div>
        </button>
      </div>

      {/* 3. KONTEN TAB AKTIF */}
      <div>
        {activeTab === 'piket' ? (
          <div className="space-y-4">
            <ExportForm
              defaultStartDate={defaultStartDate}
              defaultEndDate={defaultEndDate}
            />
          </div>
        ) : (
          <ExportHarianSection
            initialDate={todayDate}
            initialRecap={initialDailyRecap}
            isMaster={isMaster}
            emailRecipientsCount={emailRecipientsCount}
          />
        )}
      </div>
    </div>
  );
}
