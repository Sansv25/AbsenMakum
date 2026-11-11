'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatIndonesia } from '@/lib/dates';
import { shiftLabel } from '@/lib/shifts';
import type { ShiftType, ShiftStatus } from '@/lib/supabase/types';
import { CalendarCheck, AlertCircle, Circle, Filter, ChevronLeft, ChevronRight, FileText, Lock } from 'lucide-react';

export interface RiwayatItem {
  id?: string;
  work_date: string;
  shift_type: ShiftType;
  status: ShiftStatus;
  note: string | null;
  is_locked?: boolean;
  mulaiThumbnail: string | null;
  selesaiThumbnail: string | null;
  ticketCount: number;
  isHoliday: boolean;
  holidayName?: string;
}

interface RiwayatViewProps {
  items: RiwayatItem[];
  currentMonth: string;
  prevMonth: string;
  nextMonth: string;
}

export function RiwayatView({ items, currentMonth, prevMonth, nextMonth }: RiwayatViewProps) {
  const [shiftFilter, setShiftFilter] = useState<'all' | ShiftType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ShiftStatus>('all');

  const filtered = items.filter((item) => {
    if (shiftFilter !== 'all' && item.shift_type !== shiftFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Month Navigator */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <Link
          href={`/riwayat?month=${prevMonth}`}
          className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="font-bold text-gray-900 capitalize text-base">
          {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
            new Date(`${currentMonth}-01`)
          )}
        </span>
        <Link
          href={`/riwayat?month=${nextMonth}`}
          className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Bulan berikutnya"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <Filter className="h-3.5 w-3.5" /> Filter Riwayat
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Shift</label>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value as 'all' | ShiftType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            >
              <option value="all">Semua Shift</option>
              <option value="pagi">Shift 1 (Pagi)</option>
              <option value="malam">Shift 2 (Malam)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | ShiftStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            >
              <option value="all">Semua Status</option>
              <option value="lengkap">Lengkap</option>
              <option value="sebagian">Sebagian</option>
              <option value="kosong">Kosong</option>
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">Tidak ada riwayat absensi</p>
            <p className="text-xs text-gray-400 mt-1">Coba ubah filter atau pilih bulan lainnya.</p>
          </div>
        ) : (
          filtered.map((item) => (
            <Link
              key={`${item.work_date}-${item.shift_type}`}
              href={`/absen/${item.work_date}/${item.shift_type}`}
              className="block bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:border-blue-400 transition-all hover:shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm">
                      {shiftLabel(item.shift_type)}
                    </span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
                      item.status === 'lengkap'
                        ? 'bg-green-100 text-green-700'
                        : item.status === 'sebagian'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {item.status}
                    </span>
                    {item.is_locked && (
                      <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Lock className="h-2.5 w-2.5" /> Terkunci
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mt-1">
                    {formatIndonesia(item.work_date)}
                    {item.isHoliday && (
                      <span className="text-red-500 font-medium"> • {item.holidayName}</span>
                    )}
                  </p>

                  {item.note && (
                    <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded-lg line-clamp-1 italic">
                      &quot;{item.note}&quot;
                    </p>
                  )}
                </div>

                {/* Status icon */}
                <div className="flex-shrink-0">
                  {item.status === 'lengkap' ? (
                    <CalendarCheck className="h-5 w-5 text-green-600" />
                  ) : item.status === 'sebagian' ? (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300" />
                  )}
                </div>
              </div>

              {/* Thumbnails */}
              {(item.mulaiThumbnail || item.selesaiThumbnail || item.ticketCount > 0) && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                  {item.mulaiThumbnail && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-black/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.mulaiThumbnail} alt="Mulai" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[10px] text-gray-500">Mulai</span>
                    </div>
                  )}

                  {item.selesaiThumbnail && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-black/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.selesaiThumbnail} alt="Selesai" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[10px] text-gray-500">Selesai</span>
                    </div>
                  )}

                  {item.ticketCount > 0 && (
                    <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-1 rounded-md font-medium">
                      {item.ticketCount} Ticket
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
