'use server';

import {
  updateNote,
  claimDeviceForAttendance,
  lockAttendance,
  unlockAttendance,
  resetAttendanceDevice,
} from '@/lib/data/attendance';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { PdfAttendanceItem } from '@/lib/pdf';
import type { ShiftType, JobType } from '@/lib/supabase/types';

export async function saveNoteAction(
  attendanceId: string,
  note: string,
  deviceId?: string,
  deviceInfo?: string
) {
  return await updateNote(attendanceId, note, deviceId, deviceInfo);
}

export async function claimDeviceAction(
  attendanceId: string,
  deviceId: string,
  deviceInfo: string
) {
  const result = await claimDeviceForAttendance(attendanceId, deviceId, deviceInfo);
  return result;
}

export async function lockAttendanceAction(
  attendanceId: string,
  date: string,
  shift: string,
  deviceId?: string
) {
  const result = await lockAttendance(attendanceId, deviceId);
  revalidatePath(`/absen/${date}/${shift}`);
  revalidatePath('/');
  revalidatePath('/riwayat');
  return result;
}

export async function unlockAttendanceAction(
  attendanceId: string,
  date: string,
  shift: string
) {
  const result = await unlockAttendance(attendanceId);
  revalidatePath(`/absen/${date}/${shift}`);
  revalidatePath('/');
  revalidatePath('/riwayat');
  return result;
}

export async function resetDeviceAction(
  attendanceId: string,
  date: string,
  shift: string
) {
  const result = await resetAttendanceDevice(attendanceId);
  revalidatePath(`/absen/${date}/${shift}`);
  return result;
}

export async function getSingleFormExportData(attendanceId: string): Promise<{
  data?: PdfAttendanceItem;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Tidak terautentikasi.' };

  // Fetch attendance row
  const { data: att, error: attError } = await supabase
    .from('attendances')
    .select('*')
    .eq('id', attendanceId)
    .maybeSingle();

  if (attError || !att) {
    return { error: attError?.message || 'Data absensi tidak ditemukan.' };
  }

  // Fetch author profile
  let authorName = 'Belum Ada Pengisi';
  if (att.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', att.user_id)
      .maybeSingle();
    authorName = profile?.full_name?.trim() || profile?.email || 'Petugas';
  }

  // Fetch all attachments
  const { data: attachments, error: attachError } = await supabase
    .from('attachments')
    .select('*')
    .eq('attendance_id', attendanceId)
    .order('sort_order', { ascending: true });

  if (attachError) {
    return { error: attachError.message };
  }

  const allAttach = attachments || [];
  const hasNotes = att.note && att.note.trim().length > 0;
  if (allAttach.length === 0 && !hasNotes) {
    return {
      error: 'Belum ada bukti foto atau catatan yang tersimpan pada form absensi ini.',
    };
  }

  // Generate signed URLs for attachments
  const paths = allAttach.map((a) => a.storage_path);
  const signedMap = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signedData } = await supabase.storage
      .from('evidence')
      .createSignedUrls(paths, 3600);

    for (const item of signedData ?? []) {
      if (item.signedUrl && item.path) {
        signedMap.set(item.path, item.signedUrl);
      }
    }
  }

  const mulaiAtt = allAttach.find((a) => a.kind === 'mulai');
  const selesaiAtt = allAttach.find((a) => a.kind === 'selesai');
  const aktivitasAtts = allAttach.filter((a) => a.kind === 'aktivitas');
  const ticketAtts = allAttach.filter((a) => a.kind === 'ticket');

  const item: PdfAttendanceItem = {
    work_date: att.work_date,
    shift_type: att.shift_type as ShiftType,
    job_type: (att.job_type as JobType) || 'marketer',
    author_name: authorName,
    note: att.note,
    mulaiUrl: mulaiAtt ? signedMap.get(mulaiAtt.storage_path) ?? null : null,
    selesaiUrl: selesaiAtt ? signedMap.get(selesaiAtt.storage_path) ?? null : null,
    aktivitasUrls: aktivitasAtts
      .map((a) => signedMap.get(a.storage_path))
      .filter((url): url is string => !!url),
    ticketUrls: ticketAtts
      .map((a) => signedMap.get(a.storage_path))
      .filter((url): url is string => !!url),
  };

  return { data: item };
}
