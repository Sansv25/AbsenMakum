import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { todayWITA, formatIndonesia, getDatesInMonth, toYearMonth } from '@/lib/dates';
import { getRequiredShifts, shiftLabel, JOB_TYPES, jobLabel } from '@/lib/shifts';
import Link from 'next/link';
import type { Holiday, Attendance } from '@/lib/supabase/types';
import { CalendarCheck, AlertCircle, Circle, ChevronLeft, ChevronRight } from 'lucide-react';

interface DashboardPageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const today = todayWITA();
  const params = await searchParams;
  const currentMonth = params.month && /^\d{4}-\d{2}$/.test(params.month)
    ? params.month
    : toYearMonth(today);

  // Calculate previous and next months
  const [currentY, currentM] = currentMonth.split('-').map(Number);
  const prevDate = new Date(Date.UTC(currentY, currentM - 2, 1));
  const nextDate = new Date(Date.UTC(currentY, currentM, 1));
  const prevMonthStr = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
  const nextMonthStr = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}`;

  // Ambil holidays bulan ini & hari ini
  const { data: holidaysData } = await supabase
    .from('holidays')
    .select('*');

  const holidays = (holidaysData ?? []) as Holiday[];
  const holidaySet = new Set(holidays.map((h) => h.holiday_date));
  const holidayMap = new Map(holidays.map((h) => [h.holiday_date, h.name]));

  // Ambil semua absensi bulan terpilih
  const { data: attendancesData } = await supabase
    .from('attendances')
    .select('id, work_date, shift_type, job_type, note, created_at, updated_at, user_id')
    .gte('work_date', `${currentMonth}-01`)
    .lte('work_date', `${currentMonth}-31`);

  const attendances = (attendancesData ?? []) as Attendance[];

  // Ambil attachments untuk semua absensi bulan ini
  const attendanceIds = attendances.map((a) => a.id);
  const { data: attachmentsData } = attendanceIds.length > 0
    ? await supabase
        .from('attachments')
        .select('id, attendance_id, kind')
        .in('attendance_id', attendanceIds)
    : { data: [] };

  // Map: attendanceId -> set of kinds
  const kindsByAttendance = new Map<string, Set<string>>();
  for (const att of attachmentsData ?? []) {
    if (!kindsByAttendance.has(att.attendance_id)) {
      kindsByAttendance.set(att.attendance_id, new Set());
    }
    kindsByAttendance.get(att.attendance_id)!.add(att.kind);
  }

  // Map: "date-shift-job" -> status
  const attendanceMap = new Map<string, { status: string; id: string }>();
  for (const a of attendances) {
    const kinds = kindsByAttendance.get(a.id) ?? new Set();
    const hasMulai = kinds.has('mulai');
    const hasSelesai = kinds.has('selesai');
    const status = hasMulai && hasSelesai ? 'lengkap' : hasMulai || hasSelesai ? 'sebagian' : 'kosong';
    attendanceMap.set(`${a.work_date}-${a.shift_type}-${a.job_type || 'marketer'}`, { status, id: a.id });
  }

  // Hari ini data
  const requiredShiftsToday = getRequiredShifts(today, holidaySet);
  const isHolidayToday = holidaySet.has(today);
  const [ty, tm, td] = today.split('-').map(Number);
  const dowToday = new Date(Date.UTC(ty, tm - 1, td)).getUTCDay();
  const isWeekendToday = dowToday === 0 || dowToday === 6;

  let dayTypeLabel = 'Hari Kerja';
  if (isHolidayToday) dayTypeLabel = `Tanggal Merah — ${holidayMap.get(today)}`;
  else if (isWeekendToday) dayTypeLabel = 'Akhir Pekan';

  const datesInMonth = getDatesInMonth(currentMonth);

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      {/* Kartu Hari Ini */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">Hari ini</p>
          <h2 className="text-xl font-bold text-gray-900 mt-0.5">{formatIndonesia(today)}</h2>
          <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            isHolidayToday
              ? 'bg-red-100 text-red-700'
              : isWeekendToday
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {dayTypeLabel}
          </span>
        </div>

        <div className="space-y-4">
          {requiredShiftsToday.map((shift) => {
            return (
              <div
                key={shift}
                className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
                  <p className="font-bold text-gray-900 text-sm">{shiftLabel(shift)}</p>
                  <span className="text-[11px] text-gray-500 font-medium">3 Pekerjaan</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {JOB_TYPES.map((job) => {
                    const key = `${today}-${shift}-${job}`;
                    const att = attendanceMap.get(key);
                    const status = att?.status ?? 'kosong';

                    return (
                      <div
                        key={job}
                        className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <StatusIcon status={status} />
                          <div>
                            <p className="font-semibold text-gray-800 text-xs sm:text-sm">
                              {jobLabel(job)}
                            </p>
                            <p className={`text-[11px] capitalize font-medium ${statusColor(status)}`}>
                              {status}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/absen/${today}/${shift}?job=${job}`}
                          className="text-xs font-semibold px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-colors min-h-[36px] flex items-center"
                        >
                          {status === 'kosong' ? 'Isi Absen' : 'Lihat / Edit'}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Kalender Bulanan */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 capitalize">
            {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
              new Date(`${currentMonth}-01`)
            )}
          </h3>

          <div className="flex items-center gap-1">
            <Link
              href={`/?month=${prevMonthStr}`}
              className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <Link
              href={`/?month=${nextMonthStr}`}
              className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-500 mb-4 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span>Lengkap</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            <span>Sebagian</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            <span>Terlewat</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gray-200" />
            <span>Belum tiba</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => (
            <div key={d} className="font-semibold py-1">{d}</div>
          ))}
        </div>

        <CalendarGrid
          dates={datesInMonth}
          today={today}
          holidaySet={holidaySet}
          attendanceMap={attendanceMap}
        />
      </section>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'lengkap') return <CalendarCheck className="h-5 w-5 text-green-600" />;
  if (status === 'sebagian') return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  return <Circle className="h-5 w-5 text-gray-400" />;
}

function statusColor(status: string): string {
  if (status === 'lengkap') return 'text-green-600';
  if (status === 'sebagian') return 'text-yellow-600';
  return 'text-gray-400';
}

function CalendarGrid({
  dates,
  today,
  holidaySet,
  attendanceMap,
}: {
  dates: string[];
  today: string;
  holidaySet: Set<string>;
  attendanceMap: Map<string, { status: string; id: string }>;
}) {
  const firstDate = dates[0];
  const [fy, fm, fd] = firstDate.split('-').map(Number);
  const startDow = new Date(Date.UTC(fy, fm - 1, fd)).getUTCDay();

  const cells: (string | null)[] = [...Array(startDow).fill(null), ...dates];

  return (
    <div className="grid grid-cols-7 gap-1">
      {cells.map((dateStr, idx) => {
        if (!dateStr) return <div key={`empty-${idx}`} />;

        const [y, m, d] = dateStr.split('-').map(Number);
        const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        const isWeekend = dow === 0 || dow === 6;
        const isHoliday = holidaySet.has(dateStr);
        const isOff = isWeekend || isHoliday;
        const isToday = dateStr === today;
        const isPast = dateStr < today;

        const requiredShifts = isOff ? ['pagi', 'malam'] : ['malam'];
        const statuses: string[] = [];
        for (const s of requiredShifts) {
          for (const j of JOB_TYPES) {
            statuses.push(attendanceMap.get(`${dateStr}-${s}-${j}`)?.status ?? 'kosong');
          }
        }

        let dotColor = 'bg-gray-200';
        if (isPast || isToday) {
          if (statuses.every((s) => s === 'lengkap')) dotColor = 'bg-green-500';
          else if (statuses.some((s) => s !== 'kosong')) dotColor = 'bg-yellow-400';
          else if (isPast) dotColor = 'bg-red-400';
        }

        // Link directly to the primary required shift or first shift
        const targetShift = requiredShifts[0];

        return (
          <Link
            key={dateStr}
            href={`/absen/${dateStr}/${targetShift}`}
            className={`relative flex flex-col items-center py-2 rounded-xl text-xs transition-colors min-h-[48px] ${
              isToday ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:bg-gray-100'
            } ${isHoliday ? 'text-red-600 font-bold' : isWeekend ? 'text-orange-600 font-semibold' : 'text-gray-700'}`}
          >
            <span className={`font-medium ${isToday ? 'text-blue-700 font-bold' : ''}`}>
              {d}
            </span>
            <span className={`mt-1 h-1.5 w-1.5 rounded-full ${dotColor}`} />
          </Link>
        );
      })}
    </div>
  );
}
