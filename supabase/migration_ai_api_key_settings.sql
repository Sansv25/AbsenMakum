-- Migration: Simpan NVIDIA NIM API Key di tabel ticketing_settings
-- Kunci ini dilindungi RLS sehingga hanya user authenticated yang dapat membaca/mengambilnya
-- Memungkinkan perangkat bot baru (multi-device) menyinkronkan kredensial AI secara otomatis tanpa copy manual .env

INSERT INTO public.ticketing_settings (key, value, updated_at)
VALUES (
  'nvidia_nim_api_key',
  '"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"'::jsonb,
  now()
)
ON CONFLICT (key) DO NOTHING;
