import { createClient } from '@/lib/supabase/server';
import { todayWITA, getDatesInMonth, toYearMonth } from '@/lib/dates';
import { getRequiredShifts, JOB_TYPES, type JobType } from '@/lib/shifts';
import { RiwayatView, type RiwayatShiftGroup, type RiwayatJobDetail } from './riwayat-view';
import type { Holiday, Attendance, Attachment, ShiftStatus } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

interface RiwayatPageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function RiwayatPage({ searchParams }: RiwayatPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = todayWITA();
  const params = await searchParams;
  const currentMonth = params.month && /^\d{4}-\d{2}$/.test(params.month)
    ? params.month
    : toYearMonth(today);

  const [currentY, currentM] = currentMonth.split('-').map(Number);
  const prevDate = new Date(Date.UTC(currentY, currentM - 2, 1));
  const nextDate = new Date(Date.UTC(currentY, currentM, 1));
  const prevMonthStr = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
  const nextMonthStr = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}`;

  // Holidays (semua libur nasional tercatat)
  const { data: holidaysData } = await supabase
    .from('holidays')
    .select('*');

  const holidays = (holidaysData ?? []) as Holiday[];
  const holidaySet = new Set(holidays.map((h) => h.holiday_date));
  const holidayMap = new Map(holidays.map((h) => [h.holiday_date, h.name]));

  // Attendances for this month (seluruh piket tercatat di organisasi)
  const { data: attendancesData } = await supabase
    .from('attendances')
    .select('*')
    .gte('work_date', `${currentMonth}-01`)
    .lt('work_date', `${nextMonthStr}-01`);

  const attendances = (attendancesData ?? []) as Attendance[];
  const attendanceIds = attendances.map((a) => a.id);

  // Ambil profil user untuk menampilkan nama petugas pada riwayat & pencarian
  const userIds = Array.from(new Set([...attendances.map((a) => a.user_id), user.id].filter(Boolean) as string[]));
  const { data: profilesData } = userIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)
    : { data: [] };

  const profileMap = new Map<string, string>();
  for (const p of profilesData ?? []) {
    const displayName = p.full_name?.trim() || p.email || 'Petugas';
    profileMap.set(p.id, displayName);
  }

  // Attachments
  const { data: attachmentsData } = attendanceIds.length > 0
    ? await supabase
        .from('attachments')
        .select('*')
        .in('attendance_id', attendanceIds)
    : { data: [] };

  const attachments = (attachmentsData ?? []) as Attachment[];

  // Group attachments by attendance_id
  const attachByAttendance = new Map<string, Attachment[]>();
  for (const att of attachments) {
    if (!attachByAttendance.has(att.attendance_id)) {
      attachByAttendance.set(att.attendance_id, []);
    }
    attachByAttendance.get(att.attendance_id)!.push(att);
  }

  // Pre-generate signed URLs for thumbnails
  const signedUrlMap = new Map<string, string>();
  const pathsToSign = Array.from(new Set(attachments.map((a) => a.storage_path)));
  if (pathsToSign.length > 0) {
    await Promise.all(
      pathsToSign.map(async (path) => {
        try {
          const { data } = await supabase.storage
            .from('evidence')
            .createSignedUrl(path, 3600);
          if (data?.signedUrl) {
            signedUrlMap.set(path, data.signedUrl);
          }
        } catch {
          // ignore error to keep page functional
        }
      })
    );
  }

  // Map attendances by "date-shift-job"
  const attendanceByDateShiftJob = new Map<string, Attendance>();
  for (const a of attendances) {
    attendanceByDateShiftJob.set(`${a.work_date}-${a.shift_type}-${a.job_type || 'marketer'}`, a);
  }

  // Build items for each day in month (descending order, newest first, only today and backwards)
  const dates = getDatesInMonth(currentMonth)
    .filter((d) => d <= today)
    .reverse();

  const items: RiwayatShiftGroup[] = [];

  for (const date of dates) {
    const requiredShifts = getRequiredShifts(date, holidaySet);
    const isHoliday = holidaySet.has(date);
    const holidayName = holidayMap.get(date);

    for (const shift of requiredShifts) {
      const jobs: Record<JobType, RiwayatJobDetail> = {} as Record<JobType, RiwayatJobDetail>;
      let lengkapCount = 0;
      let partiallyFilled = false;

      for (const job of JOB_TYPES) {
        const att = attendanceByDateShiftJob.get(`${date}-${shift}-${job}`);
        const attList = att ? (attachByAttendance.get(att.id) ?? []) : [];

        const mulai = attList.find((a) => a.kind === 'mulai');
        const selesai = attList.find((a) => a.kind === 'selesai');
        const aktivitas = attList.filter((a) => a.kind === 'aktivitas');
        const tickets = attList.filter((a) => a.kind === 'ticket');

        const hasMulai = !!mulai;
        const hasSelesai = !!selesai;
        const aktivitasCount = aktivitas.length;

        let status: ShiftStatus = 'kosong';
        if (hasMulai && hasSelesai && aktivitasCount >= 2) {
          status = 'lengkap';
          lengkapCount++;
        } else if (hasMulai || hasSelesai || aktivitasCount > 0 || tickets.length > 0 || (att?.note && att.note.trim().length > 0)) {
          status = 'sebagian';
          partiallyFilled = true;
        }

        // Nama petugas HANYA diambil jika shift pekerjaan ini tidak kosong (sudah ada yang mengisi)
        const userName = (status !== 'kosong' && att?.user_id) ? (profileMap.get(att.user_id) ?? null) : null;
        const aktivitasThumbnails = aktivitas
          .map((a) => signedUrlMap.get(a.storage_path) ?? null)
          .filter((url): url is string => !!url);

        jobs[job] = {
          id: att?.id,
          job_type: job,
          status,
          note: att?.note ?? null,
          is_locked: !!att?.is_locked,
          hasMulai,
          hasSelesai,
          mulaiThumbnail: mulai ? (signedUrlMap.get(mulai.storage_path) ?? null) : null,
          selesaiThumbnail: selesai ? (signedUrlMap.get(selesai.storage_path) ?? null) : null,
          aktivitasThumbnails,
          aktivitasCount,
          ticketCount: tickets.length,
          userName,
        };
      }

      let overallStatus: ShiftStatus = 'kosong';
      if (lengkapCount === JOB_TYPES.length) {
        overallStatus = 'lengkap';
      } else if (lengkapCount > 0 || partiallyFilled) {
        overallStatus = 'sebagian';
      }

      // Kumpulkan nama petugas HANYA dari pekerjaan yang benar-benar pernah diisi (status !== 'kosong')
      const shiftUserNames = Array.from(
        new Set(
          JOB_TYPES
            .filter((jt) => jobs[jt].status !== 'kosong')
            .map((jt) => jobs[jt].userName)
            .filter((n): n is string => !!n)
        )
      );

      items.push({
        work_date: date,
        shift_type: shift,
        isHoliday,
        holidayName,
        overallStatus,
        jobs,
        userNames: shiftUserNames,
      });
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Riwayat Absensi</h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          Daftar dokumentasi absensi dan foto piket per shift.
        </p>
      </div>

      <RiwayatView
        items={items}
        currentMonth={currentMonth}
        prevMonth={prevMonthStr}
        nextMonth={nextMonthStr}
        currentUserName={profileMap.get(user.id) ?? user.email ?? ''}
      />
    </div>
  );
}
