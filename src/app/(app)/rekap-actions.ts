'use server';

import { createClient } from '@/lib/supabase/server';
import type { Attendance, Attachment } from '@/lib/supabase/types';

export async function fetchAttendancesForRangeAction(startDate: string, endDate: string): Promise<{
  attendances: Attendance[];
  attachments: Attachment[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { attendances: [], attachments: [], error: 'Sesi telah berakhir. Silakan login kembali.' };
    }

    // Ambil data absensi sesuai rentang tanggal
    const { data: attData, error: attError } = await supabase
      .from('attendances')
      .select('id, work_date, shift_type, job_type, note, user_id, created_at, updated_at')
      .gte('work_date', startDate)
      .lte('work_date', endDate);

    if (attError) {
      return { attendances: [], attachments: [], error: attError.message };
    }

    const attendances = (attData ?? []) as Attendance[];
    const attendanceIds = attendances.map((a) => a.id);

    let attachments: Attachment[] = [];
    if (attendanceIds.length > 0) {
      const { data: attachData, error: attachError } = await supabase
        .from('attachments')
        .select('id, attendance_id, kind, user_id')
        .in('attendance_id', attendanceIds);

      if (!attachError && attachData) {
        attachments = attachData as Attachment[];
      }
    }

    return { attendances, attachments };
  } catch (err: unknown) {
    return {
      attendances: [],
      attachments: [],
      error: err instanceof Error ? err.message : 'Terjadi kendala saat memuat data rekapitulasi.',
    };
  }
}

