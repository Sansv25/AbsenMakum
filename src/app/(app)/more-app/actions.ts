'use server';

import { revalidatePath } from 'next/cache';
import {
  createMoreApp,
  deleteMoreApp,
  reorderMoreApps,
  updateMoreApp,
} from '@/lib/data/more-apps';
import type { MoreAppItem } from '@/lib/supabase/types';

export async function createMoreAppAction(input: {
  name: string;
  url: string;
  iconUrl?: string | null;
}): Promise<{ success: boolean; error?: string; item?: MoreAppItem }> {
  const result = await createMoreApp(input);
  if (!result.success) {
    return { success: false, error: result.error || 'Gagal menyimpan shortcut aplikasi.' };
  }
  revalidatePath('/more-app');
  return { success: true, item: result.item };
}

export async function updateMoreAppAction(
  id: string,
  input: {
    name: string;
    url: string;
    iconUrl?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const result = await updateMoreApp(id, input);
  if (!result.success) {
    return { success: false, error: result.error || 'Gagal memperbarui shortcut aplikasi.' };
  }
  revalidatePath('/more-app');
  return { success: true };
}

export async function deleteMoreAppAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const result = await deleteMoreApp(id);
  if (!result.success) {
    return { success: false, error: result.error || 'Gagal menghapus shortcut aplikasi.' };
  }
  revalidatePath('/more-app');
  return { success: true };
}

export async function reorderMoreAppsAction(
  orderedIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const result = await reorderMoreApps(orderedIds);
  if (!result.success) {
    return { success: false, error: result.error || 'Gagal menyimpan urutan shortcut.' };
  }
  revalidatePath('/more-app');
  return { success: true };
}
