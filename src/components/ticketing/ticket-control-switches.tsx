'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Bot, ShieldCheck, Zap, Lock } from 'lucide-react';

interface TicketControlSwitchesProps {
  autoQueueEnabled: boolean;
  onToggleAutoQueue: () => void;
  aiEnabled: boolean;
  onToggleAi: () => void;
  monitoringEnabled: boolean;
  onToggleMonitoring: () => void;
  syncing: boolean;
  onSync: () => void;
  isOwner?: boolean;
  onCreateTicket?: () => void;
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
  isOwner = false,
  onCreateTicket,
}: TicketControlSwitchesProps) {
  const [botStatus, setBotStatus] = useState<{
    online: boolean;
    user_email?: string | null;
    seconds_ago?: number;
  } | null>(null);

  useEffect(() => {
    const checkBot = () => {
      fetch('/api/ticketing/bot-status')
        .then((r) => r.json())
        .then((d) => setBotStatus(d))
        .catch(() => {});
    };
    checkBot();
    const interval = setInterval(checkBot, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Zap className="h-4 w-4 text-sky-500" />
              Pusat Kontrol Otomasi Tiket
            </h2>
            {botStatus?.online ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                title={`Bot sedang online di laptop petugas (${botStatus.user_email || 'Aktif'})`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Bot Piket Online ({botStatus.user_email?.split('@')[0] || 'Aktif'})
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700"
                title="Bot runner belum aktif di laptop petugas piket"
              >
                <span className="h-2 w-2 rounded-full bg-gray-400" />
                Bot Piket Offline
              </span>
            )}
            {!isOwner && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80">
                <Lock className="w-2.5 h-2.5" /> Mode Lihat (Khusus Owner)
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {isOwner
              ? 'Atur otomasi pengiriman antrean, respon kecerdasan buatan (AI), dan verifikasi jawaban.'
              : 'Status otomasi pengiriman antrean, respon kecerdasan buatan (AI), dan verifikasi jawaban (hanya Owner yang dapat mengubah).'}
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

          {onCreateTicket ? (
            <button
              type="button"
              onClick={onCreateTicket}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs min-h-[38px] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Buat Tiket Baru</span>
            </button>
          ) : (
            <Link
              href="/ticketing?create=true"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs min-h-[38px]"
            >
              <Plus className="h-4 w-4" />
              <span>Buat Tiket Baru</span>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-gray-100 dark:border-slate-800/80">
        {/* Switch 1: Auto-Queue Dispatcher */}
        {isOwner ? (
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
        ) : (
          <div
            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-default select-none ${
              autoQueueEnabled
                ? 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/40'
                : 'bg-gray-50/50 dark:bg-slate-800/30 border-gray-200 dark:border-slate-700/50'
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
            {autoQueueEnabled ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/80 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ON
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300/80 dark:border-slate-700 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                OFF
              </span>
            )}
          </div>
        )}

        {/* Switch 2: AI Auto-Responder */}
        {isOwner ? (
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
        ) : (
          <div
            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-default select-none ${
              aiEnabled
                ? 'bg-purple-50/40 dark:bg-purple-950/10 border-purple-200 dark:border-purple-900/40'
                : 'bg-gray-50/50 dark:bg-slate-800/30 border-gray-200 dark:border-slate-700/50'
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
            {aiEnabled ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300/80 dark:border-purple-800/80 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
                ON
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300/80 dark:border-slate-700 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                OFF
              </span>
            )}
          </div>
        )}

        {/* Switch 3: Mode Monitoring (Approval) */}
        {isOwner ? (
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
        ) : (
          <div
            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-default select-none ${
              monitoringEnabled
                ? 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/40'
                : 'bg-gray-50/50 dark:bg-slate-800/30 border-gray-200 dark:border-slate-700/50'
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
            {monitoringEnabled ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/80 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                ON
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300/80 dark:border-slate-700 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                OFF
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
