'use client';

import Link from 'next/link';
import { Plus, RefreshCw, Bot, ShieldCheck, Zap } from 'lucide-react';

interface TicketControlSwitchesProps {
  autoQueueEnabled: boolean;
  onToggleAutoQueue: () => void;
  aiEnabled: boolean;
  onToggleAi: () => void;
  monitoringEnabled: boolean;
  onToggleMonitoring: () => void;
  syncing: boolean;
  onSync: () => void;
}

export function TicketControlSwitches({
  autoQueueEnabled,
  onToggleAutoQueue,
  aiEnabled,
  onToggleAi,
  monitoringEnabled,
  onToggleMonitoring,
  syncing,
  onSync,
}: TicketControlSwitchesProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Zap className="h-4 w-4 text-sky-500" />
            Pusat Kontrol Otomasi Tiket
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Atur otomasi pengiriman antrean, respon kecerdasan buatan (AI), dan verifikasi jawaban.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition border border-gray-200 dark:border-slate-700 min-h-[38px]"
            title="Sinkronkan obrolan Instagram untuk memeriksa apakah nomor tiket sudah diberikan CS"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin text-blue-500' : 'text-gray-500'}`} />
            <span>{syncing ? 'Sinkronisasi...' : 'Sinkronkan Chat'}</span>
          </button>

          <Link
            href="/ticketing/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs min-h-[38px]"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Tiket Baru</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-gray-100 dark:border-slate-800/80">
        {/* Switch 1: Auto-Queue Dispatcher */}
        <label
          className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
            autoQueueEnabled
              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
              : 'bg-gray-50/70 dark:bg-slate-800/40 border-gray-200 dark:border-slate-700/60 opacity-80'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <span
              className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                autoQueueEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            <div className="min-w-0">
              <span className="text-xs font-bold text-gray-900 dark:text-slate-100 block truncate">
                Antrean Otomatis
              </span>
              <span className="text-[11px] text-gray-500 dark:text-slate-400 block truncate">
                {autoQueueEnabled ? 'Tiket berikutnya diproses otomatis' : 'Dijeda sementara'}
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoQueueEnabled}
            onChange={onToggleAutoQueue}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </label>

        {/* Switch 2: AI Auto-Responder */}
        <label
          className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
            aiEnabled
              ? 'bg-purple-50/60 dark:bg-purple-950/20 border-purple-300 dark:border-purple-800/60'
              : 'bg-gray-50/70 dark:bg-slate-800/40 border-gray-200 dark:border-slate-700/60 opacity-80'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <Bot
              className={`h-4 w-4 flex-shrink-0 ${
                aiEnabled ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'
              }`}
            />
            <div className="min-w-0">
              <span className="text-xs font-bold text-gray-900 dark:text-slate-100 block truncate">
                AI Auto-Responder
              </span>
              <span className="text-[11px] text-gray-500 dark:text-slate-400 block truncate">
                {aiEnabled ? 'AI aktif membalas CS' : 'AI dimatikan (manual)'}
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={aiEnabled}
            onChange={onToggleAi}
            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
          />
        </label>

        {/* Switch 3: Mode Monitoring (Approval) */}
        <label
          className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
            monitoringEnabled
              ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60'
              : 'bg-gray-50/70 dark:bg-slate-800/40 border-gray-200 dark:border-slate-700/60 opacity-80'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <ShieldCheck
              className={`h-4 w-4 flex-shrink-0 ${
                monitoringEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'
              }`}
            />
            <div className="min-w-0">
              <span className="text-xs font-bold text-gray-900 dark:text-slate-100 block truncate">
                Mode Monitoring
              </span>
              <span className="text-[11px] text-gray-500 dark:text-slate-400 block truncate">
                {monitoringEnabled ? 'Wajib approval sebelum kirim' : 'Kirim langsung tanpa jeda'}
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={monitoringEnabled}
            onChange={onToggleMonitoring}
            className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
}
