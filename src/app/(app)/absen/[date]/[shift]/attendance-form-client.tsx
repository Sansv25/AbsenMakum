'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SingleUpload } from '@/components/upload/single-upload';
import { TicketUpload } from '@/components/upload/ticket-upload';
import { NoteAutosave } from '@/components/attendance/note-autosave';
import {
  CheckCircle2,
  Lock,
  Unlock,
  Crown,
  Smartphone,
  Calendar,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { getOrCreateDeviceId, getDeviceLabel } from '@/lib/device';
import {
  claimDeviceAction,
  lockAttendanceAction,
  unlockAttendanceAction,
  resetDeviceAction,
} from '@/app/(app)/absen/[date]/[shift]/actions';
import type { AttendanceDetail } from '@/lib/data/attendance';
import type { ShiftType } from '@/lib/supabase/types';

interface AttendanceFormClientProps {
  attendance: AttendanceDetail;
  userId: string;
  workDate: string;
  shiftType: ShiftType;
  isMaster: boolean;
  today: string;
}

export function AttendanceFormClient({
  attendance,
  userId,
  workDate,
  shiftType,
  isMaster,
  today,
}: AttendanceFormClientProps) {
  const router = useRouter();

  const [clientDeviceId, setClientDeviceId] = useState<string>('');
  const [clientDeviceLabel, setClientDeviceLabel] = useState<string>('');
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const mulaiAttachment = attendance.attachments.find((a) => a.kind === 'mulai') ?? null;
  const selesaiAttachment = attendance.attachments.find((a) => a.kind === 'selesai') ?? null;
  const ticketAttachments = attendance.attachments.filter((a) => a.kind === 'ticket');

  useEffect(() => {
    const devId = getOrCreateDeviceId();
    const devLabel = getDeviceLabel();
    setClientDeviceId(devId);
    setClientDeviceLabel(devLabel);
    setIsMounted(true);

    // Jika absensi belum punya device_id dan belum terkunci, dan tanggalnya hari ini:
    if (!attendance.device_id && !attendance.is_locked && workDate === today) {
      claimDeviceAction(attendance.id, devId, devLabel).then(() => {
        router.refresh();
      });
    }
  }, [attendance.device_id, attendance.is_locked, attendance.id, workDate, today, router]);

  // Evaluasi hak akses edit
  const isToday = workDate === today;
  const isLocked = !!attendance.is_locked;
  const boundDeviceId = attendance.device_id;
  // Jika belum di-mount (SSR), anggap sama agar tidak flicker
  const isSameDevice = !isMounted || !boundDeviceId || (clientDeviceId && boundDeviceId === clientDeviceId);

  let canEdit = true;
  let lockReason: 'locked' | 'device_mismatch' | 'not_today' | null = null;

  if (!isMaster) {
    if (!isToday) {
      canEdit = false;
      lockReason = 'not_today';
    } else if (isLocked) {
      canEdit = false;
      lockReason = 'locked';
    } else if (!isSameDevice) {
      canEdit = false;
      lockReason = 'device_mismatch';
    }
  }

  function handleRefresh() {
    router.refresh();
  }

  async function handleLockAttendance() {
    if (!confirm('Kunci absensi ini? Setelah dikunci, data piket tidak dapat diubah lagi oleh akun user biasa.')) {
      return;
    }
    try {
      setIsProcessing(true);
      const res = await lockAttendanceAction(attendance.id, workDate, shiftType, clientDeviceId);
      if (res && !res.success) {
        alert(`Gagal mengunci: ${res.error || 'Terjadi kesalahan sistem.'}\n\nCatatan: Jika kolom 'is_locked' belum dibuat, mohon jalankan script migrasi di SQL Editor Supabase terlebih dahulu.`);
        return;
      }
      alert('Absensi berhasil dikunci!');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunci absensi.';
      alert(msg);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleUnlockAttendance() {
    if (!confirm('Buka kunci absensi ini? Akun user pada perangkat yang sah akan dapat mengedit kembali.')) {
      return;
    }
    try {
      setIsProcessing(true);
      const res = await unlockAttendanceAction(attendance.id, workDate, shiftType);
      if (res && !res.success) {
        alert(`Gagal membuka kunci: ${res.error || 'Terjadi kesalahan sistem.'}`);
        return;
      }
      alert('Kunci absensi berhasil dibuka!');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuka kunci.';
      alert(msg);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleResetDevice() {
    if (!confirm('Reset penguncian perangkat? Perangkat berikutnya yang membuka shift ini akan didaftarkan sebagai pemilik sah.')) {
      return;
    }
    try {
      setIsProcessing(true);
      const res = await resetDeviceAction(attendance.id, workDate, shiftType);
      if (res && !res.success) {
        alert(`Gagal mereset perangkat: ${res.error || 'Terjadi kesalahan sistem.'}`);
        return;
      }
      alert('Kunci perangkat berhasil di-reset!');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mereset perangkat.';
      alert(msg);
    } finally {
      setIsProcessing(false);
    }
  }

  const isComplete = !!mulaiAttachment && !!selesaiAttachment;

  return (
    <div className="space-y-6">
      {/* 1. Status / Banner Keamanan */}
      {isMaster && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950 text-xs shadow-sm">
          <div className="flex items-start gap-2.5">
            <Crown className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900 text-sm">Mode Akun Master (Akses Penuh)</p>
              <p className="text-amber-800 text-xs mt-0.5">
                Anda dapat mengedit absensi kapan pun tanpa batas waktu atau penguncian perangkat.
              </p>
              {attendance.device_info && (
                <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1 font-mono">
                  <Smartphone className="h-3 w-3 inline" /> Perangkat user: {attendance.device_info}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
            {isLocked && (
              <button
                type="button"
                onClick={handleUnlockAttendance}
                disabled={isProcessing}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm min-h-[36px]"
              >
                {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
                Buka Kunci
              </button>
            )}
            {attendance.device_id && (
              <button
                type="button"
                onClick={handleResetDevice}
                disabled={isProcessing}
                className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm min-h-[36px]"
              >
                {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Reset Device
              </button>
            )}
          </div>
        </div>
      )}

      {!isMaster && !canEdit && (
        <>
          {lockReason === 'locked' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 text-red-800 text-xs shadow-sm">
              <Lock className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900 text-sm">Absensi Selesai & Terkunci</p>
                <p className="text-red-700 mt-0.5">
                  Absensi shift ini telah difinalisasi dan dikunci. Perubahan tidak dapat dilakukan oleh akun user biasa. Hubungi Akun Master jika membutuhkan koreksi.
                </p>
              </div>
            </div>
          )}

          {lockReason === 'device_mismatch' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs shadow-sm">
              <Smartphone className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 text-sm">Terkunci Pada Perangkat Lain</p>
                <p className="text-amber-800 mt-0.5">
                  Absensi ini telah dimulai dari perangkat: <strong>{attendance.device_info || 'Perangkat Awal'}</strong>.
                </p>
                <p className="text-amber-700 text-[11px] mt-1">
                  Untuk keamanan, hanya HP / perangkat yang pertama kali digunakan yang diizinkan mengedit. Perangkat saat ini (<strong>{clientDeviceLabel}</strong>) hanya dalam mode <em>baca (read-only)</em>.
                </p>
              </div>
            </div>
          )}

          {lockReason === 'not_today' && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 text-blue-900 text-xs shadow-sm">
              <Calendar className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-blue-900 text-sm">Absensi Tanggal Lampau</p>
                <p className="text-blue-800 mt-0.5">
                  Akun user hanya diizinkan mengisi absensi pada tanggal hari berjalan. Absensi tanggal lampau hanya dapat diedit oleh Akun Master.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* 2. Form Upload Mulai Kerja */}
      <SingleUpload
        title="1. Mulai Kerja"
        kind="mulai"
        attendanceId={attendance.id}
        userId={userId}
        workDate={workDate}
        shiftType={shiftType}
        initialAttachment={mulaiAttachment}
        onSaved={handleRefresh}
        canEdit={canEdit}
      />

      {/* 3. Form Upload Selesai Kerja */}
      <SingleUpload
        title="2. Selesai Kerja"
        kind="selesai"
        attendanceId={attendance.id}
        userId={userId}
        workDate={workDate}
        shiftType={shiftType}
        initialAttachment={selesaiAttachment}
        onSaved={handleRefresh}
        canEdit={canEdit}
      />

      {/* 4. Form Picket Ticket */}
      <TicketUpload
        attendanceId={attendance.id}
        userId={userId}
        workDate={workDate}
        shiftType={shiftType}
        initialAttachments={ticketAttachments}
        onSaved={handleRefresh}
        canEdit={canEdit}
      />

      {/* 5. Catatan Piket */}
      <NoteAutosave
        attendanceId={attendance.id}
        initialNote={attendance.note}
        canEdit={canEdit}
        deviceId={clientDeviceId}
      />

      {/* 6. Aksi Bawah & Tombol Kunci */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span>Semua foto dan catatan <strong>tersimpan otomatis</strong>.</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Tombol Kunci jika lengkap dan belum terkunci */}
          {canEdit && !isLocked && isComplete && (
            <button
              type="button"
              onClick={handleLockAttendance}
              disabled={isProcessing}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors min-h-[44px] shadow-sm"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Kunci & Selesaikan Piket
            </button>
          )}

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors min-h-[44px]"
          >
            Selesai & Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
