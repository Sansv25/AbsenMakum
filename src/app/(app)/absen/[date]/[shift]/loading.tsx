import { Loader2 } from 'lucide-react';

export default function AbsenLoading() {
  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top back & title skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-20 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-7 w-48 bg-gray-200 dark:bg-slate-800 rounded-lg animate-pulse" />
        <div className="h-4 w-56 bg-gray-100 dark:bg-slate-800/60 rounded animate-pulse" />
      </div>

      {/* Upload card 1 skeleton */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Memuat form...</span>
          </div>
        </div>
        <div className="h-44 bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 rounded-xl flex items-center justify-center animate-pulse" />
      </div>

      {/* Upload card 2 skeleton */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm space-y-3">
        <div className="h-5 w-32 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-44 bg-gray-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

