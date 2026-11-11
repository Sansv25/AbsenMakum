import { Loader2 } from 'lucide-react';

export default function AppLoading() {
  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-6 w-48 bg-gray-200 rounded-lg" />
        <div className="h-4 w-72 bg-gray-100 rounded-lg" />
      </div>

      {/* Main card skeleton */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 bg-gray-200 rounded-lg" />
          <div className="h-5 w-20 bg-gray-100 rounded-full" />
        </div>
        <div className="h-28 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span>Memuat data...</span>
          </div>
        </div>
      </div>

      {/* Secondary cards skeleton */}
      <div className="space-y-3">
        <div className="h-20 bg-white rounded-2xl border border-gray-100 shadow-sm" />
        <div className="h-20 bg-white rounded-2xl border border-gray-100 shadow-sm" />
      </div>
    </div>
  );
}

