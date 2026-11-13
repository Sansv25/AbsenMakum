import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data/profile';

export interface StorageStats {
  isLive: boolean;
  dbSizeBytes: number;
  dbLimitBytes: number;
  storageSizeBytes: number;
  storageLimitBytes: number;
  storageFileCount: number;
  attendancesCount: number;
  attachmentsCount: number;
  profilesCount: number;
  breakdown: {
    mulai: number;
    selesai: number;
    aktivitas: number;
    ticket: number;
  };
  lastChecked: string;
}

export async function getStorageStats(): Promise<{ stats: StorageStats | null; error?: string }> {
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { stats: null, error: 'Hanya Akun Master yang diizinkan mengakses monitoring kapasitas.' };
  }

  const supabase = await createClient();

  // 1. Coba panggil RPC get_system_storage_stats jika sudah di-run di database
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_system_storage_stats');
    if (!rpcError && rpcData && rpcData.success) {
      return {
        stats: {
          isLive: true,
          dbSizeBytes: Number(rpcData.db_size_bytes) || 0,
          dbLimitBytes: Number(rpcData.db_limit_bytes) || 524288000,
          storageSizeBytes: Number(rpcData.storage_size_bytes) || 0,
          storageLimitBytes: Number(rpcData.storage_limit_bytes) || 1073741824,
          storageFileCount: Number(rpcData.storage_file_count) || 0,
          attendancesCount: Number(rpcData.attendances_count) || 0,
          attachmentsCount: Number(rpcData.attachments_count) || 0,
          profilesCount: Number(rpcData.profiles_count) || 0,
          breakdown: {
            mulai: Number(rpcData.breakdown?.mulai) || 0,
            selesai: Number(rpcData.breakdown?.selesai) || 0,
            aktivitas: Number(rpcData.breakdown?.aktivitas) || 0,
            ticket: Number(rpcData.breakdown?.ticket) || 0,
          },
          lastChecked: new Date().toISOString(),
        },
      };
    }
  } catch {
    // Fallback ke pembacaan tabel langsung
  }

  // 2. Fallback: Query tabel langsung (bila RPC belum dibuat di Supabase)
  try {
    const [attRes, attCountRes, profCountRes] = await Promise.all([
      supabase.from('attachments').select('kind'),
      supabase.from('attendances').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ]);

    const attachmentsList = attRes.data ?? [];
    const attachmentsCount = attachmentsList.length;
    const attendancesCount = attCountRes.count ?? 0;
    const profilesCount = profCountRes.count ?? 0;

    const breakdown = {
      mulai: attachmentsList.filter((a) => a.kind === 'mulai').length,
      selesai: attachmentsList.filter((a) => a.kind === 'selesai').length,
      aktivitas: attachmentsList.filter((a) => a.kind === 'aktivitas').length,
      ticket: attachmentsList.filter((a) => a.kind === 'ticket').length,
    };

    // Rata-rata foto terkompresi ~320 KB (327,680 byte)
    const estimatedStorageBytes = attachmentsCount * 327680;
    // Estimasi ukuran Postgres dengan overhead index ~ 15 MB base + row data
    const estimatedDbBytes = (attendancesCount * 2500) + (attachmentsCount * 1200) + (profilesCount * 3000) + 12582912;

    return {
      stats: {
        isLive: false,
        dbSizeBytes: estimatedDbBytes,
        dbLimitBytes: 524288000, // 500 MB
        storageSizeBytes: estimatedStorageBytes,
        storageLimitBytes: 1073741824, // 1 GB
        storageFileCount: attachmentsCount,
        attendancesCount,
        attachmentsCount,
        profilesCount,
        breakdown,
        lastChecked: new Date().toISOString(),
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil data monitoring';
    return { stats: null, error: msg };
  }
}

