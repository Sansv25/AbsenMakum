'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Crown,
  X,
  Loader2,
  Check,
} from 'lucide-react';
import { showAlert, showToast } from '@/lib/swal';
import { changeAttendanceOfficerAction } from '@/app/(app)/absen/[date]/[shift]/actions';

export interface OfficerOption {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface AttendanceOfficerCardProps {
  attendanceId: string;
  currentUserId?: string | null;
  authorName: string;
  hasFilledData: boolean;
  updatedAt?: string | null;
  jobStatus: 'lengkap' | 'sebagian' | 'kosong';
  isMaster: boolean;
  workDate: string;
  shiftType: string;
  availableOfficers: OfficerOption[];
}

export function AttendanceOfficerCard({
  attendanceId,
  currentUserId,
  authorName,
  hasFilledData,
  updatedAt,
  jobStatus,
  isMaster,
  workDate,
  shiftType,
  availableOfficers,
}: AttendanceOfficerCardProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUserId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSaveOfficer() {
    if (!selectedUserId) {
      showAlert('Pilih Petugas', 'Silakan pilih petugas piket dari daftar.', 'warning');
      return;
    }

    if (selectedUserId === currentUserId) {
      setIsModalOpen(false);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await changeAttendanceOfficerAction(
        attendanceId,
        selectedUserId,
        workDate,
        shiftType
      );

      if (!res.success) {
        showAlert('Gagal Mengubah Petugas', res.error || 'Terjadi kesalahan sistem.', 'error');
        return;
      }

      const targetOfficer = availableOfficers.find((o) => o.id === selectedUserId);
      const newName = targetOfficer ? targetOfficer.fullName : 'petugas terpilih';

      showToast(`Petugas piket berhasil dialihkan ke ${newName}!`, 'success');
      setIsModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses pergantian petugas.';
      showAlert('Gagal', msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* Kartu Petugas Pengisi Piket */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold flex-shrink-0">
            <User className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-400 tracking-wider">
              Petugas Pengisi Piket
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                {hasFilledData ? authorName : 'Belum Ada yang Mengisi'}
              </span>

              {/* Tombol Ubah Petugas khusus Akun Master */}
              {isMaster && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUserId(currentUserId || (availableOfficers[0]?.id ?? ''));
                    setIsModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors shadow-2xs min-h-[28px]"
                  title="Ubah petugas piket untuk shift ini (Khusus Akun Master)"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Ubah Petugas</span>
                </button>
              )}
            </div>

            {hasFilledData && updatedAt && (
              <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  Update: {new Intl.DateTimeFormat('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Makassar',
                  }).format(new Date(updatedAt))} WITA
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full capitalize flex items-center gap-1.5 ${
              jobStatus === 'lengkap'
                ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400 border border-green-200 dark:border-green-800'
                : jobStatus === 'sebagian'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800'
                : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400 border border-gray-200 dark:border-slate-700'
            }`}
          >
            {jobStatus === 'lengkap' && <CheckCircle2 className="h-3.5 w-3.5" />}
            {jobStatus === 'sebagian' && <AlertCircle className="h-3.5 w-3.5" />}
            Status: {jobStatus}
          </span>
        </div>
      </div>

      {/* Modal Dialog Ubah Petugas (Khusus Akun Master) */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => !isSubmitting && setIsModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 leading-tight">
                    Ubah Petugas Piket
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                    Khusus Akun Master &bull; Alihkan absensi ke akun lain
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Tutup modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-slate-800/60 p-3 rounded-xl border border-gray-100 dark:border-slate-700 text-xs text-gray-600 dark:text-slate-300">
                <p className="text-[11px] text-gray-400 dark:text-slate-400 uppercase font-semibold">
                  Petugas Terdaftar Saat Ini:
                </p>
                <p className="font-bold text-gray-900 dark:text-slate-100 text-sm mt-0.5">
                  {authorName}
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="new-officer-select"
                  className="block text-xs font-bold text-gray-700 dark:text-slate-300"
                >
                  Pilih Petugas Pengganti:
                </label>
                <select
                  id="new-officer-select"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-3 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                >
                  {availableOfficers.map((officer) => (
                    <option key={officer.id} value={officer.id}>
                      {officer.fullName} ({officer.email}) {officer.role === 'master' ? '👑 [Master]' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 dark:text-slate-500">
                  Data absensi, dokumen export PDF, dan riwayat akan otomatis diperbarui atas nama petugas yang Anda pilih.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200">
                <p>
                  <strong>Kunci Berbasis Akun:</strong> Petugas baru yang dialihkan akan otomatis memiliki hak akses edit absensi ini menggunakan akun mereka dari perangkat mana pun tanpa kendala.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors min-h-[40px]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveOfficer}
                disabled={isSubmitting || !selectedUserId}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors flex items-center gap-1.5 min-h-[40px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Simpan Perubahan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

