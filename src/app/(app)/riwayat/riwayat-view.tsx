'use client';

import { useState } from 'react';
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
} from 'lucide-react';

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
}

export function RiwayatView({ items, currentMonth, prevMonth, nextMonth }: RiwayatViewProps) {
  const [shiftFilter, setShiftFilter] = useState<'all' | ShiftType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ShiftStatus>('all');
  const [searchName, setSearchName] = useState('');
  const [pageSize, setPageSize] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [drawerShift, setDrawerShift] = useState<RiwayatShiftGroup | null>(null);

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
      <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <Link
          href={`/riwayat?month=${prevMonth}`}
          className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Bulan Riwayat</p>
          <span className="font-bold text-gray-900 capitalize text-base">
            {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
              new Date(`${currentMonth}-01`)
            )}
          </span>
        </div>
        <Link
          href={`/riwayat?month=${nextMonth}`}
          className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Bulan berikutnya"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      {/* 2. Filter & Pagination Sizer Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <Filter className="h-3.5 w-3.5" /> Filter & Pencarian
          </div>
          <span className="text-[11px] text-gray-400 font-medium">
            {totalItems} shift tercatat
          </span>
        </div>

        {/* Input Pencarian Berdasarkan Nama Petugas */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchName}
            onChange={(e) => {
              setSearchName(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Cari berdasarkan nama petugas..."
            className="w-full pl-10 pr-9 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px]"
          />
          {searchName && (
            <button
              type="button"
              onClick={() => {
                setSearchName('');
                setCurrentPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              aria-label="Hapus pencarian"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Shift</label>
            <select
              value={shiftFilter}
              onChange={(e) => handleFilterShift(e.target.value as 'all' | ShiftType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px]"
            >
              <option value="all">Semua Shift</option>
              <option value="pagi">Shift 1 (Pagi)</option>
              <option value="malam">Shift 2 (Malam)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Status Shift</label>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterStatus(e.target.value as 'all' | ShiftStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px]"
            >
              <option value="all">Semua Status</option>
              <option value="lengkap">Lengkap</option>
              <option value="sebagian">Sebagian</option>
              <option value="kosong">Kosong</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Per Halaman</label>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px]"
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
          <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700">
              {searchName ? 'Tidak ada petugas yang cocok' : 'Tidak ada riwayat absensi'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
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
                className="mt-3 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition-colors"
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
                className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-gray-900 text-sm sm:text-base">
                        {shiftLabel(item.shift_type)}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                          item.overallStatus === 'lengkap'
                            ? 'bg-green-100 text-green-700'
                            : item.overallStatus === 'sebagian'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {item.overallStatus}
                      </span>
                      {item.isHoliday && (
                        <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                          Libur: {item.holidayName}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 font-medium">
                      {formatIndonesia(item.work_date)}
                    </p>

                    {/* Petugas Piket */}
                    {item.userNames && item.userNames.length > 0 ? (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-700">
                        <User className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                        <span className="truncate">
                          Petugas: <strong className="text-gray-900 font-semibold">{item.userNames.join(', ')}</strong>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
                        <User className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
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
                            className="bg-gray-50/80 border border-gray-100 rounded-xl p-2 flex flex-col items-center text-center group-hover:bg-blue-50/40 transition-colors"
                          >
                            <span className="text-[11px] font-semibold text-gray-800">
                              {jobLabel(jt)}
                            </span>
                            <span
                              className={`text-[10px] font-medium capitalize mt-0.5 ${
                                status === 'lengkap'
                                  ? 'text-green-600'
                                  : status === 'sebagian'
                                  ? 'text-yellow-600'
                                  : 'text-gray-400'
                              }`}
                            >
                              {status}
                            </span>
                            {job?.userName && (
                              <span
                                className="text-[9px] text-gray-600 font-medium truncate max-w-full mt-1 px-1 bg-white rounded border border-gray-200/60"
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
                    <div className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Layers className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] text-gray-400 group-hover:text-blue-600 font-semibold mt-1">
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
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p className="text-gray-500">
            Menampilkan <strong>{totalItems === 0 ? 0 : startIndex + 1}</strong> &ndash;{' '}
            <strong>{endIndex}</strong> dari <strong>{totalItems}</strong> shift
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="px-3 py-1.5 border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors min-h-[38px] flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Sebelumnya
            </button>

            <span className="px-2 font-semibold text-gray-700">
              {safeCurrentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="px-3 py-1.5 border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors min-h-[38px] flex items-center gap-1"
            >
              Berikutnya <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 5. DRAWER SLIDE-OVER (3 Pekerjaan per Shift) */}
      {drawerShift && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
          onClick={() => setDrawerShift(null)}
        >
          <div
            className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-lg">
                    {shiftLabel(drawerShift.shift_type)}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                      drawerShift.overallStatus === 'lengkap'
                        ? 'bg-green-100 text-green-700'
                        : drawerShift.overallStatus === 'sebagian'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {drawerShift.overallStatus}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatIndonesia(drawerShift.work_date)}
                  {drawerShift.isHoliday && (
                    <span className="text-red-600 font-semibold"> • {drawerShift.holidayName}</span>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDrawerShift(null)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Tutup Drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body (3 Posisi Pekerjaan) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Dokumentasi 3 Posisi Pekerjaan
              </p>

              {JOB_TYPES.map((jt) => {
                const job = drawerShift.jobs[jt];
                const status = job?.status ?? 'kosong';

                return (
                  <div
                    key={jt}
                    className="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">
                            {jobLabel(jt)}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                              status === 'lengkap'
                                ? 'bg-green-100 text-green-700'
                                : status === 'sebagian'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                        {job?.userName ? (
                          <p className="text-xs text-gray-600 mt-1 flex items-center gap-1 font-medium">
                            <User className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                            <span>Petugas: <strong className="text-gray-900 font-semibold">{job.userName}</strong></span>
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1 italic flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                            <span>Belum ada petugas</span>
                          </p>
                        )}
                      </div>

                      <Link
                        href={`/absen/${drawerShift.work_date}/${drawerShift.shift_type}?job=${jt}`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline flex-shrink-0 mt-0.5"
                      >
                        Buka Form <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>

                    {/* 2 Bukti Piket (Mulai & Selesai) */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {/* Bukti 1: Mulai Piket */}
                      <div className="border border-gray-100 rounded-xl p-2.5 bg-gray-50 text-center">
                        <div className="flex items-center justify-between mb-1.5 px-0.5">
                          <span className="text-[11px] font-semibold text-gray-700">1. Bukti Mulai</span>
                          {job?.hasMulai ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold">Ada</span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 font-semibold">Kosong</span>
                          )}
                        </div>
                        {job?.hasMulai ? (
                          job?.mulaiThumbnail ? (
                            <div className="w-full aspect-video rounded-lg overflow-hidden bg-black/10 shadow-sm">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={job.mulaiThumbnail} alt="Bukti Mulai" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-full aspect-video rounded-lg bg-green-50/70 border border-green-200 flex flex-col items-center justify-center text-xs text-green-700 font-medium p-2">
                              <CheckCircle2 className="h-5 w-5 text-green-600 mb-1" />
                              <span>Foto Ada</span>
                            </div>
                          )
                        ) : (
                          <div className="w-full aspect-video rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                            Kosong
                          </div>
                        )}
                      </div>

                      {/* Bukti 2: Selesai Piket */}
                      <div className="border border-gray-100 rounded-xl p-2.5 bg-gray-50 text-center">
                        <div className="flex items-center justify-between mb-1.5 px-0.5">
                          <span className="text-[11px] font-semibold text-gray-700">2. Bukti Selesai</span>
                          {job?.hasSelesai ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold">Ada</span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 font-semibold">Kosong</span>
                          )}
                        </div>
                        {job?.hasSelesai ? (
                          job?.selesaiThumbnail ? (
                            <div className="w-full aspect-video rounded-lg overflow-hidden bg-black/10 shadow-sm">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={job.selesaiThumbnail} alt="Bukti Selesai" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-full aspect-video rounded-lg bg-green-50/70 border border-green-200 flex flex-col items-center justify-center text-xs text-green-700 font-medium p-2">
                              <CheckCircle2 className="h-5 w-5 text-green-600 mb-1" />
                              <span>Foto Ada</span>
                            </div>
                          )
                        ) : (
                          <div className="w-full aspect-video rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                            Kosong
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bukti 3: Aktivitas Piket (Minimal 2) */}
                    <div className="border border-gray-100 rounded-xl p-2.5 bg-gray-50">
                      <div className="flex items-center justify-between mb-2 px-0.5">
                        <span className="text-[11px] font-semibold text-gray-700">
                          3. Bukti Aktivitas Piket
                        </span>
                        {(job?.aktivitasCount ?? 0) >= 2 ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {job?.aktivitasCount} Foto (Lengkap)
                          </span>
                        ) : (job?.aktivitasCount ?? 0) === 1 ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                            1 / 2 Foto (Kurang 1)
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 font-semibold">
                            Kosong (Min 2)
                          </span>
                        )}
                      </div>

                      {job?.aktivitasThumbnails && job.aktivitasThumbnails.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {job.aktivitasThumbnails.map((url, aIdx) => (
                            <div key={aIdx} className="relative aspect-video rounded-lg overflow-hidden bg-black/10 shadow-xs">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`Aktivitas ${aIdx + 1}`} className="w-full h-full object-cover" />
                              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white font-medium">
                                #{aIdx + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="w-full py-3 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                          Belum ada foto aktivitas
                        </div>
                      )}
                    </div>

                    {/* Catatan jika ada */}
                    {job?.note && (
                      <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100 italic">
                        &quot;{job.note}&quot;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-100 bg-white">
              <button
                type="button"
                onClick={() => setDrawerShift(null)}
                className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold transition-colors min-h-[44px]"
              >
                Tutup Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
