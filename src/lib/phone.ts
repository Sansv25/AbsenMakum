/**
 * Utilitas format & normalisasi nomor telepon Indonesia (+62)
 */

/**
 * Mengubah input nomor telepon menjadi format internasional kanonikal (+628xxxxxxxxxx)
 * Menangani:
 * - "081234567890"   -> "+6281234567890"
 * - "81234567890"    -> "+6281234567890"
 * - "6281234567890"  -> "+6281234567890"
 * - "+6281234567890" -> "+6281234567890"
 * - "+620812345678"  -> "+62812345678"
 */
export function normalizeIndonesianPhone(input: string | null | undefined): string {
  if (!input) return '';
  let clean = input.trim().replace(/[^0-9+]/g, '');

  if (clean.startsWith('+')) {
    clean = clean.slice(1);
  }

  if (clean.startsWith('62')) {
    clean = clean.slice(2);
  }

  // Hapus angka 0 di awal (misal: 0812...)
  clean = clean.replace(/^0+/, '');

  if (clean.length > 0) {
    return `+62${clean}`;
  }
  return '';
}

/**
 * Ekstrak hanya digit lokal tanpa prefix +62 / 0 untuk form input ber-addon +62
 * Contoh: "+6281234567890" -> "81234567890"
 */
export function extractLocalPhoneDigits(input: string | null | undefined): string {
  if (!input) return '';
  let clean = input.trim().replace(/[^0-9]/g, '');
  if (clean.startsWith('62')) {
    clean = clean.slice(2);
  }
  clean = clean.replace(/^0+/, '');
  return clean;
}

/**
 * Validasi apakah nomor HP Indonesia valid:
 * Harus berawalan +628 dan panjang digit setelah +62 berkisar antara 9 - 13 digit.
 */
export function isValidIndonesianPhone(phone: string): boolean {
  const normalized = normalizeIndonesianPhone(phone);
  return /^\+628[1-9][0-9]{7,12}$/.test(normalized);
}

/**
 * Format nomor telepon untuk tampilan rapi (misal: +62 812-3456-7890)
 */
export function formatIndonesianPhone(phone: string | null | undefined): string {
  const norm = normalizeIndonesianPhone(phone);
  if (!norm.startsWith('+62')) return phone || '-';
  const digits = norm.slice(3); // sisa digit setelah +62
  if (digits.length <= 3) return `+62 ${digits}`;
  if (digits.length <= 7) return `+62 ${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `+62 ${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/**
 * Konversi nomor telepon menjadi format WhatsApp URL (628xxxxxxxxxx tanpa tanda +)
 */
export function toWhatsAppNumber(phone: string | null | undefined): string {
  const norm = normalizeIndonesianPhone(phone);
  return norm.replace(/^\+/, '');
}
