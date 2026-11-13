import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data/profile';
import type { Attendance, Attachment, ShiftType, JobType, AttachmentKind } from '@/lib/supabase/types';

export interface AttachmentWithUrl extends Attachment {
  signedUrl: string | null;
  fileSize?: number | null;
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

  // AUDIT & VALIDASI PETUGAS YANG MENGISI:
  // 1. Cari uploader pertama/utama dari attachments yang ada
  const actualUploader = rawAttachments.find((a) => a.user_id)?.user_id;
  const hasFilledData = rawAttachments.length > 0 || Boolean(attendance.note && attendance.note.trim().length > 0);

  // 2. Jika ada foto dari uploader dan user_id di attendances berbeda (dan belum terkunci), sinkronkan ke uploader sebenarnya!
  if (actualUploader && attendance.user_id !== actualUploader && !attendance.is_locked) {
    try {
      await supabase
        .from('attendances')
        .update({ user_id: actualUploader, updated_at: new Date().toISOString() })
        .eq('id', attendance.id);
    } catch {
      // non-blocking
    }
    attendance.user_id = actualUploader;
  } else if (!hasFilledData) {
    // 3. JIKA FORM KOSONG: Petugas belum ada yang mengisi
    // Di level aplikasi, form kosong memiliki user_id = null agar tidak tercatat atas nama akun siapapun sebelum mengunggah
    attendance = {
      ...attendance,
      user_id: null as unknown as string,
    };
  }

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
  note: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Tidak terautentikasi' };

  const { isMaster } = await getCurrentUserProfile();

  const { data: att } = await supabase
    .from('attendances')
    .select('is_locked, user_id')
    .eq('id', attendanceId)
    .maybeSingle();

  // Cek apakah absensi ini sudah pernah diisi bukti foto oleh user lain
  const { count: otherAttachCount } = await supabase
    .from('attachments')
    .select('*', { count: 'exact', head: true })
    .eq('attendance_id', attendanceId)
    .neq('user_id', user.id);

  if (!isMaster && att) {
    if (att.is_locked) {
      return { success: false, error: 'Absensi telah dikunci.' };
    }
    // Kunci berbasis akun: HANYA aktif jika sudah ada data dari user lain
    if (att.user_id && att.user_id !== user.id && (otherAttachCount ?? 0) > 0) {
      return { success: false, error: 'Hanya akun petugas pengisi yang dapat mengedit absensi ini.' };
    }
  }

  const updateData: {
    note: string;
    updated_at: string;
    user_id?: string;
  } = {
    note,
    updated_at: new Date().toISOString(),
  };

  // Tautkan kepemilikan absensi ke user yang sedang mengisi jika belum ada data user lain
  if (isMaster || (otherAttachCount ?? 0) === 0) {
    updateData.user_id = user.id;
  }

  const { error } = await supabase
    .from('attendances')
    .update(updateData)
    .eq('id', attendanceId);

  if (error) return { success: false, error: error.message };
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
  attendanceId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Tidak terautentikasi' };

  const { isMaster } = await getCurrentUserProfile();

  const { data: current } = await supabase
    .from('attendances')
    .select('user_id, is_locked')
    .eq('id', attendanceId)
    .maybeSingle();

  if (!current) {
    return { success: false, error: 'Data absensi tidak ditemukan' };
  }

  if (current.is_locked && !isMaster) {
    return { success: false, error: 'Absensi telah dikunci' };
  }

  // 1. Coba panggil fungsi RPC claim_attendance_officer jika sudah ada di DB
  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('claim_attendance_officer', {
      target_attendance_id: attendanceId,
    });
    if (!rpcErr && rpcRes && rpcRes.success) {
      return { success: true };
    }
  } catch {
    // fallback ke query langsung
  }

  // 2. Fallback query langsung jika RPC belum dipasang
  const { count: otherAttachCount } = await supabase
    .from('attachments')
    .select('*', { count: 'exact', head: true })
    .eq('attendance_id', attendanceId)
    .neq('user_id', user.id);

  if (isMaster || (otherAttachCount ?? 0) === 0) {
    const { error: updateErr } = await supabase
      .from('attendances')
      .update({
        user_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attendanceId);

    if (updateErr) {
      console.warn('Gagal update attendances user_id:', updateErr.message);
    }
  }

  return { success: true };
}

export async function lockAttendance(
  attendanceId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Tidak terautentikasi' };

  const { isMaster } = await getCurrentUserProfile();

  if (!isMaster) {
    const { data: att } = await supabase
      .from('attendances')
      .select('user_id, is_locked')
      .eq('id', attendanceId)
      .maybeSingle();

    if (att && att.user_id && att.user_id !== user.id) {
      return { success: false, error: 'Hanya akun petugas pengisi yang dapat mengunci absensi ini.' };
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
