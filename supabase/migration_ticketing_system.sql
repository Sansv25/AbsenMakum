-- ==============================================================================
-- Migration: Sistem Ticketing Otomasi Iconnet Here
-- ==============================================================================

-- 1. Tabel Tiket Keluhan
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL,
  pln_id text,
  phone text,
  name text NOT NULL,
  address text,
  email text,
  regional text,
  office text,
  complaint text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','in_conversation','needs_admin','ticket_issued','closed','failed')),
  mode text NOT NULL DEFAULT 'ai' CHECK (mode IN ('ai','manual')),
  ticket_number text,
  ai_turns int NOT NULL DEFAULT 0,
  queue_order int DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_name text,
  started_at timestamptz,
  ticket_issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Hanya boleh 1 tiket aktif di Instagram
CREATE UNIQUE INDEX IF NOT EXISTS one_active_ticket_idx ON public.tickets ((true))
  WHERE status IN ('in_conversation','needs_admin');

-- 2. Tabel Foto Bukti Keluhan
CREATE TABLE IF NOT EXISTS public.ticket_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  mime text NOT NULL,
  size_bytes int,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Tabel Pesan Chat (Riwayat DM Instagram)
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  sender text NOT NULL CHECK (sender IN ('iconnet','ai','admin','system')),
  body text,
  media_path text,
  ig_mid text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Tabel Pengaturan Tiket & AI
CREATE TABLE IF NOT EXISTS public.ticketing_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Nilai awal pengaturan sistem
INSERT INTO public.ticketing_settings (key, value)
VALUES
  ('ai_system_prompt', '"Kamu adalah asisten admin yang membantu membuat tiket keluhan gangguan internet pelanggan lewat chat Instagram dengan layanan ICONNET.\nBahasa: Indonesia, sopan, singkat, sapa \"Kak\". Jangan menyebut dirimu AI kecuali ditanya langsung.\n\nDATA TIKET:\n{{ticket_json}}\nFOTO TERSEDIA: {{jumlah_foto}}\nWAKTU SEKARANG (WITA): {{waktu}}\nRIWAYAT CHAT: {{riwayat}}\nPESAN TERBARU DARI ICONNET: {{pesan}}\n\nATURAN:\n1. Jawab hanya memakai DATA TIKET. Jangan mengarang informasi.\n2. Jika diminta foto dan FOTO TERSEDIA > 0, jawab singkat dan set send_images=true. Jika tidak ada foto, escalate.\n3. Jika diminta informasi yang tidak ada di data tiket (mis. nomor telepon alternatif), escalate.\n4. Jika Iconnet sudah memberi nomor tiket dan menanyakan \"ada lagi yang bisa dibantu\", jawab bahwa tidak ada lagi, ucapkan terima kasih, dan akhiri dengan salam sesuai waktu: Selamat Pagi (05–10), Siang (11–14), Sore (15–17), Malam (18–04).\n5. Jangan membagikan data pelanggan yang tidak diminta.\n\nKELUARAN: hanya JSON valid, tanpa teks lain:\n{\"action\":\"reply\"|\"escalate\",\"text\":\"...\",\"send_images\":true|false}"'::jsonb),
  ('max_ai_turns', '12'::jsonb),
  ('closing_greeting_template', '"Terima kasih Kak, tidak ada lagi yang perlu dibantu. Selamat beraktivitas!"'::jsonb),
  ('auto_queue_enabled', 'true'::jsonb),
  ('ai_auto_enabled', 'true'::jsonb),
  ('ai_monitoring_enabled', 'false'::jsonb),
  ('queue_order', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. Bucket Storage ticket-images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ticket-images', 'ticket-images', false)
ON CONFLICT (id) DO NOTHING;

-- 6. RLS Policies
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticketing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_authenticated_all" ON public.tickets;
CREATE POLICY "tickets_authenticated_all" ON public.tickets
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ticket_images_authenticated_all" ON public.ticket_images;
CREATE POLICY "ticket_images_authenticated_all" ON public.ticket_images
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ticket_messages_authenticated_all" ON public.ticket_messages;
CREATE POLICY "ticket_messages_authenticated_all" ON public.ticket_messages
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ticketing_settings_authenticated_all" ON public.ticketing_settings;
CREATE POLICY "ticketing_settings_authenticated_all" ON public.ticketing_settings
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Storage RLS
DROP POLICY IF EXISTS "ticket_images_storage_select" ON storage.objects;
CREATE POLICY "ticket_images_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'ticket-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ticket_images_storage_insert" ON storage.objects;
CREATE POLICY "ticket_images_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'ticket-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ticket_images_storage_delete" ON storage.objects;
CREATE POLICY "ticket_images_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'ticket-images' AND auth.role() = 'authenticated');

-- 7. Realtime Publications
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
