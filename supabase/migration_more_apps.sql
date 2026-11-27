-- ==============================================================================
-- Migration: Halaman More App (Shortcut URL Aplikasi & Icon)
-- Semua pengguna terautentikasi dapat melihat & membuka shortcut aplikasi.
-- Hanya role Admin Piket (admin) dan Owner (owner) via public.is_master()
-- yang dapat menambah, mengubah, dan menghapus shortcut.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.more_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  icon_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS more_apps_sort_order_idx
  ON public.more_apps (sort_order ASC, created_at ASC);

ALTER TABLE public.more_apps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "more_apps_select_authenticated" ON public.more_apps;
CREATE POLICY "more_apps_select_authenticated" ON public.more_apps
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "more_apps_insert_admin" ON public.more_apps;
CREATE POLICY "more_apps_insert_admin" ON public.more_apps
  FOR INSERT
  WITH CHECK (public.is_master(auth.uid()));

DROP POLICY IF EXISTS "more_apps_update_admin" ON public.more_apps;
CREATE POLICY "more_apps_update_admin" ON public.more_apps
  FOR UPDATE
  USING (public.is_master(auth.uid()))
  WITH CHECK (public.is_master(auth.uid()));

DROP POLICY IF EXISTS "more_apps_delete_admin" ON public.more_apps;
CREATE POLICY "more_apps_delete_admin" ON public.more_apps
  FOR DELETE
  USING (public.is_master(auth.uid()));
