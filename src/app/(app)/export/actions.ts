'use server';

import { createClient } from '@/lib/supabase/server';
import type { ShiftType } from '@/lib/supabase/types';
import type { PdfAttendanceItem } from '@/lib/pdf';

export async function fetchExportData(
  startDate: string,
  endDate: string,
  filterMode: 'complete_only' | 'all_with_photos'
): Promise<{ data: PdfAttendanceItem[]; error?: string }> {
  // Validate range <= 31 days
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (diffDays <= 0) {
    return { data: [], error: 'Tanggal mulai harus lebih awal dari tanggal selesai.' };
  }
  if (diffDays > 31) {
    return { data: [], error: 'Rentang tanggal maksimal 31 hari agar memori aman.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: 'Tidak terautentikasi' };

  // Fetch attendances in range
  const { data: attendances, error: attError } = await supabase
    .from('attendances')
    .select('*')
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .order('work_date', { ascending: true });

  if (attError) {
    return { data: [], error: attError.message };
  }

  if (!attendances || attendances.length === 0) {
    return { data: [] };
  }

  const attendanceIds = attendances.map((a) => a.id);

  // Fetch attachments
  const { data: attachments, error: attachError } = await supabase
    .from('attachments')
    .select('*')
    .in('attendance_id', attendanceIds)
    .order('sort_order', { ascending: true });

  if (attachError) {
    return { data: [], error: attachError.message };
  }

  // Pre-generate signed URLs for all attachments
  const signedUrlMap = new Map<string, string>();
  const paths = (attachments ?? []).map((a) => a.storage_path);
  if (paths.length > 0) {
    const { data: signedData } = await supabase.storage
      .from('evidence')
      .createSignedUrls(paths, 3600);

    for (const item of signedData ?? []) {
      if (item.path && item.signedUrl) {
        signedUrlMap.set(item.path, item.signedUrl);
      }
    }
  }

  // Group by attendance
  const attachByAttendance = new Map<string, typeof attachments>();
  for (const att of attachments ?? []) {
    if (!attachByAttendance.has(att.attendance_id)) {
      attachByAttendance.set(att.attendance_id, []);
    }
    attachByAttendance.get(att.attendance_id)!.push(att);
  }

  // Sort attendances by date ascending, then 'pagi' before 'malam'
  const sorted = [...attendances].sort((a, b) => {
    if (a.work_date !== b.work_date) {
      return a.work_date.localeCompare(b.work_date);
    }
    return a.shift_type === 'pagi' ? -1 : 1;
  });

  const result: PdfAttendanceItem[] = [];

  for (const att of sorted) {
    const list = attachByAttendance.get(att.id) ?? [];
    const mulai = list.find((a) => a.kind === 'mulai');
    const selesai = list.find((a) => a.kind === 'selesai');
    const tickets = list.filter((a) => a.kind === 'ticket');

    const mulaiUrl = mulai ? (signedUrlMap.get(mulai.storage_path) ?? null) : null;
    const selesaiUrl = selesai ? (signedUrlMap.get(selesai.storage_path) ?? null) : null;
    const ticketUrls = tickets
      .map((t) => signedUrlMap.get(t.storage_path) ?? null)
      .filter((url): url is string => !!url);

    const hasMulai = !!mulaiUrl;
    const hasSelesai = !!selesaiUrl;
    const hasAnyPhoto = hasMulai || hasSelesai || ticketUrls.length > 0;

    if (filterMode === 'complete_only') {
      if (!hasMulai || !hasSelesai) continue;
    } else {
      if (!hasAnyPhoto) continue;
    }

    result.push({
      work_date: att.work_date,
      shift_type: att.shift_type as ShiftType,
      job_type: att.job_type,
      note: att.note,
      mulaiUrl,
      selesaiUrl,
      ticketUrls,
    });
  }

  return { data: result };
}
