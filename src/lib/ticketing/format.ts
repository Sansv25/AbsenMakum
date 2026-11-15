import { TicketStatus, TicketMode } from './types';

export function getStatusLabel(status: TicketStatus): string {
  switch (status) {
    case 'queued':
      return 'Antrean';
    case 'in_conversation':
      return 'Sedang Berjalan';
    case 'needs_admin':
      return 'Butuh Admin';
    case 'ticket_issued':
      return 'Tiket Terbit';
    case 'closed':
      return 'Selesai';
    case 'failed':
      return 'Gagal';
    default:
      return status;
  }
}

export function getStatusBadgeClass(status: TicketStatus): string {
  switch (status) {
    case 'queued':
      return 'bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800';
    case 'in_conversation':
      return 'bg-blue-50 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800 animate-pulse';
    case 'needs_admin':
      return 'bg-rose-50 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800';
    case 'ticket_issued':
      return 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
    case 'closed':
      return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    case 'failed':
      return 'bg-red-50 dark:bg-red-950/70 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function getModeLabel(mode: TicketMode): string {
  return mode === 'ai' ? 'AI Otomatis' : 'Manual';
}

export function formatDateWITA(isoString?: string | null): string {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date) + ' WITA';
  } catch {
    return isoString;
  }
}

export function formatTimeWITA(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
}
