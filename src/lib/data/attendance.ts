import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data/profile';
import type { Attendance, Attachment, ShiftType, JobType, AttachmentKind } from '@/lib/supabase/types';

export interface AttachmentWithUrl extends Attachment {
  signedUrl: string | null;
}

export interface AttendanceDetail extends Attendance {
  attachments: AttachmentWithUrl[];
}

export async function getAttendanceWithAttachments(
  work_date: string,
  shift_type: ShiftType,
  job_type: JobType = 'marketer'
): Promise<{ attendance: AttendanceDetail | null; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { attendance: null, error: 'Tidak terautentikasi' };

  // Fetch attendance record for this date, shift, and job_type
  const { data: existingAttendance, error: attError } = await supabase
    .from('attendances')
    .select('*')
    .eq('work_date', work_date)
    .eq('shift_type', shift_type)
    .eq('job_type', job_type)
    .maybeSingle();

  if (attError) {
    return { attendance: null, error: attError.message };
  }

  let attendance = existingAttendance;

  if (!attendance) {
    // Create new attendance
    const { data: created, error: createError } = await supabase
      .from('attendances')
      .insert({
        user_id: user.id,
        work_date,
        shift_type,
        job_type,
      })
      .select()
      .single();

    if (createError) {
      return { attendance: null, error: createError.message };
    }
    attendance = created;
  }

  // Fetch attachments
  const { data: attachmentsData, error: attachError } = await supabase
    .from('attachments')
    .select('*')
    .eq('attendance_id', attendance.id)
    .order('sort_order', { ascending: true });

  if (attachError) {
    return { attendance: null, error: attachError.message };
  }

  const rawAttachments = (attachmentsData ?? []) as Attachment[];

  // Generate signed URLs in parallel (valid 1 hour)
  const attachmentsWithUrls: AttachmentWithUrl[] = await Promise.all(
    rawAttachments.map(async (att) => {
      const { data } = await supabase.storage
        .from('evidence')
        .createSignedUrl(att.storage_path, 3600);
      return {
        ...att,
        signedUrl: data?.signedUrl ?? null,
      };
    })
  );

  return {
    attendance: {
      ...attendance,
      attachments: attachmentsWithUrls,
    },
  };
}

export async function updateNote(
  attendanceId: string,
  note: string,
  deviceId?: string,
  deviceInfo?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Tidak terautentikasi' };

  const { isMaster } = await getCurrentUserProfile();

  const { data: att } = await supabase
    .from('attendances')
    .select('device_id, is_locked, user_id')
    .eq('id', attendanceId)
    .maybeSingle();

  if (!isMaster && att) {
    if (att.is_locked) {
      return { success: false, error: 'Absensi telah dikunci.' };
    }
    if (att.device_id && deviceId && att.device_id !== deviceId) {
      return { success: false, error: 'Hanya perangkat yang memulai absen yang dapat mengedit.' };
    }
  }

  const updateData: {
    note: string;
    updated_at: string;
    device_id?: string;
    device_info?: string;
    user_id?: string;
  } = {
    note,
    updated_at: new Date().toISOString(),
  };

  // Jika belum punya device_id dan ada deviceId, ikatkan perangkat dan author saat pertama kali input
  if (att && !att.device_id && deviceId) {
    updateData.device_id = deviceId;
    if (deviceInfo) updateData.device_info = deviceInfo;
    updateData.user_id = user.id;
  }

  let updateQuery = supabase
    .from('attendances')
    .update(updateData)
    .eq('id', attendanceId);

  // Jika sudah terikat ke petugas lain, pastikan hanya author atau master yang boleh update
  if (!isMaster && att?.device_id && att.user_id !== user.id) {
    updateQuery = updateQuery.eq('user_id', user.id);
  }

  const { error } = await updateQuery;

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function saveAttachmentRecord(
  attendanceId: string,
  kind: AttachmentKind,
  storagePath: string,
  sortOrder: number = 0
): Promise<{ attachment: Attachment | null; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { attachment: null, error: 'Tidak terautentikasi' };

  // For 'mulai' or 'selesai', if one already exists, delete old file & record first
  if (kind === 'mulai' || kind === 'selesai') {
    const { data: existing } = await supabase
      .from('attachments')
      .select('id, storage_path')
      .eq('attendance_id', attendanceId)
      .eq('kind', kind);

    if (existing && existing.length > 0) {
      for (const item of existing) {
        await supabase.storage.from('evidence').remove([item.storage_path]);
        await supabase.from('attachments').delete().eq('id', item.id);
      }
    }
  }

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      attendance_id: attendanceId,
      user_id: user.id,
      kind,
      storage_path: storagePath,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) {
    return { attachment: null, error: error.message };
  }

  return { attachment: data as Attachment };
}

export async function deleteAttachmentRecord(
  attachmentId: string,
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Tidak terautentikasi' };

  // Remove from storage
  await supabase.storage.from('evidence').remove([storagePath]);

  // Remove from DB
  const { error } = await supabase
    .from('attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('user_id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function updateTicketOrders(
  orderedItems: { id: string; sort_order: number }[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Tidak terautentikasi' };

  for (const item of orderedItems) {
    await supabase
      .from('attachments')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
      .eq('user_id', user.id);
  }

  return { success: true };
}

export async function claimDeviceForAttendance(
  attendanceId: string,
  deviceId: string,
  deviceInfo: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Tidak terautentikasi' };

  // Only claim if device_id is currently null and not locked
  const { data: current } = await supabase
    .from('attendances')
    .select('device_id, is_locked')
    .eq('id', attendanceId)
    .maybeSingle();

  if (current && !current.device_id && !current.is_locked) {
    const { error } = await supabase
      .from('attendances')
      .update({
        user_id: user.id,
        device_id: deviceId,
        device_info: deviceInfo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attendanceId);

    if (error) return { success: false, error: error.message };
  }

  return { success: true };
}

export async function lockAttendance(
  attendanceId: string,
  deviceId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Tidak terautentikasi' };

  const { isMaster } = await getCurrentUserProfile();

  if (!isMaster) {
    const { data: att } = await supabase
      .from('attendances')
      .select('device_id, is_locked')
      .eq('id', attendanceId)
      .maybeSingle();

    if (att) {
      if (att.device_id && deviceId && att.device_id !== deviceId) {
        return { success: false, error: 'Hanya perangkat yang memulai absen yang dapat mengunci.' };
      }
    }
  }

  const { error } = await supabase
    .from('attendances')
    .update({
      is_locked: true,
      locked_at: new Date().toISOString(),
      locked_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', attendanceId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function unlockAttendance(
  attendanceId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { success: false, error: 'Hanya Akun Master yang dapat membuka kunci absensi.' };
  }

  const { error } = await supabase
    .from('attendances')
    .update({
      is_locked: false,
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', attendanceId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function resetAttendanceDevice(
  attendanceId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { success: false, error: 'Hanya Akun Master yang dapat mereset kunci perangkat.' };
  }

  const { error } = await supabase
    .from('attendances')
    .update({
      device_id: null,
      device_info: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', attendanceId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
