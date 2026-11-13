'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatIndonesia } from '@/lib/dates';
import { shiftLabel, jobLabel, JOB_TYPES, type JobType } from '@/lib/shifts';
import type { ShiftType, ShiftStatus } from '@/lib/supabase/types';
import {
  Filter,
  ChevronLeft,
  ChevronRight,
  FileText,
  X,
  ExternalLink,
  Layers,
  CheckCircle2,
  Search,
  User,
  ZoomIn,
  Eye,
} from 'lucide-react';
import { ImageLightbox } from '@/components/ui/image-lightbox';

export interface RiwayatJobDetail {
  id?: string;
  job_type: JobType;
  status: ShiftStatus;
  note: string | null;
  is_locked?: boolean;
  hasMulai?: boolean;
  hasSelesai?: boolean;
  mulaiThumbnail: string | null;
  selesaiThumbnail: string | null;
  aktivitasThumbnails?: string[];
  aktivitasCount?: number;
  ticketCount?: number;
  userName?: string | null;
}

export interface RiwayatShiftGroup {
  work_date: string;
  shift_type: ShiftType;
  isHoliday: boolean;
  holidayName?: string;
  overallStatus: ShiftStatus;
  jobs: Record<JobType, RiwayatJobDetail>;
  userNames?: string[];
}

interface RiwayatViewProps {
  items: RiwayatShiftGroup[];
  currentMonth: string;
  prevMonth: string;
  nextMonth: string;
  currentUserName?: string;
  isMaster?: boolean;
  today: string;
}

export function RiwayatView({
  items,
  currentMonth,
  prevMonth,
  nextMonth,
  currentUserName,
  isMaster = false,
  today,
}: RiwayatViewProps) {
  const [shiftFilter, setShiftFilter] = useState<'all' | ShiftType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ShiftStatus>('all');
  const [searchName, setSearchName] = useState('');
  const [pageSize, setPageSize] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [drawerShift, setDrawerShift] = useState<RiwayatShiftGroup | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<{ src: string; title?: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (!drawerShift) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerShift]);

  // Aturan akses foto: Petugas hanya bisa melihat foto absensi di hari itu (hari ini).
  // Foto absen kemarin / hari-hari sebelumnya diburamkan 70% dengan ikon mata.
  const isPastShift = drawerShift ? drawerShift.work_date < today : false;
  const isPhotoRestricted = !isMaster && isPastShift;

  function openJobLightbox(job: RiwayatJobDetail, targetUrl: string) {
    if (isPhotoRestricted) return;
    const slides: { src: string; title: string }[] = [];
    if (job.mulaiThumbnail) {
      slides.push({
        src: job.mulaiThumbnail,
        title: '1. Bukti Mulai Kerja',
      });
    }
    if (job.selesaiThumbnail) {
      slides.push({
        src: job.selesaiThumbnail,
        title: '2. Bukti Selesai Kerja',
      });
    }
    if (job.aktivitasThumbnails && job.aktivitasThumbnails.length > 0) {
      job.aktivitasThumbnails.forEach((url, i) => {
        slides.push({
          src: url,
          title: `3. Bukti Aktivitas Piket #${i + 1}`,
        });
      });
    }
    const idx = slides.findIndex((s) => s.src === targetUrl);
    setLightboxSlides(slides);
    setLightboxIndex(Math.max(0, idx));
    setLightboxOpen(true);
  }

  // Filter
  const filtered = items.filter((item) => {
    if (shiftFilter !== 'all' && item.shift_type !== shiftFilter) return false;
    if (statusFilter !== 'all' && item.overallStatus !== statusFilter) return false;

    if (searchName.trim()) {
      const q = searchName.toLowerCase().trim();
      const hasMatchingUser = item.userNames && item.userNames.some((name) => name.toLowerCase().includes(q));
      if (!hasMatchingUser) return false;
    }

    return true;
  });

  // Pagination calculation
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedItems = filtered.slice(startIndex, endIndex);

  function handleFilterShift(val: 'all' | ShiftType) {
    setShiftFilter(val);
    setCurrentPage(1);
  }

  function handleFilterStatus(val: 'all' | ShiftStatus) {
    setStatusFilter(val);
    setCurrentPage(1);
  }

  function handlePageSizeChange(val: number) {
    setPageSize(val);
    setCurrentPage(1);
  }

  return (
    <div className="space-y-5">
      {/* 1. Month Navigator */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-100 dark:border-slate-800 shadow-sm transition-colors">
        <Link
          href={`/riwayat?month=${prevMonth}`}
          className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 font-bold">Bulan Riwayat</p>
          <span className="font-bold text-gray-900 dark:text-slate-100 capitalize text-base">
            {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
              new Date(`${currentMonth}-01`)
            )}
          </span>
        </div>
        <Link
          href={`/riwayat?month=${nextMonth}`}
          className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Bulan berikutnya"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      {/* 2. Filter & Pagination Sizer Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-100 dark:border-slate-800 shadow-sm space-y-3 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            <Filter className="h-3.5 w-3.5" /> Filter & Pencarian
          </div>
          <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
            {totalItems} shift tercatat
          </span>
        </div>

        {/* Quick Filter Chips */}
        {currentUserName && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <button
              type="button"
              onClick={() => {
                setSearchName('');
                setStatusFilter('all');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-colors ${
                searchName === '' && statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              Semua Shift
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchName(currentUserName);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
                searchName === currentUserName
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              <User className="h-3 w-3" /> Piket Saya
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter(statusFilter === 'sebagian' ? 'all' : 'sebagian');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-colors ${
                statusFilter === 'sebagian'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              Belum Lengkap
            </button>
          </div>
        )}

        {/* Input Pencarian Berdasarkan Nama Petugas */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchName}
            onChange={(e) => {
              setSearchName(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari berdasarkan nama petugas..."
            className="w-full pl-10 pr-9 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px]"
          />
          {searchName && (
            <button
              type="button"
              onClick={() => {
                setSearchName('');
                setCurrentPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 p-1"
              aria-label="Hapus pencarian"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 dark:text-slate-300 mb-1">Shift</label>
            <select
              value={shiftFilter}
              onChange={(e) => handleFilterShift(e.target.value as 'all' | ShiftType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px]"
            >
              <option value="all">Semua Shift</option>
              <option value="pagi">Shift 1 (Pagi)</option>
              <option value="malam">Shift 2 (Malam)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-600 dark:text-slate-300 mb-1">Status Shift</label>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterStatus(e.target.value as 'all' | ShiftStatus)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px]"
            >
              <option value="all">Semua Status</option>
              <option value="lengkap">Lengkap</option>
              <option value="sebagian">Sebagian</option>
              <option value="kosong">Kosong</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-600 dark:text-slate-300 mb-1">Per Halaman</label>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px]"
            >
              <option value={5}>5 per halaman</option>
              <option value={10}>10 per halaman</option>
              <option value={20}>20 per halaman</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. List Shift (Grouped per Date & Shift) */}
      <div className="space-y-3">
        {paginatedItems.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 border border-gray-100 dark:border-slate-800 text-center text-gray-400 dark:text-slate-500">
            <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
              {searchName ? 'Tidak ada petugas yang cocok' : 'Tidak ada riwayat absensi'}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              {searchName
                ? `Tidak ditemukan riwayat piket oleh petugas dengan nama "${searchName}".`
                : 'Coba sesuaikan filter atau pilih bulan sebelumnya.'}
            </p>
            {searchName && (
              <button
                type="button"
                onClick={() => {
                  setSearchName('');
                  setCurrentPage(1);
                }}
                className="mt-3 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Reset Pencarian Nama
              </button>
            )}
          </div>
        ) : (
          paginatedItems.map((item) => {
            const dateShiftKey = `${item.work_date}-${item.shift_type}`;

            return (
              <div
                key={dateShiftKey}
                onClick={() => setDrawerShift(item)}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-slate-800 shadow-sm hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-gray-900 dark:text-slate-100 text-sm sm:text-base">
                        {shiftLabel(item.shift_type)}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                          item.overallStatus === 'lengkap'
                            ? 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                            : item.overallStatus === 'sebagian'
                            ? 'bg-yellow-100 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700'
                        }`}
                      >
                        {item.overallStatus}
                      </span>
                      {item.isHoliday && (
                        <span className="text-[10px] bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/60 px-2 py-0.5 rounded-full font-medium">
                          Libur: {item.holidayName}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                      {formatIndonesia(item.work_date)}
                    </p>

                    {/* Petugas Piket */}
                    {item.userNames && item.userNames.length > 0 ? (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-700 dark:text-slate-300">
                        <User className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                        <span className="truncate">
                          Petugas: <strong className="text-gray-900 dark:text-slate-100 font-semibold">{item.userNames.join(', ')}</strong>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400 dark:text-slate-500">
                        <User className="h-3.5 w-3.5 text-gray-300 dark:text-slate-600 flex-shrink-0" />
                        <span className="italic">Belum ada yang mengisi</span>
                      </div>
                    )}

                    {/* 3 Positions Status Pills */}
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {JOB_TYPES.map((jt) => {
                        const job = item.jobs[jt];
                        const status = job?.status ?? 'kosong';
                        return (
                          <div
                            key={jt}
                            className="bg-gray-50/80 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700/60 rounded-xl p-2 flex flex-col items-center text-center group-hover:bg-blue-50/40 dark:group-hover:bg-blue-950/30 transition-colors"
                          >
                            <span className="text-[11px] font-semibold text-gray-800 dark:text-slate-200">
                              {jobLabel(jt)}
                            </span>
                            <span
                              className={`text-[10px] font-medium capitalize mt-0.5 ${
                                status === 'lengkap'
                                  ? 'text-green-600 dark:text-green-400'
                                  : status === 'sebagian'
                                  ? 'text-yellow-600 dark:text-yellow-400'
                                  : 'text-gray-400 dark:text-slate-500'
                              }`}
                            >
                              {status}
                            </span>
                            {status !== 'kosong' && job?.userName && (
                              <span
                                className="text-[9px] text-gray-600 dark:text-slate-300 font-medium truncate max-w-full mt-1 px-1 bg-white dark:bg-slate-800 rounded border border-gray-200/60 dark:border-slate-700"
                                title={job.userName}
                              >
                                {job.userName}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Icon drawer indicator */}
                  <div className="flex flex-col items-center justify-center pl-2 pt-1">
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Layers className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 font-semibold mt-1">
                      Detail
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs transition-colors">
          <p className="text-gray-500 dark:text-slate-400">
            Menampilkan <strong>{totalItems === 0 ? 0 : startIndex + 1}</strong> &ndash;{' '}
            <strong>{endIndex}</strong> dari <strong>{totalItems}</strong> shift
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="px-3 py-1.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors min-h-[38px] flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Sebelumnya
            </button>

            <span className="px-2 font-semibold text-gray-700 dark:text-slate-300">
              {safeCurrentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="px-3 py-1.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors min-h-[38px] flex items-center gap-1"
            >
              Berikutnya <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 5. DRAWER SLIDE-OVER (3 Pekerjaan per Shift) */}
      {drawerShift && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
          onClick={() => setDrawerShift(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col z-[100] animate-in slide-in-from-right duration-200 border-l border-gray-100 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-start justify-between bg-gray-50/50 dark:bg-slate-800/40">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 dark:text-slate-100 text-lg">
                    {shiftLabel(drawerShift.shift_type)}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                      drawerShift.overallStatus === 'lengkap'
                        ? 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                        : drawerShift.overallStatus === 'sebagian'
                        ? 'bg-yellow-100 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700'
                    }`}
                  >
                    {drawerShift.overallStatus}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  {formatIndonesia(drawerShift.work_date)}
                  {drawerShift.isHoliday && (
                    <span className="text-red-600 dark:text-red-400 font-semibold"> • {drawerShift.holidayName}</span>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDrawerShift(null)}
                className="p-2 text-gray-400 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                aria-label="Tutup Drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body (3 Posisi Pekerjaan) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {isPhotoRestricted && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-xs shadow-xs">
                  <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5">
                    <Eye className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-semibold block text-amber-900 dark:text-amber-200">Aturan Akses Foto Petugas</span>
                    <span className="text-[11px] text-amber-800 dark:text-amber-400 leading-snug">
                      Petugas hanya bisa lihat absensi di hari itu. Foto absen kemarin atau sebelumnya diburamkan 70%.
                    </span>
                  </div>
                </div>
              )}

              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Dokumentasi 3 Posisi Pekerjaan
              </p>

              {JOB_TYPES.map((jt) => {
                const job = drawerShift.jobs[jt];
                const status = job?.status ?? 'kosong';

                return (
                  <div
                    key={jt}
                    className="border border-gray-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                            {jobLabel(jt)}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                              status === 'lengkap'
                                ? 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                                : status === 'sebagian'
                                ? 'bg-yellow-100 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800'
                                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700'
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                        {job?.userName ? (
                          <p className="text-xs text-gray-600 dark:text-slate-400 mt-1 flex items-center gap-1 font-medium">
                            <User className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                            <span>Petugas: <strong className="text-gray-900 dark:text-slate-100 font-semibold">{job.userName}</strong></span>
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 italic flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-gray-300 dark:text-slate-600 flex-shrink-0" />
                            <span>Belum ada yang mengisi</span>
                          </p>
                        )}
                      </div>

                      <Link
                        href={`/absen/${drawerShift.work_date}/${drawerShift.shift_type}?job=${jt}`}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 hover:underline flex-shrink-0 mt-0.5"
                      >
                        Buka Form <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>

                    {/* 2 Bukti Piket (Mulai & Selesai) */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {/* Bukti 1: Mulai Piket */}
                      <div className="border border-gray-100 dark:border-slate-800 rounded-xl p-2.5 bg-gray-50 dark:bg-slate-800/40 text-center">
                        <div className="flex items-center justify-between mb-1.5 px-0.5">
                          <span className="text-[11px] font-semibold text-gray-700 dark:text-slate-300">1. Bukti Mulai</span>
                          {job?.hasMulai ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 font-semibold border border-green-200 dark:border-green-800">Ada</span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 font-semibold">Kosong</span>
                          )}
                        </div>
                        {job?.hasMulai ? (
                          job?.mulaiThumbnail ? (
                            <div
                              onClick={isPhotoRestricted ? undefined : () => openJobLightbox(job, job.mulaiThumbnail!)}
                              className={`w-full aspect-video rounded-lg overflow-hidden bg-black/10 dark:bg-black/30 shadow-sm border border-gray-200 dark:border-slate-700 relative ${
                                isPhotoRestricted ? 'cursor-not-allowed select-none' : 'cursor-pointer group hover:border-blue-400'
                              }`}
                              title={isPhotoRestricted ? 'Petugas hanya bisa lihat absensi di hari itu' : 'Klik untuk Zoom / Fullscreen'}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={job.mulaiThumbnail}
                                alt="Bukti Mulai"
                                style={isPhotoRestricted ? { filter: 'blur(14px)' } : undefined}
                                className={`w-full h-full object-cover ${
                                  isPhotoRestricted ? 'scale-110 pointer-events-none' : 'group-hover:scale-105 transition-transform'
                                }`}
                              />
                              {isPhotoRestricted ? (
                                <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-center text-white select-none">
                                  <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center mb-1 text-white shadow-sm ring-1 ring-white/30">
                                    <Eye className="h-4 w-4" />
                                  </div>
                                  <p className="text-[10px] sm:text-[11px] font-semibold text-white leading-tight drop-shadow max-w-[90%]">
                                    Petugas hanya bisa lihat absensi di hari itu
                                  </p>
                                </div>
                              ) : (
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                  <ZoomIn className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                          ) : isPhotoRestricted ? (
                            <div className="w-full aspect-video rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center text-xs text-gray-500 dark:text-slate-400 p-2 text-center select-none">
                              <Eye className="h-5 w-5 mb-1 text-gray-400 dark:text-slate-500" />
                              <span className="text-[10px] font-semibold leading-tight max-w-[90%]">Petugas hanya bisa lihat absensi di hari itu</span>
                            </div>
                          ) : (
                            <div className="w-full aspect-video rounded-lg bg-green-50/70 dark:bg-green-950/40 border border-green-200 dark:border-green-800 flex flex-col items-center justify-center text-xs text-green-700 dark:text-green-400 font-medium p-2">
                              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mb-1" />
                              <span>Foto Ada</span>
                            </div>
                          )
                        ) : (
                          <div className="w-full aspect-video rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-xs text-gray-400 dark:text-slate-500">
                            Kosong
                          </div>
                        )}
                      </div>

                      {/* Bukti 2: Selesai Piket */}
                      <div className="border border-gray-100 dark:border-slate-800 rounded-xl p-2.5 bg-gray-50 dark:bg-slate-800/40 text-center">
                        <div className="flex items-center justify-between mb-1.5 px-0.5">
                          <span className="text-[11px] font-semibold text-gray-700 dark:text-slate-300">2. Bukti Selesai</span>
                          {job?.hasSelesai ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 font-semibold border border-green-200 dark:border-green-800">Ada</span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 font-semibold">Kosong</span>
                          )}
                        </div>
                        {job?.hasSelesai ? (
                          job?.selesaiThumbnail ? (
                            <div
                              onClick={isPhotoRestricted ? undefined : () => openJobLightbox(job, job.selesaiThumbnail!)}
                              className={`w-full aspect-video rounded-lg overflow-hidden bg-black/10 dark:bg-black/30 shadow-sm border border-gray-200 dark:border-slate-700 relative ${
                                isPhotoRestricted ? 'cursor-not-allowed select-none' : 'cursor-pointer group hover:border-blue-400'
                              }`}
                              title={isPhotoRestricted ? 'Petugas hanya bisa lihat absensi di hari itu' : 'Klik untuk Zoom / Fullscreen'}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={job.selesaiThumbnail}
                                alt="Bukti Selesai"
                                style={isPhotoRestricted ? { filter: 'blur(14px)' } : undefined}
                                className={`w-full h-full object-cover ${
                                  isPhotoRestricted ? 'scale-110 pointer-events-none' : 'group-hover:scale-105 transition-transform'
                                }`}
                              />
                              {isPhotoRestricted ? (
                                <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-center text-white select-none">
                                  <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center mb-1 text-white shadow-sm ring-1 ring-white/30">
                                    <Eye className="h-4 w-4" />
                                  </div>
                                  <p className="text-[10px] sm:text-[11px] font-semibold text-white leading-tight drop-shadow max-w-[90%]">
                                    Petugas hanya bisa lihat absensi di hari itu
                                  </p>
                                </div>
                              ) : (
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                  <ZoomIn className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                          ) : isPhotoRestricted ? (
                            <div className="w-full aspect-video rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center text-xs text-gray-500 dark:text-slate-400 p-2 text-center select-none">
                              <Eye className="h-5 w-5 mb-1 text-gray-400 dark:text-slate-500" />
                              <span className="text-[10px] font-semibold leading-tight max-w-[90%]">Petugas hanya bisa lihat absensi di hari itu</span>
                            </div>
                          ) : (
                            <div className="w-full aspect-video rounded-lg bg-green-50/70 dark:bg-green-950/40 border border-green-200 dark:border-green-800 flex flex-col items-center justify-center text-xs text-green-700 dark:text-green-400 font-medium p-2">
                              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mb-1" />
                              <span>Foto Ada</span>
                            </div>
                          )
                        ) : (
                          <div className="w-full aspect-video rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-xs text-gray-400 dark:text-slate-500">
                            Kosong
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bukti 3: Aktivitas Piket (Minimal 2) */}
                    <div className="border border-gray-100 dark:border-slate-800 rounded-xl p-2.5 bg-gray-50 dark:bg-slate-800/40">
                      <div className="flex items-center justify-between mb-2 px-0.5">
                        <span className="text-[11px] font-semibold text-gray-700 dark:text-slate-300">
                          3. Bukti Aktivitas Piket
                        </span>
                        {(job?.aktivitasCount ?? 0) >= 2 ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 font-semibold flex items-center gap-1 border border-green-200 dark:border-green-800">
                            <CheckCircle2 className="h-3 w-3" /> {job?.aktivitasCount} Foto (Lengkap)
                          </span>
                        ) : (job?.aktivitasCount ?? 0) === 1 ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 font-semibold border border-amber-200 dark:border-amber-800">
                            1 / 2 Foto (Kurang 1)
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 font-semibold">
                            Kosong (Min 2)
                          </span>
                        )}
                      </div>

                      {job?.aktivitasThumbnails && job.aktivitasThumbnails.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {job.aktivitasThumbnails.map((url, aIdx) => (
                            <div
                              key={aIdx}
                              onClick={isPhotoRestricted ? undefined : () => openJobLightbox(job, url)}
                              className={`relative aspect-video rounded-lg overflow-hidden bg-black/10 dark:bg-black/30 shadow-xs border border-gray-200 dark:border-slate-700 ${
                                isPhotoRestricted ? 'cursor-not-allowed select-none' : 'cursor-pointer group hover:border-blue-400'
                              }`}
                              title={isPhotoRestricted ? 'Petugas hanya bisa lihat absensi di hari itu' : 'Klik untuk Zoom / Fullscreen'}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={`Aktivitas ${aIdx + 1}`}
                                style={isPhotoRestricted ? { filter: 'blur(14px)' } : undefined}
                                className={`w-full h-full object-cover ${
                                  isPhotoRestricted ? 'scale-110 pointer-events-none' : 'group-hover:scale-105 transition-transform'
                                }`}
                              />
                              {isPhotoRestricted ? (
                                <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center p-1.5 text-center text-white select-none">
                                  <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center mb-1 text-white shadow-sm ring-1 ring-white/30">
                                    <Eye className="h-3.5 w-3.5" />
                                  </div>
                                  <p className="text-[9px] sm:text-[10px] font-semibold text-white drop-shadow leading-tight max-w-[95%]">
                                    Petugas hanya bisa lihat absensi di hari itu
                                  </p>
                                </div>
                              ) : (
                                <>
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                    <ZoomIn className="h-4 w-4" />
                                  </div>
                                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white font-medium">
                                    #{aIdx + 1}
                                  </span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="w-full py-3 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-xs text-gray-400 dark:text-slate-500">
                          Belum ada foto aktivitas
                        </div>
                      )}
                    </div>

                    {/* Catatan jika ada */}
                    {job?.note && (
                      <p className="text-xs text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-gray-100 dark:border-slate-700 italic">
                        &quot;{job.note}&quot;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setDrawerShift(null)}
                className="w-full py-2.5 px-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors min-h-[44px]"
              >
                Tutup Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Preview */}
      <ImageLightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxSlides}
        index={lightboxIndex}
      />
    </div>
  );
}
