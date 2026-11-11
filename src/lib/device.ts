'use client';

const DEVICE_STORAGE_KEY = 'piket_device_token';
const DEVICE_COOKIE_NAME = 'piket_device_id';

/**
 * Mengambil atau membuat ID unik perangkat di browser klien.
 * Disimpan di localStorage dan Cookie agar bisa dibaca baik di client maupun server.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';

  let deviceId = localStorage.getItem(DEVICE_STORAGE_KEY);

  if (!deviceId || deviceId.trim().length === 0) {
    deviceId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
  }

  // Set cookie agar bisa dibaca Server Action jika diperlukan (1 tahun)
  try {
    document.cookie = `${DEVICE_COOKIE_NAME}=${deviceId}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // Ignore cookie error jika di sandbox
  }

  return deviceId;
}

/**
 * Menghasilkan deskripsi nama perangkat yang ramah pengguna
 * Contoh: "HP Android (Chrome)", "iPhone (Safari)", "PC Windows (Edge)"
 */
export function getDeviceLabel(): string {
  if (typeof window === 'undefined') return 'Perangkat Tidak Diketahui';

  const ua = navigator.userAgent;
  let os = 'Perangkat Lain';
  let deviceType = 'Desktop';

  if (/android/i.test(ua)) {
    os = 'Android';
    deviceType = 'HP';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS';
    deviceType = /ipad/i.test(ua) ? 'Tablet' : 'iPhone';
  } else if (/windows nt/i.test(ua)) {
    os = 'Windows';
    deviceType = 'PC';
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS';
    deviceType = 'Mac';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
    deviceType = 'PC';
  }

  let browser = 'Browser';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  return `${deviceType} ${os} (${browser})`;
}
