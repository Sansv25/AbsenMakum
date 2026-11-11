// TypeScript types for database tables

export type UserRole = 'master' | 'user';
export type ShiftType = 'pagi' | 'malam';
export type JobType = 'marketer' | 'qontak' | 'tiket';
export type AttachmentKind = 'mulai' | 'selesai' | 'ticket';
export type ShiftStatus = 'kosong' | 'sebagian' | 'lengkap';
export type DayStatus = 'kosong' | 'sebagian' | 'lengkap' | 'belum';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string | null;
  phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftSetting {
  user_id: string;
  shift_type: ShiftType;
  start_time: string; // HH:MM:SS
  end_time: string;   // HH:MM:SS
}

export interface Holiday {
  id: string;
  user_id: string;
  holiday_date: string; // YYYY-MM-DD
  name: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  work_date: string; // YYYY-MM-DD
  shift_type: ShiftType;
  job_type: JobType;
  note: string | null;
  device_id?: string | null;
  device_info?: string | null;
  is_locked?: boolean;
  locked_at?: string | null;
  locked_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  attendance_id: string;
  user_id: string;
  kind: AttachmentKind;
  storage_path: string;
  sort_order: number;
  created_at: string;
}

// Enriched types used in UI
export interface AttendanceWithAttachments extends Attendance {
  attachments: Attachment[];
}
