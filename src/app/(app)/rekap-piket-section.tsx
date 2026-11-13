'use client';

import { useState, useMemo, useEffect, useTransition, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  CalendarDays,
  CalendarRange,
  Zap,
  Search,
  Table as TableIcon,
  BarChart2,
  TrendingUp,
  Loader2,
  X,
} from 'lucide-react';
import { fetchAttendancesForRangeAction } from './rekap-actions';
import type { Attendance, Attachment, Holiday } from '@/lib/supabase/types';

export interface ProfileRecapSummary {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_approved?: boolean;
  exclude_from_recap?: boolean;
}

interface RekapPiketSectionProps {
  initialProfiles: ProfileRecapSummary[];
  initialAttendances: Attendance[];
  initialAttachments: Attachment[];
  holidays: Holiday[];
  currentMonth: string; // e.g. "2026-11"
  today: string;        // e.g. "2026-11-12"
}

type FilterMode = 'bulanan' | 'mingguan' | 'rentang' | 'preset';
type ViewMode = 'tabel' | 'batang' | 'garis';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function RekapPiketSection({
  initialProfiles,
  initialAttendances,
  initialAttachments,
  holidays,
  currentMonth,
  today,
}: RekapPiketSectionProps) {
  // State Filter Mode
  const [filterMode, setFilterMode] = useState<FilterMode>('bulanan');

  // Nilai Filter
  const [initYear, initMonthNum] = currentMonth.split('-').map(Number);
  const [selectedYear, setSelectedYear] = useState<number>(initYear || 2026);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>((initMonthNum || 11) - 1); // 0-indexed
  const [selectedWeek, setSelectedWeek] = useState<number>(0); // 0 = Semua Minggu, 1..5 = Minggu 1..5

  const [customStartDate, setCustomStartDate] = useState<string>(`${currentMonth}-01`);
  const [customEndDate, setCustomEndDate] = useState<string>(today);

  const [activePreset, setActivePreset] = useState<string>('bulan_ini');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // State Tampilan (Tabel, Batang, Garis)
  const [viewMode, setViewMode] = useState<ViewMode>('tabel');

  // Data State
  const [attendances, setAttendances] = useState<Attendance[]>(initialAttendances);
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [isPending, startTransition] = useTransition();

  // Set Holiday Map & Set
  const holidaySet = useMemo(() => new Set(holidays.map((h) => h.holiday_date)), [holidays]);

  // Hitung rentang tanggal (startDate & endDate) berdasarkan filter yang aktif
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const monthNumStr = pad(selectedMonthIndex + 1);
    const yearMonthStr = `${selectedYear}-${monthNumStr}`;
    const daysInSelectedMonth = new Date(Date.UTC(selectedYear, selectedMonthIndex + 1, 0)).getUTCDate();

    if (filterMode === 'bulanan') {
      return {
        startDate: `${yearMonthStr}-01`,
        endDate: `${yearMonthStr}-${pad(daysInSelectedMonth)}`,
        periodLabel: `${MONTH_NAMES[selectedMonthIndex]} ${selectedYear}`,
      };
    }

    if (filterMode === 'mingguan') {
      if (selectedWeek === 0) {
        return {
          startDate: `${yearMonthStr}-01`,
          endDate: `${yearMonthStr}-${pad(daysInSelectedMonth)}`,
          periodLabel: `Semua Minggu • ${MONTH_NAMES[selectedMonthIndex]} ${selectedYear}`,
        };
      }
      if (selectedWeek === 6) {
        // Minggu Ini (7 hari terakhir dari hari ini)
        const curDate = new Date(`${today}T00:00:00Z`);
        const dayOfWeek = curDate.getUTCDay(); // 0 = Min, 1 = Sen
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const mon = new Date(curDate);
        mon.setUTCDate(curDate.getUTCDate() + diffToMon);
        const sun = new Date(mon);
        sun.setUTCDate(mon.getUTCDate() + 6);

        const sStr = mon.toISOString().slice(0, 10);
        const eStr = sun.toISOString().slice(0, 10);
        return {
          startDate: sStr,
          endDate: eStr,
          periodLabel: `Minggu Ini (${mon.getUTCDate()} - ${sun.getUTCDate()} ${MONTH_NAMES[mon.getUTCMonth()]})`,
        };
      }

      // Minggu 1..5
      const startDay = (selectedWeek - 1) * 7 + 1;
      const endDay = Math.min(selectedWeek * 7, daysInSelectedMonth);
      return {
        startDate: `${yearMonthStr}-${pad(startDay)}`,
        endDate: `${yearMonthStr}-${pad(endDay)}`,
        periodLabel: `Minggu ke-${selectedWeek} (${startDay} - ${endDay} ${MONTH_NAMES[selectedMonthIndex]} ${selectedYear})`,
      };
    }

    if (filterMode === 'rentang') {
      const s = customStartDate || `${currentMonth}-01`;
      const e = customEndDate || today;
      return {
        startDate: s,
        endDate: e,
        periodLabel: `${s} s/d ${e}`,
      };
    }

    // filterMode === 'preset'
    if (activePreset === 'hari_ini') {
      return {
        startDate: today,
        endDate: today,
        periodLabel: `Hari Ini (${today})`,
      };
    }
    if (activePreset === '7_hari') {
      const d = new Date(`${today}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 6);
      const s = d.toISOString().slice(0, 10);
      return {
        startDate: s,
        endDate: today,
        periodLabel: `7 Hari Terakhir (${s} s/d ${today})`,
      };
    }
    if (activePreset === '30_hari') {
      const d = new Date(`${today}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 29);
      const s = d.toISOString().slice(0, 10);
      return {
        startDate: s,
        endDate: today,
        periodLabel: `30 Hari Terakhir (${s} s/d ${today})`,
      };
    }
    if (activePreset === 'bulan_lalu') {
      const prevM = new Date(Date.UTC(initYear, initMonthNum - 2, 1));
      const pYear = prevM.getUTCFullYear();
      const pMon = prevM.getUTCMonth();
      const pDays = new Date(Date.UTC(pYear, pMon + 1, 0)).getUTCDate();
      const s = `${pYear}-${pad(pMon + 1)}-01`;
      const e = `${pYear}-${pad(pMon + 1)}-${pad(pDays)}`;
      return {
        startDate: s,
        endDate: e,
        periodLabel: `Bulan Lalu (${MONTH_NAMES[pMon]} ${pYear})`,
      };
    }

    // Default bulan ini
    return {
      startDate: `${currentMonth}-01`,
      endDate: today,
      periodLabel: `Bulan Ini s/d Hari Ini`,
    };
  }, [
    filterMode,
    selectedMonthIndex,
    selectedYear,
    selectedWeek,
    customStartDate,
    customEndDate,
    activePreset,
    currentMonth,
    today,
    initYear,
    initMonthNum,
  ]);

  // Muat data jika rentang tanggal melampaui bulan yang di-load dari server
  useEffect(() => {
    const isWithinCurrentMonth =
      startDate.startsWith(currentMonth) && endDate.startsWith(currentMonth);

    if (isWithinCurrentMonth) {
      setAttendances(initialAttendances);
      setAttachments(initialAttachments);
      return;
    }

    startTransition(async () => {
      const res = await fetchAttendancesForRangeAction(startDate, endDate);
      if (!res.error) {
        setAttendances(res.attendances);
        setAttachments(res.attachments);
      }
    });
  }, [startDate, endDate, currentMonth, initialAttendances, initialAttachments]);

  // Petugas yang masuk rekapitulasi (dikecualikan jika exclude_from_recap === true)
  const activeProfiles = useMemo(() => {
    return initialProfiles.filter((p) => !p.exclude_from_recap);
  }, [initialProfiles]);

  // Map attachments by attendance_id
  const attachByAttendance = useMemo(() => {
    const map = new Map<string, Attachment[]>();
    for (const att of attachments) {
      if (!map.has(att.attendance_id)) {
        map.set(att.attendance_id, []);
      }
      map.get(att.attendance_id)!.push(att);
    }
    return map;
  }, [attachments]);

  // Periksa apakah sebuah shift attendance valid / selesai
  const isAttendanceDone = useCallback(
    (a: Attendance): boolean => {
      const list = attachByAttendance.get(a.id) ?? [];
      const hasMulai = list.some((att) => att.kind === 'mulai');
      const hasSelesai = list.some((att) => att.kind === 'selesai');
      const hasAktivitas = list.some((att) => att.kind === 'aktivitas');
      const hasNote = !!(a.note && a.note.trim().length > 0);
      return hasMulai || hasSelesai || hasAktivitas || hasNote;
    },
    [attachByAttendance]
  );

  // Rekapitulasi per petugas
  const recapItems = useMemo(() => {
    // Filter attendances yang masuk dalam rentang tanggal
    const inRangeAttendances = attendances.filter(
      (a) => a.work_date >= startDate && a.work_date <= endDate
    );

    const items = activeProfiles.map((p) => {
      const weekdayShifts = new Set<string>();
      const holidayShifts = new Set<string>();

      for (const a of inRangeAttendances) {
        const list = attachByAttendance.get(a.id) ?? [];
        const actualOfficerId = list.length > 0
          ? (list.find((att) => att.user_id)?.user_id ?? a.user_id)
          : a.user_id;

        if (actualOfficerId !== p.id) continue;
        if (!isAttendanceDone(a)) continue;

        const [y, m, d] = a.work_date.split('-').map(Number);
        const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        const isOff = dow === 0 || dow === 6 || holidaySet.has(a.work_date);

        const shiftKey = `${a.work_date}#${a.shift_type}`;
        if (isOff) {
          holidayShifts.add(shiftKey);
        } else {
          weekdayShifts.add(shiftKey);
        }
      }

      const name = p.full_name?.trim() || p.email?.split('@')[0] || 'Petugas';
      return {
        id: p.id,
        name,
        email: p.email,
        role: p.role,
        weekdayShiftsCount: weekdayShifts.size,
        holidayShiftsCount: holidayShifts.size,
        totalShiftsCount: weekdayShifts.size + holidayShifts.size,
      };
    });

    // Urutkan dari total shift terbanyak
    items.sort((a, b) => {
      if (b.totalShiftsCount !== a.totalShiftsCount) {
        return b.totalShiftsCount - a.totalShiftsCount;
      }
      return a.name.localeCompare(b.name);
    });

    // Filter jika ada pencarian nama petugas
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      return items.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (it.email && it.email.toLowerCase().includes(q))
      );
    }

    return items;
  }, [activeProfiles, attendances, attachByAttendance, startDate, endDate, holidaySet, searchQuery, isAttendanceDone]);

  // Total shift akumulasi
  const totalAllWeekdayShifts = useMemo(
    () => recapItems.reduce((acc, curr) => acc + curr.weekdayShiftsCount, 0),
    [recapItems]
  );
  const totalAllHolidayShifts = useMemo(
    () => recapItems.reduce((acc, curr) => acc + curr.holidayShiftsCount, 0),
    [recapItems]
  );
  const totalAllShifts = totalAllWeekdayShifts + totalAllHolidayShifts;

  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-3.5 sm:p-5 space-y-5 w-full min-w-0 overflow-hidden">
      {/* 1. Header (Teks lama sudah dihilangkan) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base sm:text-lg">
              Rekapitulasi Piket Petugas
            </h3>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-medium">
              <Calendar className="h-3 w-3" />
              Periode: <strong>{periodLabel}</strong>
            </span>
            {isPending && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-slate-500 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                Memuat data...
              </span>
            )}
          </div>
        </div>

        {/* Ringkasan Total Akumulasi */}
        <div className="inline-flex items-center gap-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          <span className="text-xs font-semibold text-gray-800 dark:text-slate-200">
            Total: <strong className="text-emerald-600 dark:text-emerald-400">{totalAllShifts}</strong> Shift
            <span className="text-gray-400 dark:text-slate-500 font-normal">
              {' '}({totalAllWeekdayShifts} Biasa • {totalAllHolidayShifts} Libur)
            </span>
          </span>
        </div>
      </div>

      {/* 2. Filter Bar Atas */}
      <div className="space-y-3 bg-gray-50/70 dark:bg-slate-800/40 p-3.5 sm:p-4 rounded-xl border border-gray-100 dark:border-slate-800">
        {/* Tab Mode Filter */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-slate-700 max-w-full overflow-x-auto scrollbar-none shrink-0">
            <button
              type="button"
              onClick={() => setFilterMode('bulanan')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap ${
                filterMode === 'bulanan'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Bulanan</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('mingguan')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap ${
                filterMode === 'mingguan'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Mingguan</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('rentang')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap ${
                filterMode === 'rentang'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              <span>Rentang</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('preset')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap ${
                filterMode === 'preset'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Preset</span>
            </button>
          </div>

          {/* Kolom Pencarian Petugas */}
          <div className="relative w-full sm:w-auto sm:min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama petugas..."
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Kontrol Sesuai Mode Filter yang Dipilih */}
        {filterMode === 'bulanan' && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 dark:text-slate-400">Bulan:</span>
              <select
                value={selectedMonthIndex}
                onChange={(e) => setSelectedMonthIndex(Number(e.target.value))}
                className="py-1.5 px-3 text-xs font-medium rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 dark:text-slate-400">Tahun:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="py-1.5 px-3 text-xs font-medium rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {filterMode === 'mingguan' && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 dark:text-slate-400">Bulan:</span>
              <select
                value={selectedMonthIndex}
                onChange={(e) => setSelectedMonthIndex(Number(e.target.value))}
                className="py-1.5 px-3 text-xs font-medium rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 dark:text-slate-400">Pilih Minggu:</span>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="py-1.5 px-3 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={0}>Semua Minggu (1 Bulan Penuh)</option>
                <option value={1}>Minggu ke-1 (Tgl 1 - 7)</option>
                <option value={2}>Minggu ke-2 (Tgl 8 - 14)</option>
                <option value={3}>Minggu ke-3 (Tgl 15 - 21)</option>
                <option value={4}>Minggu ke-4 (Tgl 22 - 28)</option>
                <option value={5}>Minggu ke-5 (Tgl 29 - Akhir)</option>
                <option value={6}>Minggu Ini (7 Hari Berjalan)</option>
              </select>
            </div>
          </div>
        )}

        {filterMode === 'rentang' && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
              <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0">Dari:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full py-1.5 px-3 text-xs font-medium rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
              <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0">Sampai:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full py-1.5 px-3 text-xs font-medium rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {filterMode === 'preset' && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {[
              { id: 'hari_ini', label: 'Hari Ini' },
              { id: '7_hari', label: '7 Hari Terakhir' },
              { id: '30_hari', label: '30 Hari Terakhir' },
              { id: 'bulan_ini', label: 'Bulan Ini' },
              { id: 'bulan_lalu', label: 'Bulan Lalu' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  activePreset === p.id
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-bold'
                    : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Kartu Ringkasan Shift */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 text-center">
          <span className="text-[11px] text-blue-800 dark:text-blue-300 block font-medium">Hari Biasa</span>
          <span className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-400">
            {totalAllWeekdayShifts}
          </span>
          <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80 block font-medium">Shift</span>
        </div>
        <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 text-center">
          <span className="text-[11px] text-amber-800 dark:text-amber-300 block font-medium">Hari Libur</span>
          <span className="text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-400">
            {totalAllHolidayShifts}
          </span>
          <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 block font-medium">Shift</span>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 text-center">
          <span className="text-[11px] text-emerald-800 dark:text-emerald-300 block font-medium">Total Seluruh</span>
          <span className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-400">
            {totalAllShifts}
          </span>
          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block font-medium">Shift</span>
        </div>
      </div>

      {/* 4. Switcher Tampilan (Tabel, Diagram Batang, Diagram Garis) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
        <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
          Format Visualisasi:
        </span>
        <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 max-w-full overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setViewMode('tabel')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              viewMode === 'tabel'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" />
            <span>Tabel</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('batang')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              viewMode === 'batang'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            <span>
              <span className="hidden sm:inline">Diagram </span>Batang
            </span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('garis')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              viewMode === 'garis'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>
              <span className="hidden sm:inline">Diagram </span>Garis
            </span>
          </button>
        </div>
      </div>

      {/* 5. Konten Tampilan Berdasarkan ViewMode */}
      {recapItems.length === 0 ? (
        <div className="text-center py-8 px-4 bg-gray-50/60 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
            Tidak ada catatan piket untuk periode atau kata kunci pencarian yang dipilih.
          </p>
        </div>
      ) : (
        <>
          {/* ===================== TAMPILAN 1: TABEL ===================== */}
          {viewMode === 'tabel' && (
            <>
              {/* Tampilan Desktop & Tablet: Tabel */}
              <div className="hidden sm:block overflow-hidden rounded-xl border border-gray-100 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300 border-b border-gray-100 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold w-12 text-center">No</th>
                      <th className="py-2.5 px-3 font-semibold">Nama Petugas</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Piket Hari Biasa</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Piket Hari Libur</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Total Piket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {recapItems.map((item, idx) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3 px-3 text-center text-gray-500 dark:text-slate-400 font-medium">
                          {idx === 0 && item.totalShiftsCount > 0 ? (
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-bold">
                              1
                            </span>
                          ) : idx === 1 && item.totalShiftsCount > 0 ? (
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 text-[10px] font-bold">
                              2
                            </span>
                          ) : idx === 2 && item.totalShiftsCount > 0 ? (
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-900/10 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] font-bold">
                              3
                            </span>
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-gray-900 dark:text-slate-100 text-xs sm:text-sm">
                            {item.name}
                          </div>
                          {item.email && (
                            <div className="text-[11px] text-gray-400 dark:text-slate-500 truncate max-w-[220px]">
                              {item.email}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                            {item.weekdayShiftsCount} Shift
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">
                            {item.holidayShiftsCount} Shift
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 text-xs">
                            {item.totalShiftsCount} Shift
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tampilan Mobile: Kartu Ringkas */}
              <div className="sm:hidden space-y-2.5">
                {recapItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-[10px] font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-gray-900 dark:text-slate-100 truncate">
                            {item.name}
                          </p>
                          {item.email && (
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">
                              {item.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                        {item.totalShiftsCount} Shift
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60 dark:border-slate-700/60 text-center">
                      <div className="p-1.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60">
                        <span className="text-[10px] text-gray-500 dark:text-slate-400 block font-medium">Hari Biasa</span>
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                          {item.weekdayShiftsCount} Shift
                        </span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60">
                        <span className="text-[10px] text-gray-500 dark:text-slate-400 block font-medium">Hari Libur</span>
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                          {item.holidayShiftsCount} Shift
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ===================== TAMPILAN 2: DIAGRAM BATANG ===================== */}
          {viewMode === 'batang' && (
            <div className="space-y-4">
              {/* Legend Batang */}
              <div className="flex items-center justify-between text-xs bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 flex-wrap gap-3">
                <span className="font-semibold text-gray-700 dark:text-slate-300">Legend Batang:</span>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-blue-500" />
                    <span className="text-gray-600 dark:text-slate-400">Hari Biasa (Bawah)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-yellow-400" />
                    <span className="text-gray-600 dark:text-slate-400">Hari Libur (Atas)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-emerald-500" />
                    <span className="text-gray-600 dark:text-slate-400">Total</span>
                  </div>
                </div>
              </div>

              {/* Vertical Stacked Column Chart (Diagram Batang Bertumpuk Bawah ke Atas) */}
              <div className="w-full max-w-full min-w-0 bg-gray-50/70 dark:bg-slate-800/40 p-3 sm:p-4 rounded-xl border border-gray-100 dark:border-slate-800 overflow-x-auto overscroll-x-contain touch-pan-x">
                <div className="min-w-[500px]">
                  {recapItems.length === 0 ? (
                    <p className="text-xs text-center py-6 text-gray-500">Tidak ada data petugas.</p>
                  ) : (
                    (() => {
                      const maxVal = Math.max(...recapItems.map((r) => r.totalShiftsCount), 4);
                      const tickStep = maxVal <= 6 ? 2 : maxVal <= 12 ? 3 : Math.ceil(maxVal / 4);
                      const yMax = Math.ceil(maxVal / tickStep) * tickStep;
                      const ticks: number[] = [];
                      for (let t = 0; t <= yMax; t += tickStep) {
                        ticks.push(t);
                      }

                      const chartH = 220;
                      const padL = 35;
                      const padR = 20;
                      const padT = 30;
                      const padB = 45;
                      const plotW = Math.max(500, recapItems.length * 80 + 50) - padL - padR;
                      const plotH = chartH - padT - padB;
                      const totalW = padL + plotW + padR;

                      const colWidth = plotW / Math.max(recapItems.length, 1);
                      const barW = Math.min(Math.max(colWidth * 0.42, 22), 34);

                      const baselineY = padT + plotH;

                      return (
                        <svg viewBox={`0 0 ${totalW} ${chartH}`} className="w-full h-56 select-none">
                          {/* Gridlines */}
                          {ticks.map((tick) => {
                            const y = padT + plotH - (tick / yMax) * plotH;
                            return (
                              <g key={tick}>
                                <line
                                  x1={padL}
                                  y1={y}
                                  x2={totalW - padR}
                                  y2={y}
                                  stroke="currentColor"
                                  className="text-gray-200 dark:text-slate-700"
                                  strokeDasharray="3 3"
                                />
                                <text
                                  x={padL - 6}
                                  y={y + 3}
                                  textAnchor="end"
                                  className="text-[9px] fill-gray-400 dark:fill-slate-500 font-medium"
                                >
                                  {tick}
                                </text>
                              </g>
                            );
                          })}

                          {/* Baseline */}
                          <line
                            x1={padL}
                            y1={baselineY}
                            x2={totalW - padR}
                            y2={baselineY}
                            stroke="currentColor"
                            className="text-gray-300 dark:text-slate-600"
                            strokeWidth="1.5"
                          />

                          {/* Stacked Bars for each Officer */}
                          {recapItems.map((r, i) => {
                            const groupCenterX = padL + i * colWidth + colWidth / 2;
                            const barX = groupCenterX - barW / 2;

                            const weekday = r.weekdayShiftsCount;
                            const holiday = r.holidayShiftsCount;
                            const total = r.totalShiftsCount;

                            const blueH = (weekday / yMax) * plotH;
                            const yellowH = (holiday / yMax) * plotH;
                            const totalH = blueH + yellowH;

                            const blueY = baselineY - blueH;
                            const yellowY = baselineY - totalH;

                            const shortName = r.name.split(' ')[0] || r.name;

                            return (
                              <g key={r.id} className="group">
                                {/* Total badge on top of stacked bar */}
                                <text
                                  x={groupCenterX}
                                  y={total > 0 ? yellowY - 8 : baselineY - 8}
                                  textAnchor="middle"
                                  className={`text-[10px] font-bold ${
                                    total > 0
                                      ? 'fill-emerald-600 dark:fill-emerald-400'
                                      : 'fill-gray-400 dark:fill-slate-500 font-normal'
                                  }`}
                                >
                                  {total} Total
                                </text>

                                {/* Bagian Bawah: Hari Biasa (Biru) */}
                                {weekday > 0 && (
                                  <rect
                                    x={barX}
                                    y={blueY}
                                    width={barW}
                                    height={blueH}
                                    rx={holiday > 0 ? 0 : 4}
                                    ry={holiday > 0 ? 0 : 4}
                                    fill="#3b82f6"
                                    className="hover:opacity-90 transition-opacity"
                                  />
                                )}

                                {/* Bagian Atas: Hari Libur (Kuning) - Bertumpuk tepat di atas Biru */}
                                {holiday > 0 && (
                                  <rect
                                    x={barX}
                                    y={yellowY}
                                    width={barW}
                                    height={yellowH}
                                    rx={4}
                                    ry={4}
                                    fill="#facc15"
                                    className="hover:opacity-90 transition-opacity"
                                  />
                                )}

                                {/* Angka nilai di dalam batang jika tingginya cukup */}
                                {weekday > 0 && blueH >= 14 && (
                                  <text
                                    x={groupCenterX}
                                    y={blueY + blueH / 2 + 4}
                                    textAnchor="middle"
                                    className="text-[10px] font-bold fill-white pointer-events-none"
                                  >
                                    {weekday}
                                  </text>
                                )}
                                {holiday > 0 && yellowH >= 14 && (
                                  <text
                                    x={groupCenterX}
                                    y={yellowY + yellowH / 2 + 4}
                                    textAnchor="middle"
                                    className="text-[10px] font-bold fill-yellow-950 pointer-events-none"
                                  >
                                    {holiday}
                                  </text>
                                )}

                                {/* Officer Name below baseline */}
                                <text
                                  x={groupCenterX}
                                  y={baselineY + 16}
                                  textAnchor="middle"
                                  className="text-[10px] font-semibold fill-gray-900 dark:fill-slate-100"
                                >
                                  {shortName.length > 8 ? `${shortName.slice(0, 7)}..` : shortName}
                                </text>
                                <text
                                  x={groupCenterX}
                                  y={baselineY + 28}
                                  textAnchor="middle"
                                  className="text-[9px] fill-gray-400 dark:fill-slate-500"
                                >
                                  #{i + 1}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===================== TAMPILAN 3: DIAGRAM GARIS ===================== */}
          {viewMode === 'garis' && (
            <div className="space-y-4">
              {/* Legend Garis */}
              <div className="flex items-center justify-between text-xs bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 flex-wrap gap-3">
                <span className="font-semibold text-gray-700 dark:text-slate-300">
                  Perbandingan Piket Petugas:
                </span>
                <div className="flex items-center gap-4 text-xs flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-4 rounded-full bg-blue-500" />
                    <span className="text-gray-600 dark:text-slate-400">Hari Biasa</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-4 rounded-full bg-yellow-400" />
                    <span className="text-gray-600 dark:text-slate-400">Hari Libur</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-4 rounded-full bg-emerald-500" />
                    <span className="text-gray-600 dark:text-slate-400">Total</span>
                  </div>
                </div>
              </div>

              {/* Kurva Perbandingan Petugas */}
              <div className="w-full max-w-full min-w-0 bg-gray-50/70 dark:bg-slate-800/40 p-3 sm:p-4 rounded-xl border border-gray-100 dark:border-slate-800 overflow-x-auto overscroll-x-contain touch-pan-x">
                <div className="min-w-[500px]">
                  {recapItems.length === 0 ? (
                    <p className="text-xs text-center py-6 text-gray-500">Tidak ada data petugas.</p>
                  ) : (
                    (() => {
                      const maxVal = Math.max(...recapItems.map((r) => r.totalShiftsCount), 4);
                      const tickStep = maxVal <= 6 ? 2 : maxVal <= 12 ? 3 : Math.ceil(maxVal / 4);
                      const yMax = Math.ceil(maxVal / tickStep) * tickStep;
                      const ticks: number[] = [];
                      for (let t = 0; t <= yMax; t += tickStep) {
                        ticks.push(t);
                      }

                      const chartH = 190;
                      const padL = 35;
                      const padR = 25;
                      const padT = 25;
                      const padB = 40;
                      const plotW = Math.max(500, recapItems.length * 75 + 40) - padL - padR;
                      const plotH = chartH - padT - padB;
                      const totalW = padL + plotW + padR;

                      const stepX = recapItems.length > 1 ? plotW / (recapItems.length - 1) : plotW / 2;

                      const getX = (idx: number) => (recapItems.length > 1 ? padL + idx * stepX : padL + plotW / 2);
                      const getY = (val: number) => padT + plotH - (val / yMax) * plotH;

                      const pointsWeekday = recapItems.map((r, i) => `${getX(i)},${getY(r.weekdayShiftsCount)}`).join(' ');
                      const pointsHoliday = recapItems.map((r, i) => `${getX(i)},${getY(r.holidayShiftsCount)}`).join(' ');
                      const pointsTotal = recapItems.map((r, i) => `${getX(i)},${getY(r.totalShiftsCount)}`).join(' ');

                      return (
                        <svg viewBox={`0 0 ${totalW} ${chartH}`} className="w-full h-52 select-none">
                          {/* Gridlines */}
                          {ticks.map((tick) => {
                            const y = padT + plotH - (tick / yMax) * plotH;
                            return (
                              <g key={tick}>
                                <line
                                  x1={padL}
                                  y1={y}
                                  x2={totalW - padR}
                                  y2={y}
                                  stroke="currentColor"
                                  className="text-gray-200 dark:text-slate-700"
                                  strokeDasharray="3 3"
                                />
                                <text
                                  x={padL - 6}
                                  y={y + 3}
                                  textAnchor="end"
                                  className="text-[9px] fill-gray-400 dark:fill-slate-500 font-medium"
                                >
                                  {tick}
                                </text>
                              </g>
                            );
                          })}

                          {/* Lines */}
                          <polyline
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={pointsWeekday}
                          />
                          <polyline
                            fill="none"
                            stroke="#facc15"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={pointsHoliday}
                          />
                          <polyline
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={pointsTotal}
                          />

                          {/* Points & Labels */}
                          {recapItems.map((r, i) => {
                            const x = getX(i);
                            const yTotal = getY(r.totalShiftsCount);
                            const yWeekday = getY(r.weekdayShiftsCount);
                            const yHoliday = getY(r.holidayShiftsCount);
                            const shortName = r.name.split(' ')[0] || r.name;

                            return (
                              <g key={r.id}>
                                {/* Titik Hari Biasa */}
                                <circle
                                  cx={x}
                                  cy={yWeekday}
                                  r="3"
                                  className="fill-blue-500 stroke-white dark:stroke-slate-900 stroke-1.5"
                                />
                                {/* Titik Hari Libur */}
                                <circle
                                  cx={x}
                                  cy={yHoliday}
                                  r="3"
                                  className="fill-yellow-400 stroke-white dark:stroke-slate-900 stroke-1.5"
                                />
                                {/* Titik Total */}
                                <circle
                                  cx={x}
                                  cy={yTotal}
                                  r="4"
                                  className="fill-emerald-500 stroke-white dark:stroke-slate-900 stroke-2"
                                />

                                {/* Label Total Nilai */}
                                <text
                                  x={x}
                                  y={yTotal - 8}
                                  textAnchor="middle"
                                  className="text-[9px] fill-emerald-600 dark:fill-emerald-400 font-bold"
                                >
                                  {r.totalShiftsCount}
                                </text>

                                {/* Nama Petugas */}
                                <text
                                  x={x}
                                  y={chartH - 14}
                                  textAnchor="middle"
                                  className="text-[9px] fill-gray-600 dark:fill-slate-300 font-semibold"
                                >
                                  {shortName.length > 7 ? `${shortName.slice(0, 6)}..` : shortName}
                                </text>
                                <text
                                  x={x}
                                  y={chartH - 4}
                                  textAnchor="middle"
                                  className="text-[8px] fill-gray-400 dark:fill-slate-500"
                                >
                                  #{i + 1}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
