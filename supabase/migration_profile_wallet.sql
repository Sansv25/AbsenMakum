-- ==============================================================================
-- Migration: Tambah Kolom Wallet (Bank / E-Wallet) pada Tabel Profiles
-- Memisahkan data pembayaran (1 wallet per akun) dari Deskripsi Akun.
-- Digunakan juga untuk auto-fill kolom NO REK / E-WALLET & NAMA BANK / E-WALLET
-- saat export Nota PDF.
-- ==============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallet_type text CHECK (wallet_type IN ('bank', 'ewallet')),
  ADD COLUMN IF NOT EXISTS wallet_provider text,
  ADD COLUMN IF NOT EXISTS wallet_number text;
