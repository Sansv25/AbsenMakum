import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import type { ShiftType } from '@/lib/supabase/types';
import type { GroupAttendanceSession, GroupMemberInfo } from '@/lib/types/attendance-feed';

/**
 * Membuat sesi baru untuk Absen Bersama via QR Code
 */
export async function createGroupAttendanceSession(payload: {
  work_date: string;
  shift_type: ShiftType;
  photo_storage_path?: string | null;
  note?: string | null;
}): Promise<{ session: GroupAttendanceSession | null; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { session: null, error: 'Tidak terautentikasi' };
  }

  // Generate token dinamis acak sepanjang 24 karakter heksadesimal
  const qr_token = crypto.randomBytes(12).toString('hex');
  // Masa kedaluwarsa 3 menit dari sekarang
  const expires_at = new Date(Date.now() + 3 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('group_attendance_sessions')
    .insert({
      initiator_id: user.id,
      work_date: payload.work_date,
      shift_type: payload.shift_type,
      qr_token,
      photo_storage_path: payload.photo_storage_path || null,
      note: payload.note || null,
      status: 'pending',
      expires_at,
    })
    .select(`
      id,
      initiator_id,
      work_date,
      shift_type,
      qr_token,
      photo_storage_path,
      note,
      status,
      expires_at,
      created_at,
      profiles:initiator_id (
        id,
        full_name,
        email,
        role,
        roles
      )
    `)
    .single();

  if (error || !data) {
    return { session: null, error: error?.message || 'Gagal membuat sesi absen bersama' };
  }

  // Tambahkan inisiator sendiri secara otomatis sebagai member pertama yang terverifikasi
  await supabase.from('group_attendance_members').insert({
    session_id: data.id,
    user_id: user.id,
  });

  const prof = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

  let photo_url: string | null = null;
  if (data.photo_storage_path) {
    const { data: signData } = await supabase.storage
      .from('evidence')
      .createSignedUrl(data.photo_storage_path, 3600);
    photo_url = signData?.signedUrl || null;
  }

  return {
    session: {
      id: data.id,
      initiator_id: data.initiator_id,
      work_date: data.work_date,
      shift_type: data.shift_type as ShiftType,
      qr_token: data.qr_token,
      photo_storage_path: data.photo_storage_path,
      photo_url,
      note: data.note,
      status: data.status as 'pending' | 'completed' | 'expired',
      expires_at: data.expires_at,
      created_at: data.created_at,
      initiator: prof
        ? {
            id: prof.id,
            full_name: prof.full_name,
            email: prof.email,
            role: prof.role,
            roles: prof.roles,
          }
        : undefined,
      members: [
        {
          user_id: user.id,
          full_name: prof?.full_name || 'Inisiator',
          email: prof?.email || null,
          verified_at: new Date().toISOString(),
        },
      ],
    },
  };
}

/**
 * Bergabung ke sesi absen bersama melalui token hasil scan QR Google Lens / Kamera HP
 */
export async function joinGroupAttendanceByToken(
  qr_token: string
): Promise<{
  success: boolean;
  message: string;
  session?: GroupAttendanceSession;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: 'Silakan login terlebih dahulu untuk konfirmasi kehadiran.',
      error: 'unauthenticated',
    };
  }

  // Cari sesi berdasarkan token
  const { data: sessionData, error: sessionErr } = await supabase
    .from('group_attendance_sessions')
    .select(`
      id,
      initiator_id,
      work_date,
      shift_type,
      qr_token,
      photo_storage_path,
      note,
      status,
      expires_at,
      created_at,
      profiles:initiator_id (
        id,
        full_name,
        email
      )
    `)
    .eq('qr_token', qr_token)
    .maybeSingle();

  if (sessionErr || !sessionData) {
    return {
      success: false,
      message: 'QR Code tidak valid atau sesi absen tidak ditemukan.',
      error: 'invalid_token',
    };
  }

  if (sessionData.status !== 'pending') {
    return {
      success: false,
      message: 'Sesi absen bersama ini sudah selesai atau ditutup.',
      error: 'session_closed',
    };
  }

  // Cek apakah sudah kedaluwarsa
  const isExpired = new Date(sessionData.expires_at).getTime() < Date.now();
  if (isExpired) {
    await supabase
      .from('group_attendance_sessions')
      .update({ status: 'expired' })
      .eq('id', sessionData.id);

    return {
      success: false,
      message: 'QR Code telah kedaluwarsa. Silakan minta inisiator memperbarui QR Code.',
      error: 'expired_token',
    };
  }

  // Masukkan user ini ke daftar anggota terverifikasi
  const { error: joinErr } = await supabase
    .from('group_attendance_members')
    .upsert(
      {
        session_id: sessionData.id,
        user_id: user.id,
        verified_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,user_id' }
    );

  if (joinErr) {
    return {
      success: false,
      message: `Gagal mencatat verifikasi: ${joinErr.message}`,
      error: joinErr.message,
    };
  }

  const initiatorProf = Array.isArray(sessionData.profiles) ? sessionData.profiles[0] : sessionData.profiles;
  const initiatorName = initiatorProf?.full_name || 'Rekan Anda';

  return {
    success: true,
    message: `Berhasil! Anda telah terverifikasi hadir bersama ${initiatorName} untuk Shift ${sessionData.shift_type.toUpperCase()}.`,
  };
}

/**
 * Mengambil status sesi grup terkini dan daftar anggota yang sudah scan
 */
export async function getGroupSessionStatus(
  sessionId: string
): Promise<{ session: GroupAttendanceSession | null; error?: string }> {
  const supabase = await createClient();

  const { data: sessionData, error: sErr } = await supabase
    .from('group_attendance_sessions')
    .select(`
      id,
      initiator_id,
      work_date,
      shift_type,
      qr_token,
      photo_storage_path,
      note,
      status,
      expires_at,
      created_at,
      profiles:initiator_id (
        id,
        full_name,
        email
      )
    `)
    .eq('id', sessionId)
    .single();

  if (sErr || !sessionData) {
    return { session: null, error: sErr?.message || 'Sesi tidak ditemukan' };
  }

  const { data: membersData } = await supabase
    .from('group_attendance_members')
    .select(`
      user_id,
      verified_at,
      profiles:user_id (
        full_name,
        email
      )
    `)
    .eq('session_id', sessionId)
    .order('verified_at', { ascending: true });

  const members: GroupMemberInfo[] = (membersData || []).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      user_id: m.user_id,
      full_name: p?.full_name || null,
      email: p?.email || null,
      verified_at: m.verified_at,
    };
  });

  const initiatorProf = Array.isArray(sessionData.profiles) ? sessionData.profiles[0] : sessionData.profiles;

  let photo_url: string | null = null;
  if (sessionData.photo_storage_path) {
    const { data: signData } = await supabase.storage
      .from('evidence')
      .createSignedUrl(sessionData.photo_storage_path, 3600);
    photo_url = signData?.signedUrl || null;
  }

  return {
    session: {
      id: sessionData.id,
      initiator_id: sessionData.initiator_id,
      work_date: sessionData.work_date,
      shift_type: sessionData.shift_type as ShiftType,
      qr_token: sessionData.qr_token,
      photo_storage_path: sessionData.photo_storage_path,
      photo_url,
      note: sessionData.note,
      status: sessionData.status as 'pending' | 'completed' | 'expired',
      expires_at: sessionData.expires_at,
      created_at: sessionData.created_at,
      initiator: initiatorProf
        ? {
            id: initiatorProf.id,
            full_name: initiatorProf.full_name,
            email: initiatorProf.email,
          }
        : undefined,
      members,
    },
  };
}

/**
 * Menyelesaikan sesi absen bersama, menerbitkan ke chat feed, dan mencatat kehadiran shift
 */
export async function finalizeGroupAttendanceSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Tidak terautentikasi' };
  }

  // 1. Ambil detail sesi
  const { session, error } = await getGroupSessionStatus(sessionId);
  if (error || !session) {
    return { success: false, error: error || 'Sesi tidak ditemukan' };
  }

  if (session.initiator_id !== user.id) {
    return { success: false, error: 'Hanya inisiator yang dapat memfinalisasi absen bersama ini' };
  }

  // 2. Tandai status sesi = completed
  await supabase
    .from('group_attendance_sessions')
    .update({ status: 'completed' })
    .eq('id', sessionId);

  // 3. Susun daftar nama peserta
  const memberNames = (session.members || []).map((m) => m.full_name || 'Rekan').join(', ');
  const totalCount = session.members?.length || 1;
  const feedMessageText = `📸 Absen Bersama (${totalCount} Petugas Hadir):\n${memberNames}${
    session.note ? `\n\nCatatan: ${session.note}` : ''
  }`;

  // 4. Publikasikan kartu pesan ke feed chat absensi
  await supabase.from('attendance_feed').insert({
    user_id: user.id,
    work_date: session.work_date,
    shift_type: session.shift_type,
    feed_type: 'group_attendance',
    message: feedMessageText,
    media_paths: session.photo_storage_path ? [session.photo_storage_path] : [],
    group_session_id: session.id,
  });

  // 5. Sinkronisasi kehadiran ke tabel attendances & attachments untuk semua peserta yang hadir
  for (const member of session.members || []) {
    try {
      // Cek apakah sudah ada baris attendance untuk user ini di tanggal & shift tersebut
      const { data: existingAtt } = await supabase
        .from('attendances')
        .select('id')
        .eq('user_id', member.user_id)
        .eq('work_date', session.work_date)
        .eq('shift_type', session.shift_type)
        .maybeSingle();

      let attId = existingAtt?.id;
      if (!attId) {
        const { data: newAtt } = await supabase
          .from('attendances')
          .insert({
            user_id: member.user_id,
            work_date: session.work_date,
            shift_type: session.shift_type,
            job_type: 'marketer',
            note: session.note || `Absen Bersama via QR Code (${memberNames})`,
          })
          .select('id')
          .single();
        attId = newAtt?.id;
      }

      // Lampirkan foto bersama ke attachments jika ada
      if (attId && session.photo_storage_path) {
        await supabase.from('attachments').insert({
          attendance_id: attId,
          user_id: member.user_id,
          storage_path: session.photo_storage_path,
          kind: 'mulai',
          file_size: 150000,
          mime_type: 'image/jpeg',
          original_filename: `absen_bersama_${session.work_date}_${session.shift_type}.jpg`,
        });
      }
    } catch {
      // Lanjutkan untuk anggota berikutnya
    }
  }

  return { success: true };
}
