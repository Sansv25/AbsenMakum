-- ==============================================================================
-- Migration: Sistem Chat Feed Absensi & Absen Bersama via QR Google Lens
-- ==============================================================================

-- 1. TABEL FEED CHAT AKTIVITAS & ABSENSI
CREATE TABLE IF NOT EXISTS public.attendance_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_date date NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('pagi', 'malam')),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feed_type text NOT NULL DEFAULT 'activity' CHECK (feed_type IN ('mulai', 'selesai', 'kegiatan', 'group_attendance', 'text')),
  message text,
  media_paths text[] DEFAULT '{}',
  group_session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index untuk performa query feed per hari dan shift
CREATE INDEX IF NOT EXISTS idx_attendance_feed_date_shift ON public.attendance_feed (work_date, shift_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_feed_user ON public.attendance_feed (user_id);

-- RLS untuk attendance_feed
ALTER TABLE public.attendance_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Semua user terotentikasi dapat melihat feed absensi" ON public.attendance_feed;
CREATE POLICY "Semua user terotentikasi dapat melihat feed absensi"
  ON public.attendance_feed FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "User terotentikasi dapat memposting feed atas namanya sendiri" ON public.attendance_feed;
CREATE POLICY "User terotentikasi dapat memposting feed atas namanya sendiri"
  ON public.attendance_feed FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Pembuat atau admin/owner dapat menghapus pesan feed" ON public.attendance_feed;
CREATE POLICY "Pembuat atau admin/owner dapat menghapus pesan feed"
  ON public.attendance_feed FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND (
        profiles.role = 'master'
        OR 'owner' = ANY(profiles.roles)
        OR 'admin' = ANY(profiles.roles)
      )
    )
  );

-- 2. TABEL SESI ABSEN BERSAMA VIA QR (Google Lens & Kamera HP)
CREATE TABLE IF NOT EXISTS public.group_attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('pagi', 'malam')),
  qr_token text UNIQUE NOT NULL,
  photo_storage_path text,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_att_qr_token ON public.group_attendance_sessions (qr_token);
CREATE INDEX IF NOT EXISTS idx_group_att_status ON public.group_attendance_sessions (status, expires_at);

ALTER TABLE public.group_attendance_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Semua user terotentikasi dapat membaca sesi group attendance" ON public.group_attendance_sessions;
CREATE POLICY "Semua user terotentikasi dapat membaca sesi group attendance"
  ON public.group_attendance_sessions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Inisiator dapat membuat sesi absen bersama" ON public.group_attendance_sessions;
CREATE POLICY "Inisiator dapat membuat sesi absen bersama"
  ON public.group_attendance_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = initiator_id);

DROP POLICY IF EXISTS "Inisiator dapat mengupdate status sesi" ON public.group_attendance_sessions;
CREATE POLICY "Inisiator dapat mengupdate status sesi"
  ON public.group_attendance_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = initiator_id);

-- 3. TABEL ANGGOTA YANG BERGABUNG VIA SCAN QR (Google Lens)
CREATE TABLE IF NOT EXISTS public.group_attendance_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.group_attendance_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_att_members_session ON public.group_attendance_members (session_id);

ALTER TABLE public.group_attendance_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Semua user terotentikasi dapat membaca anggota sesi" ON public.group_attendance_members;
CREATE POLICY "Semua user terotentikasi dapat membaca anggota sesi"
  ON public.group_attendance_members FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "User terotentikasi dapat bergabung ke sesi melalui scan QR" ON public.group_attendance_members;
CREATE POLICY "User terotentikasi dapat bergabung ke sesi melalui scan QR"
  ON public.group_attendance_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4. AKTIFKAN SUPABASE REALTIME PUBLICATION UNTUK UPDATE OTOMATIS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'attendance_feed'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_feed;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'group_attendance_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_attendance_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'group_attendance_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_attendance_members;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Abaikan jika publication sudah aktif
END $$;
