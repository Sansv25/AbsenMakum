import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getHolidays } from '@/lib/data/holidays';
import { getAttendanceWithAttachments } from '@/lib/data/attendance';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { getRequiredShifts, shiftLabel, JOB_TYPES, jobLabel, type JobType } from '@/lib/shifts';
import { formatIndonesia, todayWITA } from '@/lib/dates';
import { AttendanceFormClient } from './attendance-form-client';
import { AttendanceOfficerCard } from '@/components/attendance/attendance-officer-card';
import type { ShiftType } from '@/lib/supabase/types';
import { ArrowLeft, AlertCircle, ShieldAlert, Sun, Moon } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    date: string;
    shift: string;
  }>;
  searchParams: Promise<{
    job?: string;
  }>;
}

export default async function AbsenPage({ params, searchParams }: PageProps) {
  const { date, shift } = await params;
  const { job } = await searchParams;

  // Validate shift param
  if (shift !== 'pagi' && shift !== 'malam') {
    notFound();
  }

  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    notFound();
  }

  const shiftType = shift as ShiftType;
  const validJobs: JobType[] = JOB_TYPES;
  const jobType: JobType = validJobs.includes(job as JobType) ? (job as JobType) : 'marketer';

  const supabase = await createClient();
  const { isMaster, fullName, email } = await getCurrentUserProfile();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const today = todayWITA();

  // Fetch holidays for date
  const year = Number(date.split('-')[0]);
  const holidays = await getHolidays(year);
  const holidaySet = new Set(holidays.map((h) => h.holiday_date));
  const holiday = holidays.find((h) => h.holiday_date === date);

  const requiredShifts = getRequiredShifts(date, holidaySet);
  const isRequired = requiredShifts.includes(shiftType);

  // Fetch attendance record for this date, shift, and job
  const { attendance, error } = await getAttendanceWithAttachments(date, shiftType, jobType);

  if (error || !attendance) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700">
          <AlertCircle className="h-10 w-10 mx-auto mb-2 text-red-500" />
          <h2 className="font-semibold text-base mb-1">Gagal Membuka Halaman</h2>
          <p className="text-xs mb-4">{error ?? 'Terjadi kesalahan sistem.'}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const hasExistingData = attendance.attachments.length > 0 || !!attendance.note;

  // Guard: if not required and no existing data, deny access
  if (!isRequired && !hasExistingData) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <ShieldAlert className="h-12 w-12 mx-auto text-amber-500" />
          <div>
            <h2 className="font-bold text-gray-900 dark:text-slate-100 text-lg">Shift Tidak Diwajibkan</h2>
            <p className="text-gray-500 dark:text-slate-400 text-xs mt-1 max-w-sm mx-auto">
              Pada tanggal <strong>{formatIndonesia(date)}</strong>, shift yang diwajibkan hanya{' '}
              <strong>{requiredShifts.map(shiftLabel).join(', ')}</strong>.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Data pengisi piket & status kelengkapan
  const hasFilledData = attendance.attachments.length > 0 || Boolean(attendance.note && attendance.note.trim().length > 0);

  // Validasi petugas pengisi:
  // 1. Jika form piket kosong: Petugas belum ada yang mengisi (effectiveOfficerId = null)
  // 2. Jika form terisi: Prioritaskan akun yang mengunggah foto lampiran
  const actualUploaderId = attendance.attachments.length > 0
    ? (attendance.attachments.find((att) => att.user_id)?.user_id ?? attendance.user_id)
    : attendance.user_id;

  const effectiveOfficerId = hasFilledData ? actualUploaderId : null;

  let authorName = 'Belum Ada yang Mengisi';
  if (effectiveOfficerId) {
    const { data: authorProfile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', effectiveOfficerId)
      .maybeSingle();
    authorName = authorProfile?.full_name?.trim() || authorProfile?.email || 'Petugas';
  }

  const mulai = attendance.attachments.find((a) => a.kind === 'mulai');
  const selesai = attendance.attachments.find((a) => a.kind === 'selesai');
  const aktivitas = attendance.attachments.filter((a) => a.kind === 'aktivitas');

  let jobStatus: 'lengkap' | 'sebagian' | 'kosong' = 'kosong';
  if (mulai && selesai && aktivitas.length >= 2) {
    jobStatus = 'lengkap';
  } else if (hasFilledData) {
    jobStatus = 'sebagian';
  }

  // Ambil status seluruh pekerjaan (Marketer, Qontak, Tiket) pada shift ini untuk dot indikator tab
  const { data: allShiftAttendances } = await supabase
    .from('attendances')
    .select('id, job_type, note, user_id')
    .eq('work_date', date)
    .eq('shift_type', shiftType);

  const allShiftAttIds = (allShiftAttendances ?? []).map((a) => a.id);
  const { data: allShiftAttachments } = allShiftAttIds.length > 0
    ? await supabase
        .from('attachments')
        .select('id, attendance_id, kind')
        .in('attendance_id', allShiftAttIds)
    : { data: [] };

  const jobStatusMap = new Map<JobType, 'lengkap' | 'sebagian' | 'kosong'>();
  JOB_TYPES.forEach((jt) => jobStatusMap.set(jt, 'kosong'));

  for (const a of allShiftAttendances ?? []) {
    const jKind = (a.job_type || 'marketer') as JobType;
    const atts = (allShiftAttachments ?? []).filter((at) => at.attendance_id === a.id);
    const hasMulaiAtt = atts.some((at) => at.kind === 'mulai');
    const hasSelesaiAtt = atts.some((at) => at.kind === 'selesai');
    const actCount = atts.filter((at) => at.kind === 'aktivitas').length;

    if (hasMulaiAtt && hasSelesaiAtt && actCount >= 2) {
      jobStatusMap.set(jKind, 'lengkap');
    } else if (hasMulaiAtt || hasSelesaiAtt || actCount > 0 || (a.note && a.note.trim().length > 0)) {
      jobStatusMap.set(jKind, 'sebagian');
    }
  }

  // Khusus Akun Master: ambil daftar seluruh akun petugas aktif untuk opsi pergantian petugas
  let availableOfficers: { id: string; fullName: string; email: string; role: string }[] = [];
  if (isMaster) {
    const { data: officersData } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .order('full_name', { ascending: true });

    availableOfficers = (officersData ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name?.trim() || p.email.split('@')[0],
      email: p.email,
      role: p.role,
    }));
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
      {/* Header Bar: Navigasi & Tanggal */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 min-h-[36px] py-1 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
          </Link>
          {!isRequired && hasExistingData && (
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 rounded-full">
              Di luar jadwal wajib
            </span>
          )}
        </div>

        {/* Tanggal & Badge Libur Tunggal (Tanpa Duplikasi) */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100">
              {formatIndonesia(date)}
            </h1>
            {!(requiredShifts.length > 1 || Boolean(holiday)) && (
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {shiftLabel(shiftType)}
              </p>
            )}
          </div>

          {holiday && (
            <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 px-2.5 py-1 rounded-full">
              Libur: {holiday.name}
            </span>
          )}
        </div>
      </div>

      {/* Navigasi Pilihan Shift Piket (Pagi / Malam) - Khusus Hari Libur & Akhir Pekan */}
      {(requiredShifts.length > 1 || Boolean(holiday)) && (
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 dark:bg-slate-800/80 rounded-xl border border-gray-200/60 dark:border-slate-700/60">
          <Link
            href={`/absen/${date}/pagi?job=${jobType}`}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all min-h-[40px] ${
              shiftType === 'pagi'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs border border-amber-200/80 dark:border-amber-800/60'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
            }`}
          >
            <Sun className={`h-4 w-4 ${shiftType === 'pagi' ? 'text-amber-500 fill-amber-500/20' : 'text-gray-400 dark:text-slate-500'}`} />
            <span>Piket Pagi</span>
          </Link>

          <Link
            href={`/absen/${date}/malam?job=${jobType}`}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all min-h-[40px] ${
              shiftType === 'malam'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-200/80 dark:border-indigo-800/60'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
            }`}
          >
            <Moon className={`h-4 w-4 ${shiftType === 'malam' ? 'text-indigo-500 fill-indigo-500/20' : 'text-gray-400 dark:text-slate-500'}`} />
            <span>Piket Malam</span>
          </Link>
        </div>
      )}

      {/* Job Type Switcher Tabs with Status Dots */}
      <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-slate-800/80 rounded-xl border border-gray-200/60 dark:border-slate-700/60">
        {JOB_TYPES.map((jt) => {
          const isActive = jt === jobType;
          const status = jobStatusMap.get(jt) ?? 'kosong';

          return (
            <Link
              key={jt}
              href={`/absen/${date}/${shift}?job=${jt}`}
              className={`flex-1 text-center py-2 px-2.5 rounded-lg text-xs font-semibold transition-all min-h-[38px] flex items-center justify-center gap-1.5 ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-blue-200/80 dark:border-blue-800/60'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <span>{jobLabel(jt)}</span>
              {status === 'lengkap' ? (
                <span className="h-2 w-2 rounded-full bg-green-500 shadow-xs" title="Lengkap" />
              ) : status === 'sebagian' ? (
                <span className="h-2 w-2 rounded-full bg-yellow-400 shadow-xs" title="Sebagian" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-slate-600" title="Kosong" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Progress Kelengkapan Bukti Form */}
      <div className="p-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-gray-700 dark:text-slate-300 text-[11px] sm:text-xs">
          Kelengkapan Bukti:
        </span>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 text-[10px] sm:text-[11px] ${
              mulai
                ? 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700'
            }`}
          >
            {mulai ? '✓ 1. Mulai' : '○ 1. Mulai'}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 text-[10px] sm:text-[11px] ${
              selesai
                ? 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700'
            }`}
          >
            {selesai ? '✓ 2. Selesai' : '○ 2. Selesai'}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 text-[10px] sm:text-[11px] ${
              aktivitas.length >= 2
                ? 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                : aktivitas.length > 0
                ? 'bg-yellow-50 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700'
            }`}
          >
            {aktivitas.length >= 2
              ? `✓ 3. Aktivitas (${aktivitas.length})`
              : aktivitas.length === 1
              ? '⏳ 3. Aktivitas (Kurang 1)'
              : '○ 3. Aktivitas (Min 2)'}
          </span>
        </div>
      </div>

      {/* Status & Petugas Pengisi Piket (Interactive with Master Change Officer option) */}
      <AttendanceOfficerCard
        attendanceId={attendance.id}
        currentUserId={effectiveOfficerId}
        authorName={authorName}
        hasFilledData={hasFilledData}
        updatedAt={attendance.updated_at}
        jobStatus={jobStatus}
        isMaster={isMaster}
        workDate={date}
        shiftType={shiftType}
        availableOfficers={availableOfficers}
      />

      {/* Main interactive form */}
      <AttendanceFormClient
        key={`${attendance.id}-${jobType}`}
        attendance={{
          ...attendance,
          user_id: effectiveOfficerId as unknown as string,
        }}
        userId={user.id}
        userName={fullName || email || 'Petugas'}
        workDate={date}
        shiftType={shiftType}
        isMaster={isMaster}
        today={today}
      />
    </div>
  );
}
