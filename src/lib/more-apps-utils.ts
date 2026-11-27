import type { AppRole, MoreAppItem } from '@/lib/supabase/types';

export const VALID_APP_ROLES: AppRole[] = [
  'owner',
  'admin',
  'senior',
  'piket',
  'freelance',
  'magang',
  'tiket',
];

export const ROLE_SHORT_LABELS: Record<AppRole, string> = {
  owner: 'Owner',
  admin: 'Admin Piket',
  senior: 'Senior',
  piket: 'Petugas Piket',
  freelance: 'Freelance',
  magang: 'Magang',
  tiket: 'Tiket',
};

/**
 * Checks whether an app shortcut has restricted visibility beyond "Semua Pengguna".
 */
export function isRestrictedApp(item: Pick<MoreAppItem, 'allowed_roles' | 'allowed_user_ids'>): boolean {
  const rolesCount = item.allowed_roles?.length ?? 0;
  const usersCount = item.allowed_user_ids?.length ?? 0;
  return rolesCount > 0 || usersCount > 0;
}

/**
 * Formats a concise access summary label for Owner view.
 */
export function formatAppAccessSummary(item: Pick<MoreAppItem, 'allowed_roles' | 'allowed_user_ids'>): string {
  const roles = item.allowed_roles ?? [];
  const users = item.allowed_user_ids ?? [];
  if (roles.length === 0 && users.length === 0) return 'Semua';

  const parts: string[] = [];
  if (roles.length > 0) {
    parts.push(roles.slice(0, 2).map((r) => ROLE_SHORT_LABELS[r] || r).join(', ') + (roles.length > 2 ? ` +${roles.length - 2}` : ''));
  }
  if (users.length > 0) {
    parts.push(`${users.length} orang`);
  }
  return parts.join(' • ');
}

/**
 * Normalizes a user-supplied shortcut URL to http/https and validates safety.
 * Rejects dangerous protocols such as javascript:, data:, or file:.
 */
export function normalizeAppUrl(rawUrl: string): { ok: true; url: string; hostname: string } | { ok: false; error: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: 'URL aplikasi wajib diisi.' };
  }

  // Block explicit non-http(s) schemes early
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return { ok: false, error: 'Hanya URL http:// atau https:// yang diizinkan.' };
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: 'Hanya URL http:// atau https:// yang diizinkan.' };
    }
    if (!parsed.hostname || parsed.hostname.length < 2) {
      return { ok: false, error: 'Format domain/host URL tidak valid.' };
    }
    return { ok: true, url: parsed.toString(), hostname: parsed.hostname };
  } catch {
    return { ok: false, error: 'Format URL tidak valid.' };
  }
}

/**
 * Validates optional custom icon URLs (http/https or safe raster image data URL).
 */
export function normalizeIconUrl(rawIconUrl?: string | null): string | null {
  if (!rawIconUrl) return null;
  const trimmed = rawIconUrl.trim();
  if (!trimmed) return null;

  if (
    trimmed.length <= 150_000 &&
    /^data:image\/(png|jpeg|jpg|webp|gif|x-icon|vnd\.microsoft\.icon);base64,[a-zA-Z0-9+/=]+$/i.test(trimmed)
  ) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Checks whether a hostname points to a local or private network address.
 */
export function isPrivateOrLocalHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.local') || lower.endsWith('.internal')) {
    return true;
  }
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(lower)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) {
    return true;
  }
  if (lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
    return true;
  }
  return false;
}

/**
 * Builds the default high-resolution favicon URL for an app URL.
 */
export function getDefaultFaviconUrl(appUrl: string): string | null {
  try {
    const parsed = new URL(appUrl);
    if (isPrivateOrLocalHostname(parsed.hostname)) {
      return `${parsed.origin}/favicon.ico`;
    }
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=128`;
  } catch {
    return null;
  }
}

/**
 * Extracts a clean display host without leading www.
 */
export function getDisplayHost(appUrl: string): string {
  try {
    return new URL(appUrl).hostname.replace(/^www\./i, '');
  } catch {
    return appUrl;
  }
}

/**
 * Returns 1-2 uppercase initials for icon fallback badges.
 */
export function getAppInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'AP';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}
