import { GraduationCap, Loader2 } from 'lucide-react';

export default function RekapHarianLoading() {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-5 md:p-6 space-y-5 animate-pulse">
      {/* 1. HEADER SKELETON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100 dark:border-slate-800">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="h-6 w-52 bg-gray-200 dark:bg-slate-800 rounded-lg" />
          </div>
          <div className="h-3.5 w-80 bg-gray-100 dark:bg-slate-800 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 bg-gray-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-9 w-28 bg-gray-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* 2. DATE NAVIGATION SKELETON */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-gray-200/90 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800" />
          <div className="h-9 w-44 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center gap-2 px-3">
            <Loader2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 animate-spin" />
            <span className="text-xs font-semibold text-gray-400">Memuat tanggal...</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800" />
        </div>
        <div className="h-5 w-40 bg-gray-100 dark:bg-slate-800 rounded" />
      </div>

      {/* 3. METRIC CARDS SKELETON */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200/90 dark:border-slate-800 shadow-2xs space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-gray-200 dark:bg-slate-800 rounded" />
              <div className="w-4 h-4 bg-gray-200 dark:bg-slate-800 rounded" />
            </div>
            <div className="h-8 w-14 bg-gray-300 dark:bg-slate-700 rounded-lg" />
            <div className="h-2.5 w-28 bg-gray-100 dark:bg-slate-800 rounded" />
          </div>
        ))}
      </div>

      {/* 4. TABS & SEARCH SKELETON */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-gray-200/90 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 bg-gray-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-8 w-20 bg-gray-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-8 w-24 bg-gray-200 dark:bg-slate-800 rounded-xl" />
        </div>
        <div className="h-8 w-full sm:w-64 bg-gray-100 dark:bg-slate-800 rounded-xl" />
      </div>

      {/* 5. LIST SKELETON */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-slate-800 shrink-0" />
              <div className="space-y-1.5">
                <div className="h-4 w-36 bg-gray-300 dark:bg-slate-700 rounded" />
                <div className="h-3 w-28 bg-gray-100 dark:bg-slate-800 rounded" />
              </div>
            </div>
            <div className="h-7 w-24 bg-gray-200 dark:bg-slate-800 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
