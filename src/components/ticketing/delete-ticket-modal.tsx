'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { broadcastTicketChange } from '@/lib/ticketing/realtime';
import type { Ticket } from '@/lib/ticketing/types';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteTicketModalProps {
  isOpen: boolean;
  ticket: Ticket | null;
  onClose: () => void;
  onSuccess: (deletedId: string) => void;
}

export function DeleteTicketModal({
  isOpen,
  ticket,
  onClose,
  onSuccess,
}: DeleteTicketModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !ticket) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/ticketing/${ticket.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghapus tiket.');
      }

      const supabase = createClient();
      await broadcastTicketChange(supabase, 'delete', { ticketId: ticket.id });

      onSuccess(ticket.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat menghapus.';
      setErrorMsg(msg);
    } finally {
      setDeleting(false);
    }
  };

  const isQueued = ticket.status === 'queued';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-5">
        <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
          <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60">
            <Trash2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {isQueued ? 'Hapus Tiket dari Antrean?' : 'Hapus Tiket Ini?'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tindakan ini tidak dapat dibatalkan
            </p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Pelanggan:</span>
            <strong className="text-slate-900 dark:text-slate-100 font-bold">{ticket.name}</strong>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">ID Pelanggan:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">{ticket.customer_id}</span>
          </div>
          {ticket.ticket_number && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Nomor Tiket:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {ticket.ticket_number}
              </span>
            </div>
          )}
        </div>

        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span>
            {isQueued
              ? 'Tiket ini akan dihapus dari daftar antrean sehingga bot tidak akan mengirimkannya ke Instagram CS.'
              : 'Seluruh riwayat chat DM dan bukti foto tiket ini akan dihapus secara permanen.'}
          </span>
        </div>

        {errorMsg && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Menghapus...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>{isQueued ? 'Hapus dari Antrean' : 'Ya, Hapus Tiket'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
