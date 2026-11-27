'use client';

import { ExportForm } from './export-form';
import { FileDown } from 'lucide-react';

interface ExportViewProps {
  defaultStartDate: string;
  defaultEndDate: string;
}

export function ExportView({
  defaultStartDate,
  defaultEndDate,
}: ExportViewProps) {
  return (
    <div className="space-y-6">
      {/* Header Informasi Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <FileDown className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Export Rekapan Piket
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">
            Unduh atau cetak laporan resmi dokumentasi presensi piket shift dalam format PDF.
          </p>
        </div>
      </div>

      {/* Form Export PDF Piket */}
      <div className="space-y-4">
        <ExportForm
          defaultStartDate={defaultStartDate}
          defaultEndDate={defaultEndDate}
        />
      </div>
    </div>
  );
}
