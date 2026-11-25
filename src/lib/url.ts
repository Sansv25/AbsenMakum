export const CANONICAL_APP_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.magang-iconnet.online'
).replace(/\/+$/, '');

/**
 * Mengembalikan base URL resmi aplikasi untuk tautan eksternal (QR Code, WhatsApp, dll.).
 * Mencegah QR Code mengarah ke domain lama (*.vercel.app), domain non-www yang parked,
 * atau localhost yang tidak bisa dibuka dari kamera HP rekan.
 */
export function getCanonicalAppOrigin(): string {
  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    const isLanIp = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
    if (isLanIp) {
      return origin;
    }
  }
  return CANONICAL_APP_URL;
}

/**
 * Memvalidasi path redirect internal agar aman dan mencegah open-redirect ke domain luar.
 */
export function getSafeRedirectPath(rawPath?: string | null, fallback = '/'): string {
  if (!rawPath || typeof rawPath !== 'string') return fallback;
  const trimmed = rawPath.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallback;
  }
  return trimmed;
}
