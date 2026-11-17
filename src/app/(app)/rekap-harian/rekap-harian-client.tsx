'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { formatIndonesia, todayWITA } from '@/lib/dates';
import { showAlert, showConfirm } from '@/lib/swal';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { sendDailyRecapNowAction } from '@/app/(app)/pengaturan/rekapan/actions';
import type { DailyAttendanceRecapResult, DailyAttendanceRecord } from '@/lib/data/daily-attendance-recap';

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

  const [currentDate, setCurrentDate] = useState<string>(initialDate);
  const [filterTab, setFilterTab] = useState<'all' | 'hadir' | 'tidak_hadir'>('all');
  const [userScope, setUserScope] = useState<'magang' | 'semua'>('magang');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);

  // Lightbox Preview Foto Bukti
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const today = todayWITA();
  const isToday = currentDate === today;

  // Navigasi Tanggal
  function changeDate(deltaDays: number) {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() + deltaDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const newDateStr = `${y}-${m}-${day}`;
    setCurrentDate(newDateStr);
    router.push(`/rekap-harian?date=${newDateStr}`);
  }

  function handleDateSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      setCurrentDate(val);
      router.push(`/rekap-harian?date=${val}`);
    }
  }

  function goToToday() {
    setCurrentDate(today);
    router.push(`/rekap-harian?date=${today}`);
  }

  // Pilih dataset sesuai scope (Khusus Anak Magang vs Semua Petugas)
  const baseRecords: DailyAttendanceRecord[] =
    userScope === 'magang'
      ? initialRecap.records
      : initialRecap.allActiveRecords;

  const totalScope = baseRecords.length;
  const hadirScope = baseRecords.filter((r) => r.isHadir).length;
  const tidakHadirScope = totalScope - hadirScope;
  const persentaseScope = totalScope > 0 ? Math.round((hadirScope / totalScope) * 100) : 0;

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
            className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 transition"
            title="Hari Sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
              <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <input
                type="date"
                value={currentDate}
                onChange={handleDateSelect}
                className="bg-transparent text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={goToToday}
              disabled={isToday}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                isToday
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                  : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'
              }`}
            >
              Hari Ini
            </button>
          </div>

          <button
            type="button"
            onClick={() => changeDate(1)}
            className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 transition"
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Anak Magang */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200/90 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">
              {userScope === 'magang' ? 'Total Anak Magang' : 'Total Petugas'}
            </span>
            <GraduationCap className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            {totalScope}
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
            {hadirScope}
          </div>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400">
            {persentaseScope}% dari total petugas
          </p>
        </div>

        {/* Tidak Hadir / Belum Absen */}
        <div className="bg-rose-50/60 dark:bg-rose-950/30 p-4 rounded-2xl border border-rose-200 dark:border-rose-800/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-300">
            <span className="text-xs font-bold uppercase tracking-wider">Tidak / Belum Hadir</span>
            <XCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-700 dark:text-rose-300">
            {tidakHadirScope}
          </div>
          <p className="text-[11px] text-rose-600/80 dark:text-rose-400">
            {totalScope > 0 ? 100 - persentaseScope : 0}% belum absen
          </p>
        </div>

        {/* Tingkat Kehadiran */}
        <div className="bg-indigo-50/60 dark:bg-indigo-950/30 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300">
            <span className="text-xs font-bold uppercase tracking-wider">Tingkat Kehadiran</span>
            <Clock className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-indigo-700 dark:text-indigo-300">
            {persentaseScope}%
          </div>
          <div className="w-full bg-indigo-200/60 dark:bg-indigo-900/60 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div
              className="bg-indigo-600 dark:bg-indigo-400 h-full transition-all duration-500 rounded-full"
              style={{ width: `${persentaseScope}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4. FILTER TABS & SEARCH CONTROLS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-gray-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
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
              {totalScope}
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
              {hadirScope}
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
              {tidakHadirScope}
            </span>
          </button>
        </div>

        {/* User Scope Toggle & Search */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          {/* Scope Toggle */}
          <div className="flex items-center p-0.5 bg-gray-100 dark:bg-slate-800 rounded-xl text-xs font-semibold shrink-0">
            <button
              type="button"
              onClick={() => setUserScope('magang')}
              className={`px-2.5 py-1 rounded-lg transition ${
                userScope === 'magang'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-800 dark:text-slate-400'
              }`}
            >
              🎓 Anak Magang
            </button>
            <button
              type="button"
              onClick={() => setUserScope('semua')}
              className={`px-2.5 py-1 rounded-lg transition ${
                userScope === 'semua'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-800 dark:text-slate-400'
              }`}
            >
              👥 Semua Petugas
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama / email..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* 5. DAFTAR REKAPAN KEHADIRAN (TABEL / KARTU RESPONSIVE) */}
      <div className="space-y-3">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/90 dark:border-slate-800 space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400">
              <Search className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-gray-800 dark:text-slate-200">
              Tidak ada data yang cocok
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {searchQuery
                ? 'Tidak ada nama yang sesuai dengan kata kunci pencarian.'
                : 'Tidak ada data kehadiran pada filter ini.'}
            </p>
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
                <div className="flex items-center gap-3 self-start md:self-center shrink-0 flex-wrap sm:flex-nowrap">
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
                        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center text-gray-400 text-[10px]">
                          Tanpa Foto
                        </div>
                      )}
                    </>
                  ) : canContactWA ? (
                    /* Jika Belum Hadir: Tombol Hubungi WhatsApp HANYA untuk role Senior, Admin, dan Owner */
                    waPhone ? (
                      <a
                        href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                          `Halo ${rec.user.full_name}, kami melihat Anda belum melakukan absensi harian ICONNET pada hari ini (${formatIndonesia(
                            currentDate
                          )}). Mohon segera melakukan absensi melalui aplikasi: https://www.magang-iconnet.online/absen-chat`
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
                    )
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 6. LIGHTBOX MODAL PREVIEW FOTO RESMI GPS MAP */}
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
