const TIMEZONE = 'Asia/Makassar';

/** Tanggal hari ini di zona WITA sebagai string YYYY-MM-DD */
export function todayWITA(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
}

/** Format tanggal Indonesia: "Senin, 5 Oktober 2026" */
export function formatIndonesia(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Format tanggal pendek: "5 Okt 2026" */
export function formatShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Nama hari dalam bahasa Indonesia */
export function getDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'UTC' }).format(date);
}

/** Semua tanggal dalam satu bulan: YYYY-MM */
export function getDatesInMonth(yearMonth: string): string[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    const mon = String(m).padStart(2, '0');
    return `${y}-${mon}-${day}`;
  });
}

/** YYYY-MM dari string YYYY-MM-DD */
export function toYearMonth(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** Jam dan menit saat ini di WITA sebagai string "HH.MM.SS" */
export function nowTimeWITA(): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: TIMEZONE,
  })
    .format(new Date())
    .replace(/:/g, '.');
}

/** Tanggal + waktu WITA untuk overlay kamera: "5 Okt 2026 14.22.32" */
export function nowDateTimeWITA(): string {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TIMEZONE,
  }).format(now);
  const timeStr = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: TIMEZONE,
  })
    .format(now)
    .replace(/:/g, '.');
  return `${dateStr} ${timeStr}`;
}
