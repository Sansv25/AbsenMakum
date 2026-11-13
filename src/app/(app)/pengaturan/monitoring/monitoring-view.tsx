'use client';

import { useState } from 'react';
import type { StorageStats } from '@/lib/data/monitoring';
import { refreshStorageStatsAction } from './actions';
import {
  HardDrive,
  Database,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Camera,
  FileText,
  Layers,
  Sparkles,
  Info,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { showAlert } from '@/lib/swal';

interface MonitoringViewProps {
  initialStats: StorageStats;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function MonitoringView({ initialStats }: MonitoringViewProps) {
  const [stats, setStats] = useState<StorageStats>(initialStats);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  // Storage calculations
  const storageUsed = stats.storageSizeBytes;
  const storageLimit = stats.storageLimitBytes || 1073741824; // 1 GB
  const storagePercent = Math.min(100, Math.max(0, (storageUsed / storageLimit) * 100));
  const storageRemaining = Math.max(0, storageLimit - storageUsed);
  const storagePercentRemaining = Math.max(0, 100 - storagePercent);

  // Database calculations
  const dbUsed = stats.dbSizeBytes;
  const dbLimit = stats.dbLimitBytes || 524288000; // 500 MB
  const dbPercent = Math.min(100, Math.max(0, (dbUsed / dbLimit) * 100));
  const dbRemaining = Math.max(0, dbLimit - dbUsed);
  const dbPercentRemaining = Math.max(0, 100 - dbPercent);

  // Estimasi foto sisa (~320 KB per foto)
  const estimatedRemainingPhotos = Math.floor(storageRemaining / (320 * 1024));

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const res = await refreshStorageStatsAction();
      if (res.error || !res.stats) {
        showAlert('Gagal Refresh', res.error || 'Tidak dapat mengambil metrik terbaru.', 'error');
      } else {
        setStats(res.stats);
      }
    } catch {
      showAlert('Gagal Refresh', 'Terjadi kesalahan saat memuat ulang metrik.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }

  const rpcSql = `-- Jalankan di Supabase SQL Editor untuk mengaktifkan metrik disk riil:
CREATE OR REPLACE FUNCTION public.get_system_storage_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  db_size_bytes bigint := 0;
  storage_size_bytes bigint := 0;
  storage_file_count bigint := 0;
  attendances_count bigint := 0;
  attachments_count bigint := 0;
  profiles_count bigint := 0;
  foto_mulai_count bigint := 0;
  foto_selesai_count bigint := 0;
  foto_aktivitas_count bigint := 0;
  foto_ticket_count bigint := 0;
BEGIN
  IF NOT public.is_master(caller_id) THEN
    RETURN json_build_object('success', false, 'error', 'Hanya Akun Master yang diizinkan.');
  END IF;

  SELECT pg_database_size(current_database()) INTO db_size_bytes;

  BEGIN
    SELECT
      coalesce(sum((metadata->>'size')::bigint), 0),
      count(*)
    INTO storage_size_bytes, storage_file_count
    FROM storage.objects
    WHERE bucket_id = 'evidence';
  EXCEPTION WHEN OTHERS THEN
    SELECT count(*) INTO storage_file_count FROM public.attachments;
    storage_size_bytes := storage_file_count * 327680;
  END;

  SELECT count(*) INTO attendances_count FROM public.attendances;
  SELECT count(*) INTO attachments_count FROM public.attachments;
  SELECT count(*) INTO profiles_count FROM public.profiles;

  SELECT count(*) INTO foto_mulai_count FROM public.attachments WHERE kind = 'mulai';
  SELECT count(*) INTO foto_selesai_count FROM public.attachments WHERE kind = 'selesai';
  SELECT count(*) INTO foto_aktivitas_count FROM public.attachments WHERE kind = 'aktivitas';
  SELECT count(*) INTO foto_ticket_count FROM public.attachments WHERE kind = 'ticket';

  RETURN json_build_object(
    'success', true,
    'db_size_bytes', db_size_bytes,
    'db_limit_bytes', 524288000,
    'storage_size_bytes', storage_size_bytes,
    'storage_limit_bytes', 1073741824,
    'storage_file_count', storage_file_count,
    'attendances_count', attendances_count,
    'attachments_count', attachments_count,
    'profiles_count', profiles_count,
    'breakdown', json_build_object(
      'mulai', foto_mulai_count,
      'selesai', foto_selesai_count,
      'aktivitas', foto_aktivitas_count,
      'ticket', foto_ticket_count
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_storage_stats() TO authenticated;`;

  function copyToClipboard() {
    navigator.clipboard.writeText(rpcSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  }

  function getStatusBadge(percent: number) {
    if (percent >= 85) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-800">
          <AlertTriangle className="h-3 w-3" /> Kritis (&gt;85%)
        </span>
      );
    }
    if (percent >= 70) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-3 w-3" /> Perhatian (&gt;70%)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400 border border-green-200 dark:border-green-800">
        <CheckCircle2 className="h-3 w-3" /> Sangat Aman
      </span>
    );
  }

  function getProgressColor(percent: number) {
    if (percent >= 85) return 'bg-red-500';
    if (percent >= 70) return 'bg-amber-500';
    return 'bg-blue-600';
  }

  return (
    <div className="space-y-6">
      {/* Header bar with Refresh button & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                Paket: Supabase Free Tier
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-md border border-emerald-200/60 dark:border-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Terkoneksi
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {stats.isLive ? 'Metrik riil live dari disk Supabase.' : 'Metrik kalkulasi dari data tabel absensi.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
          <span>{isRefreshing ? 'Memperbarui...' : 'Refresh Data'}</span>
        </button>
      </div>

      {/* 2 KARTU UTAMA: STORAGE FOTO & DATABASE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* KARTU 1: STORAGE BUKTI FOTO */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <ImageIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                  Storage Bukti Foto
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  Bucket Supabase: <code className="bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">evidence</code>
                </p>
              </div>
            </div>
            {getStatusBadge(storagePercent)}
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-2xl font-extrabold text-gray-900 dark:text-slate-100">
                {formatBytes(storageUsed)}
              </span>
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                dari {formatBytes(storageLimit)} ({storagePercent.toFixed(1)}%)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${getProgressColor(storagePercent)}`}
                style={{ width: `${Math.max(1, storagePercent)}%` }}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80 space-y-2 text-xs">
            <div className="flex items-center justify-between text-gray-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                Sisa Ruang Kosong:
              </span>
              <strong className="text-gray-900 dark:text-slate-100 font-semibold">
                {formatBytes(storageRemaining)} ({storagePercentRemaining.toFixed(1)}%)
              </strong>
            </div>

            <div className="flex items-center justify-between text-gray-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-blue-500" />
                Total Foto Tersimpan:
              </span>
              <strong className="text-gray-900 dark:text-slate-100 font-semibold">
                {stats.storageFileCount.toLocaleString('id-ID')} file
              </strong>
            </div>

            <div className="flex items-center justify-between text-gray-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Estimasi Daya Tampung:
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                ± {estimatedRemainingPhotos.toLocaleString('id-ID')} foto lagi
              </span>
            </div>
          </div>
        </div>

        {/* KARTU 2: DATABASE POSTGRESQL */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                  Database PostgreSQL
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  Tabel Absensi, Profil, &amp; Relasi
                </p>
              </div>
            </div>
            {getStatusBadge(dbPercent)}
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-2xl font-extrabold text-gray-900 dark:text-slate-100">
                {formatBytes(dbUsed)}
              </span>
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                dari {formatBytes(dbLimit)} ({dbPercent.toFixed(1)}%)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${getProgressColor(dbPercent)}`}
                style={{ width: `${Math.max(1, dbPercent)}%` }}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80 space-y-2 text-xs">
            <div className="flex items-center justify-between text-gray-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                Sisa Kuota Database:
              </span>
              <strong className="text-gray-900 dark:text-slate-100 font-semibold">
                {formatBytes(dbRemaining)} ({dbPercentRemaining.toFixed(1)}%)
              </strong>
            </div>

            <div className="flex items-center justify-between text-gray-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-500" />
                Data Absensi Tercatat:
              </span>
              <strong className="text-gray-900 dark:text-slate-100 font-semibold">
                {stats.attendancesCount.toLocaleString('id-ID')} baris
              </strong>
            </div>

            <div className="flex items-center justify-between text-gray-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-purple-500" />
                Pengguna Terdaftar:
              </span>
              <strong className="text-gray-900 dark:text-slate-100 font-semibold">
                {stats.profilesCount.toLocaleString('id-ID')} akun
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* RINCIAN KOMPOSISI FOTO BUKTI */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Camera className="h-4 w-4 text-blue-500" />
            Komposisi Bukti Foto di Storage
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Sebaran jenis foto yang saat ini menempati kapasitas bucket bukti piket.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-50 dark:bg-slate-800/60 p-3 rounded-xl border border-gray-100 dark:border-slate-700/60 text-center">
            <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400 block mb-1">
              1. Mulai Piket
            </span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {stats.breakdown.mulai.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">foto</span>
          </div>

          <div className="bg-gray-50 dark:bg-slate-800/60 p-3 rounded-xl border border-gray-100 dark:border-slate-700/60 text-center">
            <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400 block mb-1">
              2. Selesai Piket
            </span>
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {stats.breakdown.selesai.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">foto</span>
          </div>

          <div className="bg-gray-50 dark:bg-slate-800/60 p-3 rounded-xl border border-gray-100 dark:border-slate-700/60 text-center">
            <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400 block mb-1">
              3. Aktivitas Shift
            </span>
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {stats.breakdown.aktivitas.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">foto</span>
          </div>

          <div className="bg-gray-50 dark:bg-slate-800/60 p-3 rounded-xl border border-gray-100 dark:border-slate-700/60 text-center">
            <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400 block mb-1">
              4. Screenshot Tiket
            </span>
            <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {stats.breakdown.ticket.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">foto</span>
          </div>
        </div>
      </div>

      {/* PANDUAN & ATURAN KUOTA SUPABASE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-500" />
          Ketentuan &amp; Batasan Supabase Free Tier
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 space-y-1">
            <strong className="text-gray-900 dark:text-slate-200 block">Kapasitas Storage: 1 GB</strong>
            <p className="text-gray-600 dark:text-slate-400">
              Cukup untuk menampung sekitar 2.500 – 4.000 foto bukti (foto otomatis dikompresi di browser ke format JPEG ~300 KB).
            </p>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 space-y-1">
            <strong className="text-gray-900 dark:text-slate-200 block">Kapasitas Database: 500 MB</strong>
            <p className="text-gray-600 dark:text-slate-400">
              Khusus data teks (shift, catatan, profil akun). Sangat luas dan dapat menampung ratusan ribu data absensi harian.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 space-y-1">
            <strong className="text-gray-900 dark:text-slate-200 block">Bandwidth Download: 2 GB / bulan</strong>
            <p className="text-gray-600 dark:text-slate-400">
              Kuota pengambilan gambar dari Supabase ke tampilan browser pengguna.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 space-y-1">
            <strong className="text-gray-900 dark:text-slate-200 block">Anti-Pause Otomatis: Aktif</strong>
            <p className="text-gray-600 dark:text-slate-400">
              Project Supabase gratis tidak akan pernah tertidur (*paused*) karena ada aktivitas piket harian secara rutin.
            </p>
          </div>
        </div>
      </div>

      {/* PETUNJUK OPTIONAL: AKTIFKAN LIVE RPC DISK STATS */}
      {!stats.isLive && (
        <div className="bg-amber-50 dark:bg-amber-950/40 rounded-2xl p-4 border border-amber-200 dark:border-amber-800/60 text-xs space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span>Ingin pembacaan disk riil dari PostgreSQL?</span>
            </div>
            <button
              type="button"
              onClick={() => setShowSqlGuide(!showSqlGuide)}
              className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:underline"
            >
              {showSqlGuide ? 'Sembunyikan SQL' : 'Lihat Skrip SQL RPC'}
            </button>
          </div>
          <p className="text-amber-800 dark:text-amber-400 leading-relaxed">
            Saat ini metrik di atas dihitung berdasarkan jumlah baris di tabel. Jika ingin membaca kapasitas persis dari disk fisik PostgreSQL (`pg_database_size`) dan objek storage Supabase, jalankan fungsi RPC di Supabase SQL Editor.
          </p>

          {showSqlGuide && (
            <div className="mt-3 space-y-2 pt-2 border-t border-amber-200/80 dark:border-amber-800/60">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-900 dark:text-amber-200">
                  Skrip: migration_monitoring_stats.sql
                </span>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/60 hover:bg-amber-200 text-amber-900 dark:text-amber-200 rounded-lg text-[11px] font-medium transition-colors"
                >
                  {copiedSql ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedSql ? 'Tersalin!' : 'Salin SQL'}</span>
                </button>
              </div>
              <pre className="p-3 bg-black/80 text-amber-200 rounded-xl overflow-x-auto text-[11px] font-mono leading-tight max-h-48">
                {rpcSql}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

