import { todayWITA, toYearMonth, getDatesInMonth } from '@/lib/dates';
import { ExportForm } from './export-form';

export default async function ExportPage() {
  const today = todayWITA();
  const currentMonth = toYearMonth(today);
  const dates = getDatesInMonth(currentMonth);
  const defaultStartDate = dates[0];
  const defaultEndDate = dates[dates.length - 1];

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Export Laporan PDF</h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          Unduh dokumen dokumentasi absensi dan foto piket dalam format PDF standar A4.
        </p>
      </div>

      <ExportForm
        defaultStartDate={defaultStartDate}
        defaultEndDate={defaultEndDate}
      />
    </div>
  );
}
