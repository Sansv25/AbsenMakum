import type { ShiftType, JobType } from './supabase/types';

export type { ShiftType, JobType };

export const JOB_TYPES: JobType[] = ['marketer', 'qontak', 'tiket'];

export const JOB_LABELS: Record<JobType, string> = {
  marketer: 'Marketer',
  qontak: 'Qontak',
  tiket: 'Tiket',
};

export function jobLabel(job: JobType): string {
  return JOB_LABELS[job] ?? job;
}

/**
 * Satu-satunya fungsi yang menentukan shift wajib per tanggal.
 * Hari kerja (Sen–Jum, bukan libur): hanya malam.
 * Sabtu, Minggu, atau tanggal merah: pagi + malam.
 */
export function getRequiredShifts(dateStr: string, holidays: Set<string>): ShiftType[] {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Min, 6=Sab
  const isOff = dow === 0 || dow === 6 || holidays.has(dateStr);
  return isOff ? ['pagi', 'malam'] : ['malam'];
}

export function shiftLabel(shift: ShiftType): string {
  return shift === 'pagi' ? 'Shift 1 (Pagi)' : 'Shift 2 (Malam)';
}

export function shiftNumber(shift: ShiftType): number {
  return shift === 'pagi' ? 1 : 2;
}
