import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { getDefaultFaviconUrl, normalizeAppUrl, normalizeIconUrl } from '@/lib/more-apps-utils';
import type { MoreAppItem } from '@/lib/supabase/types';

const FALLBACK_SETTINGS_KEY = 'more_apps_shortcuts';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface MoreAppWriteInput {
  name: string;
  url: string;
  iconUrl?: string | null;
}

function isMissingTableError(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('more_apps') && (msg.includes('does not exist') || msg.includes('schema cache'));
}

function sortApps(items: MoreAppItem[]): MoreAppItem[] {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at.localeCompare(b.created_at);
  });
}

async function readFallbackApps(supabase: SupabaseServerClient): Promise<MoreAppItem[]> {
  const { data } = await supabase
    .from('ticketing_settings')
    .select('value')
    .eq('key', FALLBACK_SETTINGS_KEY)
    .maybeSingle();

  if (!Array.isArray(data?.value)) return [];
  return sortApps(data.value as MoreAppItem[]);
}

async function writeFallbackApps(supabase: SupabaseServerClient, items: MoreAppItem[]): Promise<{ error?: string }> {
  const normalized = items.map((item, idx) => ({ ...item, sort_order: idx }));
  const { error } = await supabase
    .from('ticketing_settings')
    .upsert({
      key: FALLBACK_SETTINGS_KEY,
      value: normalized,
      updated_at: new Date().toISOString(),
    });

  return error ? { error: error.message } : {};
}

/**
 * Mengambil seluruh daftar shortcut More App untuk semua role terautentikasi.
 */
export async function getMoreApps(): Promise<{ items: MoreAppItem[]; usingFallback: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { items: [], usingFallback: false };

  const { data, error } = await supabase
    .from('more_apps')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      const fallbackItems = await readFallbackApps(supabase);
      return { items: fallbackItems, usingFallback: true };
    }
    console.error('Error fetching more_apps:', error);
    return { items: [], usingFallback: false };
  }

  const rows = (data ?? []) as MoreAppItem[];
  if (rows.length === 0) {
    const fallbackItems = await readFallbackApps(supabase);
    if (fallbackItems.length > 0) {
      // Sinkronkan otomatis data fallback pra-migrasi saat tabel sudah dibuat
      const { canManageSettings } = await getCurrentUserProfile();
      if (canManageSettings) {
        const { error: seedError } = await supabase.from('more_apps').upsert(fallbackItems);
        if (!seedError) {
          await writeFallbackApps(supabase, []);
          return { items: fallbackItems, usingFallback: false };
        }
      }
      return { items: fallbackItems, usingFallback: false };
    }
  }

  return { items: rows, usingFallback: false };
}

function validateAppInput(input: MoreAppWriteInput):
  | { ok: true; name: string; url: string; iconUrl: string | null }
  | { ok: false; error: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'Nama aplikasi wajib diisi.' };
  if (name.length > 80) return { ok: false, error: 'Nama aplikasi maksimal 80 karakter.' };

  const parsedUrl = normalizeAppUrl(input.url);
  if (!parsedUrl.ok) return { ok: false, error: parsedUrl.error };

  const cleanIcon = normalizeIconUrl(input.iconUrl) ?? getDefaultFaviconUrl(parsedUrl.url);
  return { ok: true, name, url: parsedUrl.url, iconUrl: cleanIcon };
}

export async function createMoreApp(
  input: MoreAppWriteInput
): Promise<{ success: boolean; error?: string; item?: MoreAppItem }> {
  const { canManageSettings, userId } = await getCurrentUserProfile();
  if (!canManageSettings || !userId) {
    return { success: false, error: 'Hanya role Admin Piket ke atas yang dapat mengelola More App.' };
  }

  const validated = validateAppInput(input);
  if (!validated.ok) return { success: false, error: validated.error };

  const supabase = await createClient();
  const { items: existing, usingFallback } = await getMoreApps();
  const nextOrder = existing.length > 0 ? Math.max(...existing.map((i) => i.sort_order)) + 1 : 0;
  const now = new Date().toISOString();

  if (usingFallback) {
    const newItem: MoreAppItem = {
      id: randomUUID(),
      name: validated.name,
      url: validated.url,
      icon_url: validated.iconUrl,
      sort_order: nextOrder,
      created_by: userId,
      created_at: now,
      updated_at: now,
    };
    const res = await writeFallbackApps(supabase, [...existing, newItem]);
    if (res.error) return { success: false, error: res.error };
    return { success: true, item: newItem };
  }

  const { data, error } = await supabase
    .from('more_apps')
    .insert({
      name: validated.name,
      url: validated.url,
      icon_url: validated.iconUrl,
      sort_order: nextOrder,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, item: data as MoreAppItem };
}

export async function updateMoreApp(
  id: string,
  input: MoreAppWriteInput
): Promise<{ success: boolean; error?: string }> {
  const { canManageSettings, userId } = await getCurrentUserProfile();
  if (!canManageSettings || !userId) {
    return { success: false, error: 'Hanya role Admin Piket ke atas yang dapat mengelola More App.' };
  }

  const validated = validateAppInput(input);
  if (!validated.ok) return { success: false, error: validated.error };

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('more_apps')
    .update({
      name: validated.name,
      url: validated.url,
      icon_url: validated.iconUrl,
      updated_at: now,
    })
    .eq('id', id);

  if (error) {
    if (isMissingTableError(error)) {
      const existing = await readFallbackApps(supabase);
      const updated = existing.map((item) =>
        item.id === id
          ? {
              ...item,
              name: validated.name,
              url: validated.url,
              icon_url: validated.iconUrl,
              updated_at: now,
            }
          : item
      );
      const res = await writeFallbackApps(supabase, updated);
      return res.error ? { success: false, error: res.error } : { success: true };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteMoreApp(id: string): Promise<{ success: boolean; error?: string }> {
  const { canManageSettings, userId } = await getCurrentUserProfile();
  if (!canManageSettings || !userId) {
    return { success: false, error: 'Hanya role Admin Piket ke atas yang dapat mengelola More App.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('more_apps').delete().eq('id', id);

  if (error) {
    if (isMissingTableError(error)) {
      const existing = await readFallbackApps(supabase);
      const filtered = existing.filter((item) => item.id !== id);
      const res = await writeFallbackApps(supabase, filtered);
      return res.error ? { success: false, error: res.error } : { success: true };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function reorderMoreApps(orderedIds: string[]): Promise<{ success: boolean; error?: string }> {
  const { canManageSettings, userId } = await getCurrentUserProfile();
  if (!canManageSettings || !userId) {
    return { success: false, error: 'Hanya role Admin Piket ke atas yang dapat mengelola urutan More App.' };
  }

  if (orderedIds.length === 0) return { success: true };

  const supabase = await createClient();
  const { items, usingFallback } = await getMoreApps();
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const orderedItems = orderedIds
    .map((id) => itemMap.get(id))
    .filter((item): item is MoreAppItem => Boolean(item));
  const remaining = items.filter((item) => !orderedIds.includes(item.id));
  const merged = [...orderedItems, ...remaining].map((item, idx) => ({
    ...item,
    sort_order: idx,
  }));

  if (usingFallback) {
    const res = await writeFallbackApps(supabase, merged);
    return res.error ? { success: false, error: res.error } : { success: true };
  }

  const now = new Date().toISOString();
  const results = await Promise.all(
    merged.map((item) =>
      supabase
        .from('more_apps')
        .update({ sort_order: item.sort_order, updated_at: now })
        .eq('id', item.id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { success: false, error: failed.error.message };
  }

  return { success: true };
}
