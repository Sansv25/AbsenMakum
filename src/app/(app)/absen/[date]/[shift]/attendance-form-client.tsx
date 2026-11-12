'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SingleUpload } from '@/components/upload/single-upload';
import { ActivityUpload } from '@/components/upload/activity-upload';
import { NoteAutosave } from '@/components/attendance/note-autosave';
import {
  CheckCircle2,
  Lock,
  Unlock,
  Crown,
  Calendar,
  Loader2,
  ShieldAlert,
  FileDown,
} from 'lucide-react';
import { isWithin48Hours } from '@/lib/dates';
import { showAlert, showConfirm, showToast } from '@/lib/swal';
import {
  unlockAttendanceAction,
  getSingleFormExportData,
} from '@/app/(app)/absen/[date]/[shift]/actions';
import { generateSingleFormPdf } from '@/lib/pdf';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import type { AttendanceDetail, AttachmentWithUrl } from '@/lib/data/attendance';
import type { ShiftType } from '@/lib/supabase/types';

interface AttendanceFormClientProps {
  attendance: AttendanceDetail;
  userId: string;
  userName?: string;
  workDate: string;
  shiftType: ShiftType;
  isMaster: boolean;
  today: string;
}

export function AttendanceFormClient({
  attendance,
  userId,
  userName,
  workDate,
  shiftType,
  isMaster,
  today,
}: AttendanceFormClientProps) {
  const router = useRouter();

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const [currentAttachments, setCurrentAttachments] = useState<AttachmentWithUrl[]>(attendance.attachments);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    setCurrentAttachments(attendance.attachments);
  }, [attendance.attachments]);

  const mulaiAttachment = currentAttachments.find((a) => a.kind === 'mulai') ?? null;
  const selesaiAttachment = currentAttachments.find((a) => a.kind === 'selesai') ?? null;

  // Evaluasi hak akses edit: Penguncian Berbasis Akun
  const isWithin48 = isWithin48Hours(workDate);
  const isFuture = workDate > today;
  const isLocked = !!attendance.is_locked;
  const isAuthor = !attendance.user_id || attendance.user_id === userId;
  const hasExistingData =
    attendance.attachments.length > 0 ||
    Boolean(attendance.note && attendance.note.trim().length > 0);

  let canEdit = true;
  let lockReason: 'locked' | 'expired' | 'future' | 'other_user' | null = null;

  if (!isMaster) {
    if (isFuture) {
      canEdit = false;
      lockReason = 'future';
    } else if (!isWithin48) {
      canEdit = false;
      lockReason = 'expired';
    } else if (isLocked) {
      canEdit = false;
      lockReason = 'locked';
    } else if (!isAuthor && hasExistingData) {
      canEdit = false;
      lockReason = 'other_user';
    }
  }

  function handleRefresh() {
    router.refresh();
  }

  function handleMulaiSaved(newAtt?: AttachmentWithUrl | null) {
    if (newAtt) {
      setCurrentAttachments((prev) => {
        const rest = prev.filter((a) => a.kind !== 'mulai');
        return [...rest, newAtt];
      });
    } else if (newAtt === null) {
      setCurrentAttachments((prev) => prev.filter((a) => a.kind !== 'mulai'));
    }
    handleRefresh();
  }

  function handleSelesaiSaved(newAtt?: AttachmentWithUrl | null) {
    if (newAtt) {
      setCurrentAttachments((prev) => {
        const rest = prev.filter((a) => a.kind !== 'selesai');
        return [...rest, newAtt];
      });
    } else if (newAtt === null) {
      setCurrentAttachments((prev) => prev.filter((a) => a.kind !== 'selesai'));
    }
    handleRefresh();
  }

  function handleAktivitasSaved(newItems?: AttachmentWithUrl[]) {
    if (newItems) {
      setCurrentAttachments((prev) => {
        const nonAktivitas = prev.filter((a) => a.kind !== 'aktivitas');
        return [...nonAktivitas, ...newItems];
      });
    }
    handleRefresh();
  }

  // Galeri foto terpadu seluruh form: Mulai -> Selesai -> Aktivitas #1, #2, dst.
  const unifiedSlides: { src: string; title: string }[] = [];

  if (mulaiAttachment?.signedUrl) {
    unifiedSlides.push({
      src: mulaiAttachment.signedUrl,
      title: '1. Bukti Piket — Mulai Kerja',
    });
  }

  if (selesaiAttachment?.signedUrl) {
    unifiedSlides.push({
      src: selesaiAttachment.signedUrl,
      title: '2. Bukti Piket — Selesai Kerja',
    });
  }

  const activityItems = currentAttachments
    .filter((a) => a.kind === 'aktivitas' && !!a.signedUrl)
    .sort((a, b) => a.sort_order - b.sort_order);

  activityItems.forEach((a, idx) => {
    unifiedSlides.push({
      src: a.signedUrl!,
      title: `3. Bukti Aktivitas Piket #${idx + 1}`,
    });
  });

  function handleOpenLightbox(url: string) {
    const idx = unifiedSlides.findIndex((s) => s.src === url);
    if (idx !== -1) {
      setLightboxIndex(idx);
    } else {
      setLightboxIndex(0);
    }
    setLightboxOpen(true);
  }

  async function handleUnlockAttendance() {
    const confirmed = await showConfirm(
      'Buka Kunci Absensi?',
      'Petugas piket yang bersangkutan akan dapat mengedit absensi ini kembali.',
      'Ya, Buka Kunci'
    );
    if (!confirmed) return;

    try {
      setIsProcessing(true);
      const res = await unlockAttendanceAction(attendance.id, workDate, shiftType);
      if (res && !res.success) {
        showAlert('Gagal', res.error || 'Terjadi kesalahan sistem.', 'error');
        return;
      }
      showToast('Kunci absensi berhasil dibuka!', 'success');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuka kunci.';
      showAlert('Gagal', msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleExportForm() {
    try {
      setIsExporting(true);
      setExportMsg('Mengambil data form...');
      const res = await getSingleFormExportData(attendance.id);
      if (res.error || !res.data) {
        showAlert('Tidak Dapat Export', res.error || 'Data absensi pada form ini belum ada.', 'info');
        return;
      }

      setExportMsg('Memproses foto...');
      await generateSingleFormPdf(res.data, (_cur, _tot, msg) => {
        setExportMsg(msg);
      });

      showToast('PDF Form Absensi berhasil diunduh!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat dokumen PDF.';
      showAlert('Gagal Export', msg, 'error');
    } finally {
      setIsExporting(false);
      setExportMsg(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Status / Banner Keamanan */}
      {isMaster && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950 dark:text-amber-200 text-xs shadow-sm">
          <div className="flex items-start gap-2.5">
            <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900 dark:text-amber-300 text-sm">Mode Akun Master (Akses Penuh)</p>
              <p className="text-amber-800 dark:text-amber-400 text-xs mt-0.5">
                Anda dapat mengedit absensi kapan pun tanpa batas waktu atau batasan akun.
              </p>
            </div>
          </div>

          {isLocked && (
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleUnlockAttendance}
                disabled={isProcessing}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm min-h-[36px]"
              >
                {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
                Buka Kunci
              </button>
            </div>
          )}
        </div>
      )}

      {!isMaster && !canEdit && (
        <>
          {lockReason === 'other_user' && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 flex items-start gap-3 text-amber-900 dark:text-amber-300 text-xs shadow-sm">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-300 text-sm">Absensi Diisi Oleh Petugas Lain</p>
                <p className="text-amber-800 dark:text-amber-400 mt-0.5">
                  Absensi shift ini sudah diisi oleh rekan petugas Anda. Penguncian berbasis akun aktif — hanya akun petugas pengisi atau Akun Master yang dapat mengedit absensi ini.
                </p>
              </div>
            </div>
          )}

          {lockReason === 'locked' && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-2xl p-4 flex items-start gap-3 text-red-800 dark:text-red-300 text-xs shadow-sm">
              <Lock className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900 dark:text-red-200 text-sm">Absensi Selesai & Terkunci</p>
                <p className="text-red-700 dark:text-red-300 mt-0.5">
                  Absensi shift ini telah difinalisasi dan dikunci. Perubahan tidak dapat dilakukan oleh akun user biasa. Hubungi Akun Master jika membutuhkan koreksi.
                </p>
              </div>
            </div>
          )}

          {lockReason === 'expired' && (
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl p-4 flex items-start gap-3 text-blue-900 dark:text-blue-300 text-xs shadow-sm">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-blue-900 dark:text-blue-200 text-sm">Batas Waktu Pengisian Berakhir (48 Jam)</p>
                <p className="text-blue-800 dark:text-blue-300 mt-0.5">
                  Absensi shift ini telah melewati batas toleransi pengisian (48 jam) dan otomatis terkunci dalam mode <em>baca (read-only)</em>. Hubungi Akun Master jika membutuhkan koreksi data.
                </p>
              </div>
            </div>
          )}

          {lockReason === 'future' && (
            <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 flex items-start gap-3 text-gray-700 dark:text-slate-300 text-xs shadow-sm">
              <Calendar className="h-5 w-5 text-gray-500 dark:text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-gray-900 dark:text-slate-100 text-sm">Absensi Belum Dimulai</p>
                <p className="text-gray-600 dark:text-slate-400 mt-0.5">
                  Tanggal shift ini berada di masa depan. Pengisian absensi baru dapat dilakukan pada saat hari piket tiba.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* 2. Bukti Piket 1: Mulai Kerja */}
      <SingleUpload
        key={`${attendance.id}-mulai`}
        title="1. Bukti Piket — Mulai Kerja"
        kind="mulai"
        attendanceId={attendance.id}
        userId={userId}
        userName={userName}
        workDate={workDate}
        shiftType={shiftType}
        initialAttachment={mulaiAttachment}
        onSaved={handleMulaiSaved}
        canEdit={canEdit}
        onOpenLightbox={handleOpenLightbox}
      />

      {/* 3. Bukti Piket 2: Selesai Kerja */}
      <SingleUpload
        key={`${attendance.id}-selesai`}
        title="2. Bukti Piket — Selesai Kerja"
        kind="selesai"
        attendanceId={attendance.id}
        userId={userId}
        userName={userName}
        workDate={workDate}
        shiftType={shiftType}
        initialAttachment={selesaiAttachment}
        onSaved={handleSelesaiSaved}
        canEdit={canEdit}
        onOpenLightbox={handleOpenLightbox}
      />

      {/* 4. Bukti Aktivitas Piket (Minimal 2 Gambar) */}
      <ActivityUpload
        key={`${attendance.id}-aktivitas`}
        attendanceId={attendance.id}
        userId={userId}
        userName={userName}
        workDate={workDate}
        shiftType={shiftType}
        initialAttachments={currentAttachments}
        onSaved={handleAktivitasSaved}
        canEdit={canEdit}
        onOpenLightbox={handleOpenLightbox}
      />

      {/* 5. Catatan Piket */}
      <NoteAutosave
        key={`${attendance.id}-note`}
        attendanceId={attendance.id}
        initialNote={attendance.note}
        canEdit={canEdit}
      />

      {/* 6. Export Laporan Form Ini (PDF) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-colors">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <FileDown className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-slate-100">
              Export PDF Form Ini
            </h4>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Download dokumen laporan PDF khusus bukti piket &amp; aktivitas pada shift dan pekerjaan ini.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportForm}
          disabled={isExporting}
          className="w-full sm:w-auto px-4 py-2.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2 min-h-[44px]"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
              <span>{exportMsg || 'Membuat PDF...'}</span>
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              <span>Download PDF Form Ini</span>
            </>
          )}
        </button>
      </div>

      {/* 7. Aksi Bawah & Tombol Selesai */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
          <span>Semua foto dan catatan <strong>tersimpan otomatis</strong>.</span>
        </div>

        <Link
          href="/"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors min-h-[44px]"
        >
          Selesai & Kembali ke Dashboard
        </Link>
      </div>

      {/* 8. Lightbox Terpadu Seluruh Form Absensi: Mulai -> Selesai -> Aktivitas */}
      <ImageLightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={unifiedSlides}
        index={lightboxIndex}
      />
    </div>
  );
}
