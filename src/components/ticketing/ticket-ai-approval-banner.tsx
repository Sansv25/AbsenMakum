'use client';

import { Bell, Check, X, Loader2, Edit2 } from 'lucide-react';

interface PendingDraft {
  ticket_id: string;
  customer_name: string;
  reply_text: string;
  incoming_text: string;
  created_at: string;
  runner_label?: string | null;
}

interface TicketAiApprovalBannerProps {
  draft: PendingDraft | null;
  editedText: string;
  onTextChange: (text: string) => void;
  onApprove: () => void;
  onReject: () => void;
  processing: boolean;
}

export function TicketAiApprovalBanner({
  draft,
  editedText,
  onTextChange,
  onApprove,
  onReject,
  processing,
}: TicketAiApprovalBannerProps) {
  if (!draft) return null;

  return (
    <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border-2 border-amber-300 dark:border-amber-800/80 rounded-2xl shadow-sm space-y-3.5 transition-all animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 dark:border-amber-800/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
            <Bell className="h-5 w-5 animate-bounce" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
              Draf Balasan AI Menunggu Persetujuan Anda
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-400">
              Tiket Pelanggan: <strong className="font-semibold">{draft.customer_name}</strong>
              {draft.runner_label && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                  🤖 {draft.runner_label}
                </span>
              )}
            </p>
          </div>
        </div>
        <span className="self-start sm:self-auto text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
          Perlu Approval Admin
        </span>
      </div>

      <div className="space-y-3 bg-white/90 dark:bg-slate-900/90 p-4 rounded-xl border border-amber-200 dark:border-slate-800 shadow-2xs">
        <div>
          <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            Pertanyaan / Pesan Masuk dari CS ICONNET:
          </span>
          <div className="text-xs font-medium text-gray-800 dark:text-slate-200 bg-gray-50 dark:bg-slate-800/80 p-2.5 rounded-lg border border-gray-200 dark:border-slate-700 italic">
            &ldquo;{draft.incoming_text}&rdquo;
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
              <Edit2 className="h-3 w-3 text-amber-600" />
              Draf Jawaban AI (Bisa diedit sebelum dikirim):
            </span>
            <span className="text-[10px] text-gray-400 dark:text-slate-500">
              Pastikan data sudah akurat
            </span>
          </div>
          <textarea
            value={editedText}
            onChange={(e) => onTextChange(e.target.value)}
            rows={3}
            className="w-full p-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 transition leading-relaxed"
            placeholder="Tulis atau koreksi draf balasan untuk Instagram..."
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
        <button
          type="button"
          onClick={onReject}
          disabled={processing}
          className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
        >
          <X className="h-3.5 w-3.5" />
          <span>Tolak Draf</span>
        </button>

        <button
          type="button"
          onClick={onApprove}
          disabled={processing || !editedText.trim()}
          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
        >
          {processing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Memproses...</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Setujui &amp; Kirim ke Instagram</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
