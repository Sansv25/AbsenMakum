import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile, type UserProfileInfo } from '@/lib/data/profile';
import {
  getDefaultFaviconUrl,
  isRestrictedApp,
  normalizeAppUrl,
  normalizeIconUrl,
  VALID_APP_ROLES,
} from '@/lib/more-apps-utils';
import type { AppRole, MoreAppItem, MoreAppUserOption } from '@/lib/supabase/types';

const FALLBACK_SETTINGS_KEY = 'more_apps_shortcuts';
const FALLBACK_ACCESS_KEY = 'more_apps_access_fallback';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface MoreAppWriteInput {
  name: string;
  url: string;
  iconUrl?: string | null;
  allowedRoles?: AppRole[];
  allowedUserIds?: string[];
}

interface AccessRule {
  allowed_roles: AppRole[];
  allowed_user_ids: string[];
}

function isMissingTableError(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('more_apps') && (msg.includes('does not exist') || msg.includes('schema cache'));
}

function isMissingAccessColumnError(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  if (error.code === '42703' || error.code === 'PGRST204') {
    return msg.includes('allowed_roles') || msg.includes('allowed_user_ids') || error.code === '42703';
  }
  return msg.includes('allowed_roles') || msg.includes('allowed_user_ids');
}

function sanitizeAccessInput(
  rawRoles?: string[] | null,
  rawUserIds?: string[] | null
): AccessRule {
  const allowed_roles = Array.from(
    new Set(
      (rawRoles ?? []).filter((r): r is AppRole => VALID_APP_ROLES.includes(r as AppRole))
    )
  );
  const allowed_user_ids = Array.from(
    new Set(
      (rawUserIds ?? [])
        .map((id) => id.trim())
        .filter((id) => UUID_REGEX.test(id))
    )
  );
  return { allowed_roles, allowed_user_ids };
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
  return sortApps(data.value as MoreAppItem[]).map((item) => ({
    ...item,
    ...sanitizeAccessInput(item.allowed_roles, item.allowed_user_ids),
  }));
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

async function readFallbackAccessMap(
  supabase: SupabaseServerClient
): Promise<Record<string, AccessRule>> {
  try {
    const { data } = await supabase
      .from('ticketing_settings')
      .select('value')
      .eq('key', FALLBACK_ACCESS_KEY)
      .maybeSingle();

    if (!data?.value || typeof data.value !== 'object' || Array.isArray(data.value)) {
      return {};
    }
    return data.value as Record<string, AccessRule>;
  } catch {
    return {};
  }
}

async function writeFallbackAccessEntry(
  supabase: SupabaseServerClient,
  appId: string,
  rule: AccessRule | null
): Promise<{ error?: string }> {
  const current = await readFallbackAccessMap(supabase);
  const nextMap: Record<string, AccessRule> = { ...current };

  if (!rule || (rule.allowed_roles.length === 0 && rule.allowed_user_ids.length === 0)) {
    delete nextMap[appId];
  } else {
    nextMap[appId] = rule;
  }

  const { error } = await supabase
    .from('ticketing_settings')
    .upsert({
      key: FALLBACK_ACCESS_KEY,
      value: nextMap,
      updated_at: new Date().toISOString(),
    });

  return error ? { error: error.message } : {};
}

function canUserViewApp(item: MoreAppItem, profile: UserProfileInfo): boolean {
  if (profile.isOwner) return true;
  const roles = item.allowed_roles ?? [];
  const users = item.allowed_user_ids ?? [];
  if (roles.length === 0 && users.length === 0) return true;
  if (profile.userId && users.includes(profile.userId)) return true;
  return roles.some((r) => profile.roles.includes(r));
}

async function getAllRawMoreApps(
  supabase: SupabaseServerClient,
  profile: UserProfileInfo
): Promise<{ items: MoreAppItem[]; usingFallback: boolean }> {
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

  let rows = (data ?? []) as MoreAppItem[];
  if (rows.length === 0) {
    const fallbackItems = await readFallbackApps(supabase);
    if (fallbackItems.length > 0) {
      if (profile.canManageSettings) {
        const { error: seedError } = await supabase.from('more_apps').upsert(fallbackItems);
        if (!seedError) {
          await writeFallbackApps(supabase, []);
          rows = fallbackItems;
        } else if (isMissingAccessColumnError(seedError)) {
          const rowsWithoutAccess = fallbackItems.map((it) => {
            const { allowed_roles: _r, allowed_user_ids: _u, ...rest } = it;
            void _r;
            void _u;
            return rest;
          });
          const { error: basicSeedErr } = await supabase.from('more_apps').upsert(rowsWithoutAccess);
          if (!basicSeedErr) {
            for (const it of fallbackItems) {
              if (isRestrictedApp(it)) {
                await writeFallbackAccessEntry(supabase, it.id, {
                  allowed_roles: it.allowed_roles ?? [],
                  allowed_user_ids: it.allowed_user_ids ?? [],
                });
              }
            }
            await writeFallbackApps(supabase, []);
            rows = fallbackItems;
          }
        }
      }
      if (rows.length === 0) {
        rows = fallbackItems;
      }
    }
  }

  const fallbackAccessMap = await readFallbackAccessMap(supabase);
  const merged = rows.map((row) => {
    const hasNativeCols =
      Array.isArray(row.allowed_roles) || Array.isArray(row.allowed_user_ids);
    if (hasNativeCols) {
      return {
        ...row,
        ...sanitizeAccessInput(row.allowed_roles, row.allowed_user_ids),
      };
    }
    const fbRule = fallbackAccessMap[row.id];
    return {
      ...row,
      allowed_roles: fbRule?.allowed_roles ?? [],
      allowed_user_ids: fbRule?.allowed_user_ids ?? [],
    };
  });

  return { items: merged, usingFallback: false };
}

/**
 * Mengambil daftar shortcut More App yang boleh dilihat pengguna saat ini.
 */
export async function getMoreApps(): Promise<{ items: MoreAppItem[]; usingFallback: boolean }> {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile();
  if (!profile.userId) return { items: [], usingFallback: false };

  const { items, usingFallback } = await getAllRawMoreApps(supabase, profile);
  const visibleItems = items.filter((item) => canUserViewApp(item, profile));
  return { items: visibleItems, usingFallback };
}

/**
 * Mengambil daftar user terdaftar untuk pemilih akses More App (Khusus Owner).
 */
export async function getMoreAppUserOptions(): Promise<MoreAppUserOption[]> {
  const profile = await getCurrentUserProfile();
  if (!profile.isOwner) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, roles, is_approved')
    .order('full_name', { ascending: true });

  if (error || !data) return [];

  return data
    .filter((u) => u.is_approved !== false)
    .map((u) => {
      const resolvedRoles: AppRole[] =
        Array.isArray(u.roles) && u.roles.length > 0
          ? (u.roles as AppRole[])
          : u.role === 'master'
            ? ['admin']
            : ['magang'];
      return {
        id: u.id as string,
        full_name: (u.full_name as string | null) ?? null,
        email: (u.email as string) || '',
        roles: resolvedRoles,
      };
    });
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
  const profile = await getCurrentUserProfile();
  if (!profile.canManageSettings || !profile.userId) {
    return { success: false, error: 'Hanya role Admin Piket ke atas yang dapat mengelola More App.' };
  }

  const validated = validateAppInput(input);
  if (!validated.ok) return { success: false, error: validated.error };

  const accessRule: AccessRule = profile.isOwner
    ? sanitizeAccessInput(input.allowedRoles, input.allowedUserIds)
    : { allowed_roles: [], allowed_user_ids: [] };

  const supabase = await createClient();
  const { items: existing, usingFallback } = await getAllRawMoreApps(supabase, profile);
  const nextOrder = existing.length > 0 ? Math.max(...existing.map((i) => i.sort_order)) + 1 : 0;
  const now = new Date().toISOString();

  if (usingFallback) {
    const newItem: MoreAppItem = {
      id: randomUUID(),
      name: validated.name,
      url: validated.url,
      icon_url: validated.iconUrl,
      sort_order: nextOrder,
      allowed_roles: accessRule.allowed_roles,
      allowed_user_ids: accessRule.allowed_user_ids,
      created_by: profile.userId,
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
      allowed_roles: accessRule.allowed_roles,
      allowed_user_ids: accessRule.allowed_user_ids,
      created_by: profile.userId,
    })
    .select('*')
    .single();

  if (error) {
    if (isMissingAccessColumnError(error)) {
      const { data: basicData, error: basicErr } = await supabase
        .from('more_apps')
        .insert({
          name: validated.name,
          url: validated.url,
          icon_url: validated.iconUrl,
          sort_order: nextOrder,
          created_by: profile.userId,
        })
        .select('*')
        .single();

      if (basicErr || !basicData) {
        return { success: false, error: basicErr?.message || 'Gagal menyimpan shortcut.' };
      }

      if (profile.isOwner && (accessRule.allowed_roles.length > 0 || accessRule.allowed_user_ids.length > 0)) {
        await writeFallbackAccessEntry(supabase, basicData.id, accessRule);
      }

      return {
        success: true,
        item: { ...(basicData as MoreAppItem), ...accessRule },
      };
    }
    return { success: false, error: error.message };
  }

  return { success: true, item: data as MoreAppItem };
}

export async function updateMoreApp(
  id: string,
  input: MoreAppWriteInput
): Promise<{ success: boolean; error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile.canManageSettings || !profile.userId) {
    return { success: false, error: 'Hanya role Admin Piket ke atas yang dapat mengelola More App.' };
  }

  const validated = validateAppInput(input);
  if (!validated.ok) return { success: false, error: validated.error };

  const supabase = await createClient();
  const { items: existingAll, usingFallback } = await getAllRawMoreApps(supabase, profile);
  const existingItem = existingAll.find((it) => it.id === id);

  if (!existingItem) {
    return { success: false, error: 'Shortcut aplikasi tidak ditemukan.' };
  }

  if (!profile.isOwner && isRestrictedApp(existingItem)) {
    return {
      success: false,
      error: 'Shortcut dengan pengaturan akses khusus hanya dapat diubah oleh Owner.',
    };
  }

  const nextAccess: AccessRule =
    profile.isOwner && (input.allowedRoles !== undefined || input.allowedUserIds !== undefined)
      ? sanitizeAccessInput(input.allowedRoles, input.allowedUserIds)
      : {
          allowed_roles: existingItem.allowed_roles ?? [],
          allowed_user_ids: existingItem.allowed_user_ids ?? [],
        };

  const now = new Date().toISOString();

  if (usingFallback) {
    const updated = existingAll.map((item) =>
      item.id === id
        ? {
            ...item,
            name: validated.name,
            url: validated.url,
            icon_url: validated.iconUrl,
            allowed_roles: nextAccess.allowed_roles,
            allowed_user_ids: nextAccess.allowed_user_ids,
            updated_at: now,
          }
        : item
    );
    const res = await writeFallbackApps(supabase, updated);
    return res.error ? { success: false, error: res.error } : { success: true };
  }

  const { error } = await supabase
    .from('more_apps')
    .update({
      name: validated.name,
      url: validated.url,
      icon_url: validated.iconUrl,
      allowed_roles: nextAccess.allowed_roles,
      allowed_user_ids: nextAccess.allowed_user_ids,
      updated_at: now,
    })
    .eq('id', id);

  if (error) {
    if (isMissingAccessColumnError(error)) {
      const { error: basicErr } = await supabase
        .from('more_apps')
        .update({
          name: validated.name,
          url: validated.url,
          icon_url: validated.iconUrl,
          updated_at: now,
        })
        .eq('id', id);

      if (basicErr) return { success: false, error: basicErr.message };

      if (profile.isOwner) {
        const fbRes = await writeFallbackAccessEntry(supabase, id, nextAccess);
        if (fbRes.error) return { success: false, error: fbRes.error };
      }
      return { success: true };
    }
    return { success: false, error: error.message };
  }

  if (profile.isOwner) {
    await writeFallbackAccessEntry(supabase, id, null);
  }
  return { success: true };
}

/**
 * Mengatur hak akses per aplikasi (Role tertentu / Orang tertentu) — Khusus Owner.
 */
export async function updateMoreAppAccess(
  id: string,
  input: { allowedRoles: AppRole[]; allowedUserIds: string[] }
): Promise<{ success: boolean; error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile.isOwner || !profile.userId) {
    return { success: false, error: 'Hanya Owner yang dapat mengelola akses More App.' };
  }

  const nextAccess = sanitizeAccessInput(input.allowedRoles, input.allowedUserIds);
  const supabase = await createClient();
  const { items: existingAll, usingFallback } = await getAllRawMoreApps(supabase, profile);
  const existingItem = existingAll.find((it) => it.id === id);

  if (!existingItem) {
    return { success: false, error: 'Shortcut aplikasi tidak ditemukan.' };
  }

  const now = new Date().toISOString();

  if (usingFallback) {
    const updated = existingAll.map((item) =>
      item.id === id
        ? {
            ...item,
            allowed_roles: nextAccess.allowed_roles,
            allowed_user_ids: nextAccess.allowed_user_ids,
            updated_at: now,
          }
        : item
    );
    const res = await writeFallbackApps(supabase, updated);
    return res.error ? { success: false, error: res.error } : { success: true };
  }

  const { error } = await supabase
    .from('more_apps')
    .update({
      allowed_roles: nextAccess.allowed_roles,
      allowed_user_ids: nextAccess.allowed_user_ids,
      updated_at: now,
    })
    .eq('id', id);

  if (error) {
    if (isMissingAccessColumnError(error)) {
      const fbRes = await writeFallbackAccessEntry(supabase, id, nextAccess);
      return fbRes.error ? { success: false, error: fbRes.error } : { success: true };
    }
    return { success: false, error: error.message };
  }

  await writeFallbackAccessEntry(supabase, id, null);
  return { success: true };
}

export async function deleteMoreApp(id: string): Promise<{ success: boolean; error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile.canManageSettings || !profile.userId) {
    return { success: false, error: 'Hanya role Admin Piket ke atas yang dapat mengelola More App.' };
  }

  const supabase = await createClient();
  const { items: existingAll, usingFallback } = await getAllRawMoreApps(supabase, profile);
  const existingItem = existingAll.find((it) => it.id === id);

  if (!existingItem) {
    return { success: false, error: 'Shortcut aplikasi tidak ditemukan.' };
  }

  if (!profile.isOwner && isRestrictedApp(existingItem)) {
    return {
      success: false,
      error: 'Shortcut dengan pengaturan akses khusus hanya dapat dihapus oleh Owner.',
    };
  }

  if (usingFallback) {
    const filtered = existingAll.filter((item) => item.id !== id);
    const res = await writeFallbackApps(supabase, filtered);
    return res.error ? { success: false, error: res.error } : { success: true };
  }

  const { error } = await supabase.from('more_apps').delete().eq('id', id);
  if (error) {
    return { success: false, error: error.message };
  }

  await writeFallbackAccessEntry(supabase, id, null);
  return { success: true };
}

export async function reorderMoreApps(orderedIds: string[]): Promise<{ success: boolean; error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile.canManageSettings || !profile.userId) {
    return { success: false, error: 'Hanya role Admin Piket ke atas yang dapat mengelola urutan More App.' };
  }

  if (orderedIds.length === 0) return { success: true };

  const supabase = await createClient();
  const { items, usingFallback } = await getAllRawMoreApps(supabase, profile);
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
