'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Camera,
  Search,
  Send,
  Printer,
  MessagesSquare,
  Settings,
  GraduationCap,
  MessageCircle,
  Loader2,
  CalendarOff,
  X,
  UserCheck,
  Pencil,
  Trash2,
} from 'lucide-react';
import { formatIndonesia, todayWITA } from '@/lib/dates';
import { CANONICAL_APP_URL } from '@/lib/url';
import { showAlert, showConfirm } from '@/lib/swal';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { sendDailyRecapNowAction } from '@/app/(app)/pengaturan/rekapan/actions';
import {
  markManualAttendanceAction,
  updateManualAttendanceNoteAction,
  cancelManualAttendanceAction,
} from './actions';
import type { DailyAttendanceRecapResult, DailyAttendanceRecord } from '@/lib/data/daily-attendance-recap';

const MANUAL_NOTE_PRESETS = [
  'Hadir di kantor (tanpa foto)',
  'Hadir di lapangan',
  'Hadir, kendala kamera / HP',
  'Hadir (konfirmasi manual admin)',
  'Hadir WFH / tugas luar',
];

interface RekapHarianClientProps {
  initialDate: string;
  initialRecap: DailyAttendanceRecapResult;
  isMaster: boolean;
  canContactWA?: boolean;
  emailRecipientsCount: number;
  isHoliday?: boolean;
  holidayName?: string | null;
}

export function RekapHarianClient({
  initialDate,
  initialRecap,
  isMaster,
  canContactWA = false,
  emailRecipientsCount,
  isHoliday = false,
  holidayName = null,
}: RekapHarianClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [currentDate, setCurrentDate] = useState<string>(initialDate);
  const [filterTab, setFilterTab] = useState<'all' | 'hadir' | 'tidak_hadir'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);

  // Lightbox Preview Foto Bukti
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Modal Konfirmasi Hadir Manual Tanpa Foto (Khusus Admin/Owner)
  const [manualModal, setManualModal] = useState<{
    mode: 'create' | 'edit';
    userId: string;
    userName: string;
    feedId?: string;
  } | null>(null);
  const [manualNote, setManualNote] = useState<string>(MANUAL_NOTE_PRESETS[0]);
  const [savingManual, setSavingManual] = useState<boolean>(false);
  const [cancelingFeedId, setCancelingFeedId] = useState<string | null>(null);

  function openMarkManualModal(userId: string, userName: string) {
    setManualModal({ mode: 'create', userId, userName });
    setManualNote(MANUAL_NOTE_PRESETS[0]);
  }

  function openEditManualModal(userId: string, userName: string, feedId: string, currentNote?: string | null) {
    setManualModal({ mode: 'edit', userId, userName, feedId });
    setManualNote(currentNote || MANUAL_NOTE_PRESETS[0]);
  }

  async function handleSubmitManualAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (!manualModal || savingManual) return;

    const noteTrimmed = manualNote.trim();
    if (!noteTrimmed) {
      showAlert('Keterangan Wajib Diisi', 'Silakan masukkan keterangan kehadiran terlebih dahulu.', 'warning');
      return;
    }

    setSavingManual(true);
    try {
      const res =
        manualModal.mode === 'edit' && manualModal.feedId
          ? await updateManualAttendanceNoteAction(
              manualModal.feedId,
              manualModal.userId,
              currentDate,
              noteTrimmed
            )
          : await markManualAttendanceAction(manualModal.userId, currentDate, noteTrimmed);

      if (res.error) {
        showAlert('Gagal Menyimpan', res.error, 'error');
        return;
      }

      const targetName = manualModal.userName;
      const isEdit = manualModal.mode === 'edit';
      setManualModal(null);
      startTransition(() => {
        router.refresh();
      });
      showAlert(
        isEdit ? 'Keterangan Diperbarui' : 'Kehadiran Dicatat ✓',
        isEdit
          ? `Keterangan hadir untuk ${targetName} berhasil diperbarui.`
          : `${targetName} berhasil ditandai HADIR (tanpa foto) pada ${formatIndonesia(currentDate)}.`,
        'success'
      );
    } catch {
      showAlert('Error', 'Terjadi kesalahan jaringan saat menyimpan kehadiran.', 'error');
    } finally {
      setSavingManual(false);
    }
  }

  async function handleCancelManualAttendance(feedId: string, userName: string) {
    const confirmed = await showConfirm(
      `Batalkan Hadir Manual?`,
      `Status hadir tanpa foto untuk ${userName} pada ${formatIndonesia(currentDate)} akan dibatalkan dan kembali menjadi Tidak Hadir / Belum Absen.`,
      'Ya, Batalkan',
      true
    );
    if (!confirmed) return;

    setCancelingFeedId(feedId);
    try {
      const res = await cancelManualAttendanceAction(feedId);
      if (res.error) {
        showAlert('Gagal Membatalkan', res.error, 'error');
        return;
      }
      startTransition(() => {
        router.refresh();
      });
      showAlert('Dibatalkan', `Kehadiran manual ${userName} telah dibatalkan.`, 'success');
    } catch {
      showAlert('Error', 'Terjadi kesalahan jaringan saat membatalkan kehadiran.', 'error');
    } finally {
      setCancelingFeedId(null);
    }
  }

  // Sinkronisasi tanggal saat server mengirim props baru
  useEffect(() => {
    setCurrentDate(initialDate);
  }, [initialDate]);

  const isChangingDate = isPending || currentDate !== initialDate;

  const today = todayWITA();
  const isToday = currentDate === today;

  // Navigasi Tanggal dengan Transisi Loading Halus
  function changeDate(deltaDays: number) {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() + deltaDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const newDateStr = `${y}-${m}-${day}`;
    setCurrentDate(newDateStr);
    startTransition(() => {
      router.push(`/rekap-harian?date=${newDateStr}`);
    });
  }

  function handleDateSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      setCurrentDate(val);
      startTransition(() => {
        router.push(`/rekap-harian?date=${val}`);
      });
    }
  }

  function goToToday() {
    setCurrentDate(today);
    startTransition(() => {
      router.push(`/rekap-harian?date=${today}`);
    });
  }

  // Rekap Harian khusus untuk Anak Magang
  const baseRecords: DailyAttendanceRecord[] = initialRecap.records;

  const totalMagang = baseRecords.length;
  const hadirCount = baseRecords.filter((r) => r.isHadir).length;
  const tidakHadirCount = totalMagang - hadirCount;
  const persentaseHadir = totalMagang > 0 ? Math.round((hadirCount / totalMagang) * 100) : 0;

  // Filter sesuai tab status & query pencarian
  const filteredRecords = baseRecords.filter((rec) => {
    if (filterTab === 'hadir' && !rec.isHadir) return false;
    if (filterTab === 'tidak_hadir' && rec.isHadir) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (rec.user.full_name || '').toLowerCase();
      const email = (rec.user.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    }
    return true;
  });

  // Kirim Rekap ke Email
  async function handleSendEmail() {
    if (emailRecipientsCount === 0) {
      showAlert(
        'Email Penerima Belum Diisi',
        'Belum ada alamat email penerima yang disetel. Silakan atur email penerima di menu Pengaturan Rekapan.',
        'warning'
      );
      return;
    }

    const dateFormatted = formatIndonesia(currentDate);

    if (isHoliday) {
      const confirmHoliday = await showConfirm(
        'Hari Libur / Tanggal Merah 🏖️',
        `Tanggal ${dateFormatted} adalah ${holidayName || 'Hari Libur'}.\n\nPengiriman otomatis dinonaktifkan pada hari libur. Apakah Anda ingin tetap mengirimkan rekapan ini secara manual?`,
        'Ya, Tetap Kirim',
        true
      );
      if (!confirmHoliday) return;
    } else {
      const confirmed = await showConfirm(
        `Kirim Rekapan Tanggal ${dateFormatted}?`,
        `Sistem akan mengompilasi rekap kehadiran anak magang (hadir vs tidak hadir) dan mengirimkannya via email ke ${emailRecipientsCount} penerima yang terdaftar.`,
        'Ya, Kirim Sekarang'
      );
      if (!confirmed) return;
    }

    setSendingEmail(true);
    try {
      const res = await sendDailyRecapNowAction(currentDate, undefined, isHoliday);
      if (res.success) {
        showAlert(
          'Email Berhasil Dikirim! 🚀',
          res.message || 'Laporan rekapan absensi harian telah berhasil dikirim ke seluruh email tujuan.',
          'success'
        );
      } else {
        showAlert('Pengiriman Dibatalkan / Gagal', res.error || 'Terjadi kesalahan sistem.', 'warning');
      }
    } catch {
      showAlert('Error', 'Terjadi kesalahan jaringan saat mengirim email.', 'error');
    } finally {
      setSendingEmail(false);
    }
  }

  function openPhotoLightbox(url: string) {
    setLightboxSrc(url);
    setLightboxOpen(true);
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* 1. TOP HEADER & QUICK ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-gray-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">
                Rekap Absen Harian Anak Magang
              </h1>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Laporan kehadiran harian &bull; Terpisah dari rekapan piket shift &bull; Pantau yang hadir dan belum hadir
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tombol Cetak / Simpan PDF */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition shadow-2xs"
            title="Cetak Laporan / Simpan PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Cetak / PDF</span>
          </button>

          {/* Tombol Kirim Email Rekapan */}
          {isMaster && (
            <button
              type="button"
              disabled={sendingEmail}
              onClick={handleSendEmail}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition shadow-xs"
              title="Kirim Laporan Harian Ini ke Email Manajemen"
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Mengirim Email...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Kirim Rekap ke Email</span>
                </>
              )}
            </button>
          )}

          {/* Tombol Buka Chat Absen */}
          <Link
            href={`/absen-chat?date=${currentDate}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-semibold transition"
          >
            <MessagesSquare className="h-3.5 w-3.5" />
            <span>Buka Chat Absen</span>
          </Link>

          {/* Tombol Pengaturan Email */}
          {isMaster && (
            <Link
              href="/pengaturan/rekapan"
              className="p-2 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-xl transition"
              title="Atur Email Penerima Rekapan"
            >
              <Settings className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Holiday Alert Banner */}
      {isHoliday && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/60 rounded-xl text-amber-700 dark:text-amber-300 shrink-0">
              <CalendarOff className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-bold block">
                Hari Libur: {holidayName || 'Tanggal Merah'}
              </span>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/80 mt-0.5">
                Tanggal ini terdaftar sebagai hari libur. Sistem otomatis <strong>tidak mengirimkan rekapan absensi harian</strong> ke email.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-[10px] font-bold bg-amber-200/80 dark:bg-amber-900 text-amber-800 dark:text-amber-200 shrink-0">
            Libur / Off
          </span>
        </div>
      )}

      {/* 2. DATE NAVIGATION TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-gray-200/90 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={() => changeDate(-1)}
            disabled={isChangingDate}
            className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 transition disabled:opacity-50"
            title="Hari Sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-slate-800 rounded-xl border transition-all ${
              isChangingDate
                ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                : 'border-gray-200 dark:border-slate-700'
            }`}>
              {isChangingDate ? (
                <Loader2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              )}
              <input
                type="date"
                value={currentDate}
                onChange={handleDateSelect}
                disabled={isChangingDate}
                className="bg-transparent text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 focus:outline-none cursor-pointer disabled:opacity-50"
              />
            </div>

            <button
              type="button"
              onClick={goToToday}
              disabled={isToday || isChangingDate}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                isToday
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                  : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'
              } disabled:opacity-50`}
            >
              {isChangingDate && isToday ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Hari Ini
                </span>
              ) : (
                'Hari Ini'
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => changeDate(1)}
            disabled={isChangingDate}
            className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 transition disabled:opacity-50"
            title="Hari Berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="text-center sm:text-right">
          <span className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-slate-100 block">
            {formatIndonesia(currentDate)}
          </span>
          <span className="text-[11px] text-gray-500 dark:text-slate-400">
            Zona Waktu WITA (Bali &amp; Nusa Tenggara)
          </span>
        </div>
      </div>

      {/* 3. METRIC SUMMARY CARDS */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 transition-opacity duration-200 ${isChangingDate ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
        {/* Total Anak Magang */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200/90 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">
              Total Anak Magang
            </span>
            <GraduationCap className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            {totalMagang}
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500">
            Terdaftar &amp; akun aktif
          </p>
        </div>

        {/* Hadir */}
        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
            <span className="text-xs font-bold uppercase tracking-wider">Hadir Hari Ini</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">
            {hadirCount}
          </div>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400">
            {persentaseHadir}% dari total anak magang
          </p>
        </div>

        {/* Tidak Hadir / Belum Absen */}
        <div className="bg-rose-50/60 dark:bg-rose-950/30 p-4 rounded-2xl border border-rose-200 dark:border-rose-800/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-300">
            <span className="text-xs font-bold uppercase tracking-wider">Tidak / Belum Hadir</span>
            <XCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-700 dark:text-rose-300">
            {tidakHadirCount}
          </div>
          <p className="text-[11px] text-rose-600/80 dark:text-rose-400">
            {totalMagang > 0 ? 100 - persentaseHadir : 0}% belum absen
          </p>
        </div>

        {/* Tingkat Kehadiran */}
        <div className="bg-indigo-50/60 dark:bg-indigo-950/30 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300">
            <span className="text-xs font-bold uppercase tracking-wider">Tingkat Kehadiran</span>
            <Clock className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-indigo-700 dark:text-indigo-300">
            {persentaseHadir}%
          </div>
          <div className="w-full bg-indigo-200/60 dark:bg-indigo-900/60 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div
              className="bg-indigo-600 dark:bg-indigo-400 h-full transition-all duration-500 rounded-full"
              style={{ width: `${persentaseHadir}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4. FILTER TABS & SEARCH CONTROLS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-gray-200/90 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              filterTab === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'
            }`}
          >
            <span>Semua</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {totalMagang}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('hadir')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              filterTab === 'hadir'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            }`}
          >
            <span>✓ Hadir</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {hadirCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('tidak_hadir')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              filterTab === 'tidak_hadir'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            <span>✕ Tidak Hadir</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {tidakHadirCount}
            </span>
          </button>
        </div>

        {/* Search Input dengan Tombol Clear */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau email anak magang..."
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded"
                title="Hapus pencarian"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. DAFTAR REKAPAN KEHADIRAN (TABEL / KARTU RESPONSIVE) */}
      <div className="space-y-3">
        {isChangingDate ? (
          <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-emerald-100 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-3 border-emerald-200 dark:border-emerald-900/60 border-t-emerald-600 dark:border-t-emerald-400 animate-spin" />
              <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400 absolute" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
                Memuat Rekapan Kehadiran...
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Mengambil data absensi magang untuk {formatIndonesia(currentDate)}
              </p>
            </div>
            {/* Animasi Skeleton Baris */}
            <div className="space-y-2 pt-2 max-w-md mx-auto">
              <div className="h-14 bg-gray-100/80 dark:bg-slate-800/60 rounded-xl animate-pulse" />
              <div className="h-14 bg-gray-100/80 dark:bg-slate-800/60 rounded-xl animate-pulse" />
              <div className="h-14 bg-gray-100/80 dark:bg-slate-800/60 rounded-xl animate-pulse" />
            </div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/90 dark:border-slate-800 space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400">
              <Search className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-gray-800 dark:text-slate-200">
              {searchQuery ? 'Tidak ada anak magang yang cocok dengan pencarian' : 'Tidak ada data presensi'}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {searchQuery ? `Hasil pencarian untuk "${searchQuery}" tidak ditemukan.` : 'Belum ada catatan presensi pada tanggal ini.'}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-200"
              >
                <X className="h-3 w-3" /> Reset Pencarian
              </button>
            )}
          </div>
        ) : (
          filteredRecords.map((rec) => {
            const initial = (rec.user.full_name || 'U').trim().charAt(0).toUpperCase();
            const phoneDigits = rec.user.phone ? rec.user.phone.replace(/\D/g, '') : null;
            const waPhone = phoneDigits?.startsWith('0') ? `62${phoneDigits.slice(1)}` : phoneDigits;

            return (
              <div
                key={rec.user.id}
                className={`p-4 rounded-2xl border transition-all shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  rec.isHadir
                    ? 'bg-white dark:bg-slate-900 border-gray-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800'
                    : 'bg-rose-50/40 dark:bg-slate-900/90 border-rose-200/80 dark:border-rose-900/50 hover:border-rose-300'
                }`}
              >
                {/* Info Identitas Petugas */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-sm flex-shrink-0 shadow-2xs ${
                      rec.isHadir
                        ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white'
                        : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                    }`}
                  >
                    {initial}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {rec.user.full_name}
                      </h3>

                      {/* Status Hadir / Belum Hadir */}
                      {rec.isHadir ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Hadir</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                          <XCircle className="h-3 w-3" />
                          <span>Tidak Hadir / Belum Absen</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">
                      {rec.user.email}
                      {canContactWA && rec.user.phone && ` • ${rec.user.phone}`}
                    </p>

                    {/* Catatan / Keterangan Kehadiran */}
                    {rec.message && (
                      <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200/80 dark:border-slate-700 mt-2 leading-relaxed">
                        &ldquo;{rec.message}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                {/* Detail Waktu, Metode, & Bukti Foto */}
                <div className="flex items-center gap-2.5 self-start md:self-center shrink-0 flex-wrap sm:flex-nowrap">
                  {rec.isHadir ? (
                    <>
                      {/* Jam & Metode */}
                      <div className="text-left md:text-right">
                        <div className="flex items-center md:justify-end gap-1 text-xs font-bold text-gray-900 dark:text-slate-100">
                          <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{rec.attendanceTime || '-'}</span>
                        </div>
                        <span className="text-[11px] text-gray-500 dark:text-slate-400 block mt-0.5">
                          {rec.methodLabel || 'Absen Masuk'}
                        </span>
                      </div>

                      {/* Thumbnail Foto Bukti GPS Map */}
                      {rec.photoUrl ? (
                        <div
                          onClick={() => openPhotoLightbox(rec.photoUrl!)}
                          className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 w-12 h-12 bg-slate-950 cursor-pointer group shadow-2xs hover:scale-105 transition-transform"
                          title="Klik untuk melihat foto bukti GPS Map"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={rec.photoUrl}
                            alt="Bukti Kehadiran"
                            className="w-full h-full object-cover group-hover:opacity-90"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex flex-col items-center justify-center text-emerald-700 dark:text-emerald-300 text-[9px] font-bold text-center leading-tight px-1">
                          <UserCheck className="h-3.5 w-3.5 mb-0.5" />
                          <span>Tanpa Foto</span>
                        </div>
                      )}

                      {/* Aksi Admin untuk Edit / Batalkan Kehadiran Manual Tanpa Foto */}
                      {isMaster && rec.isManualAdmin && rec.feedId && (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            type="button"
                            onClick={() =>
                              openEditManualModal(rec.user.id, rec.user.full_name, rec.feedId!, rec.message)
                            }
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition"
                            title="Ubah Keterangan Hadir Manual"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={cancelingFeedId === rec.feedId}
                            onClick={() => handleCancelManualAttendance(rec.feedId!, rec.user.full_name)}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition disabled:opacity-50"
                            title="Batalkan Keterangan Hadir Manual"
                          >
                            {cancelingFeedId === rec.feedId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Tombol Tandai Hadir Manual Tanpa Foto (Khusus Admin & Owner) */}
                      {isMaster && (
                        <button
                          type="button"
                          onClick={() => openMarkManualModal(rec.user.id, rec.user.full_name)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
                          title="Berikan keterangan hadir manual tanpa perlu foto"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>Tandai Hadir</span>
                        </button>
                      )}

                      {/* Tombol Hubungi WhatsApp HANYA untuk role Senior, Admin, dan Owner */}
                      {canContactWA &&
                        (waPhone ? (
                          <a
                            href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                              `Halo ${rec.user.full_name}, kami melihat Anda belum melakukan absensi harian ICONNET pada hari ini (${formatIndonesia(
                                currentDate
                              )}). Mohon segera melakukan absensi melalui aplikasi: ${CANONICAL_APP_URL}/absen-chat`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-semibold transition"
                            title="Hubungi anak magang via WhatsApp"
                          >
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Hubungi WA</span>
                          </a>
                        ) : (
                          <span className="text-xs text-rose-500 font-medium italic">
                            Belum ada nomor WA
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 6. MODAL KONFIRMASI HADIR MANUAL TANPA FOTO (ADMIN/OWNER) */}
      {manualModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !savingManual && setManualModal(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-emerald-50/60 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <UserCheck className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {manualModal.mode === 'edit' ? 'Ubah Keterangan Hadir' : 'Tandai Hadir Tanpa Foto'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {manualModal.userName} &bull; {formatIndonesia(currentDate)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={savingManual}
                onClick={() => setManualModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-white/80 dark:hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitManualAttendance} className="p-5 space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                  Pilih Cepat Keterangan:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MANUAL_NOTE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setManualNote(preset)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition ${
                        manualNote === preset
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1.5">
                  Keterangan Kehadiran
                </label>
                <textarea
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  rows={3}
                  placeholder="Contoh: Hadir di kantor namun terkendala kamera HP..."
                  required
                  className="w-full p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Pengguna akan tercatat berstatus <strong>Hadir</strong> pada Rekap Harian, Chat Absen, Export, dan Email Rekapan tanpa memerlukan foto.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={savingManual}
                  onClick={() => setManualModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingManual || !manualNote.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition shadow-xs"
                >
                  {savingManual ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{manualModal.mode === 'edit' ? 'Simpan Perubahan' : 'Simpan Hadir'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. LIGHTBOX MODAL PREVIEW FOTO RESMI GPS MAP */}
      {lightboxSrc && (
        <ImageLightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={[{ src: lightboxSrc, title: `Bukti Foto GPS Map • ${formatIndonesia(currentDate)}` }]}
        />
      )}
    </div>
  );
}
