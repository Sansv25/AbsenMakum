import type { AppRole, ShiftType } from '@/lib/supabase/types';

export type FeedType = 'mulai' | 'selesai' | 'kegiatan' | 'group_attendance' | 'text';

export interface FeedUser {
  id: string;
  full_name: string | null;
  email: string | null;
  roles?: AppRole[];
  role?: string;
}

export interface GroupMemberInfo {
  user_id: string;
  full_name: string | null;
  email?: string | null;
  verified_at: string;
}

export interface AttendanceFeedMessage {
  id: string;
  work_date: string;
  shift_type: ShiftType;
  user_id: string;
  feed_type: FeedType;
  message: string | null;
  media_paths: string[];
  media_urls?: string[];
  group_session_id: string | null;
  created_at: string;
  user?: FeedUser;
  group_members?: GroupMemberInfo[];
}

export interface GroupAttendanceSession {
  id: string;
  initiator_id: string;
  work_date: string;
  shift_type: ShiftType;
  qr_token: string;
  photo_storage_path: string | null;
  photo_url?: string | null;
  note: string | null;
  status: 'pending' | 'completed' | 'expired';
  expires_at: string;
  created_at: string;
  initiator?: FeedUser;
  members?: GroupMemberInfo[];
}
