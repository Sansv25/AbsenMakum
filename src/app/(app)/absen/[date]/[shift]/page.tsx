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
import { ArrowLeft, AlertCircle, ShieldAlert } from 'lucide-react';

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
  let authorName = 'Belum Ada yang Mengisi';
  if (hasFilledData && attendance.user_id) {
    const { data: authorProfile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', attendance.user_id)
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
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 min-h-[44px] py-2 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
        {!isRequired && hasExistingData && (
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-full">
            Di luar jadwal wajib
          </span>
        )}
      </div>

      {/* Job Type Switcher Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-slate-800/80 rounded-2xl">
        {JOB_TYPES.map((jt) => {
          const isActive = jt === jobType;
          return (
            <Link
              key={jt}
              href={`/absen/${date}/${shift}?job=${jt}`}
              className={`flex-1 text-center py-2 px-3 rounded-xl text-xs font-semibold transition-all min-h-[38px] flex items-center justify-center gap-1.5 ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-200/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span>{jobLabel(jt)}</span>
            </Link>
          );
        })}
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">
          {shiftLabel(shiftType)} &mdash; {jobLabel(jobType)}
        </h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          {formatIndonesia(date)}
          {holiday ? ` • Tanggal Merah (${holiday.name})` : ''}
        </p>
      </div>

      {/* Status & Petugas Pengisi Piket (Interactive with Master Change Officer option) */}
      <AttendanceOfficerCard
        attendanceId={attendance.id}
        currentUserId={attendance.user_id}
        authorName={hasFilledData ? authorName : 'Belum Ada yang Mengisi'}
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
        attendance={attendance}
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
