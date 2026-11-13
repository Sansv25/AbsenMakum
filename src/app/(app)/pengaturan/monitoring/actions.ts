'use server';

import { revalidatePath } from 'next/cache';
import { getStorageStats, type StorageStats } from '@/lib/data/monitoring';

export async function refreshStorageStatsAction(): Promise<{ stats: StorageStats | null; error?: string }> {
  revalidatePath('/pengaturan/monitoring');
  return await getStorageStats();
}

