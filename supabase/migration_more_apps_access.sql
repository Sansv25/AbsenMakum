-- ==============================================================================
-- Migration: Pengaturan Akses per Aplikasi pada Halaman More App
-- Memungkinkan Owner membatasi shortcut aplikasi ke role atau user tertentu.
-- Hanya role Owner (public.is_owner) yang berhak mengelola pengaturan akses.
-- ==============================================================================

ALTER TABLE public.more_apps
  ADD COLUMN IF NOT EXISTS allowed_roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allowed_user_ids uuid[] NOT NULL DEFAULT '{}';

DROP POLICY IF EXISTS "more_apps_select_authenticated" ON public.more_apps;
DROP POLICY IF EXISTS "more_apps_select_authorized" ON public.more_apps;

CREATE POLICY "more_apps_select_authorized" ON public.more_apps
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND (
      public.is_owner(auth.uid())
      OR (
        coalesce(array_length(allowed_roles, 1), 0) = 0
        AND coalesce(array_length(allowed_user_ids, 1), 0) = 0
      )
      OR auth.uid() = ANY(allowed_user_ids)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.roles && allowed_roles
      )
    )
  );
