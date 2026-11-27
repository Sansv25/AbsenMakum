import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { generateServerRecapPdf } from '@/lib/server-pdf';
import { getDailyAttendanceRecap } from '@/lib/data/daily-attendance-recap';
import { todayWITA, formatIndonesia } from '@/lib/dates';
import type { Attendance, Attachment, Holiday } from '@/lib/supabase/types';

export interface EmailRecapSettings {
  id: string;
  recipients: string[];
  frequency: 'mingguan' | 'bulanan' | 'keduanya';
  isActive: boolean;
  senderName: string;
  senderEmail: string;
  brevoApiKey: string;
  sendDayWeekly: number; // 1 = Senin
  sendTime: string; // "08:00"
  lastSentAt?: string | null;
  lastStatus?: string | null;
  updatedAt?: string;

  // Konfigurasi Khusus Rekapan Absen Harian (Anak Magang)
  dailyRecipients: string[];
  dailyIsActive: boolean;
  dailySendTime: string; // "18:00"
  dailyLastSentAt?: string | null;
  dailyLastStatus?: string | null;
  dailyAutoLastSentDate?: string | null;
  dailyLastAttemptAt?: string | null;
}

const DEFAULT_FALLBACK_BREVO_KEY = process.env.BREVO_API_KEY || '';
const DEFAULT_FALLBACK_SENDER_EMAIL =
  process.env.BREVO_SENDER_EMAIL || 'madesanjaya255@gmail.com';
const DEFAULT_FALLBACK_RECIPIENTS = [
  'madesanjaya255@gmail.com',
  'magangiconnetrbnt@gmail.com',
];

const DEFAULT_SETTINGS: EmailRecapSettings = {
  id: '00000000-0000-0000-0000-000000000001',
  recipients: DEFAULT_FALLBACK_RECIPIENTS,
  frequency: 'mingguan',
  isActive: true,
  senderName: 'SANS AGEN',
  senderEmail: DEFAULT_FALLBACK_SENDER_EMAIL,
  brevoApiKey: DEFAULT_FALLBACK_BREVO_KEY,
  sendDayWeekly: 1,
  sendTime: '08:00',
  lastSentAt: null,
  lastStatus: null,
  dailyRecipients: DEFAULT_FALLBACK_RECIPIENTS,
  dailyIsActive: true,
  dailySendTime: '18:00',
  dailyLastSentAt: null,
  dailyLastStatus: null,
  dailyAutoLastSentDate: null,
  dailyLastAttemptAt: null,
};

export async function getEmailRecapSettings(customClient?: SupabaseClient | null): Promise<EmailRecapSettings> {
  const envDailyRecipients = process.env.DAILY_RECAP_EMAIL_RECIPIENTS
    ? process.env.DAILY_RECAP_EMAIL_RECIPIENTS.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  try {
    const supabase = customClient || (await createClient());
    const { data, error } = await supabase
      .from('email_recap_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    // Ambil backup pengaturan harian magang dari ticketing_settings (selalu ada & persisten)
    let dailyBackup: {
      dailyRecipients?: string[];
      dailyIsActive?: boolean;
      dailySendTime?: string;
      dailyLastSentAt?: string | null;
      dailyLastStatus?: string | null;
      dailyAutoLastSentDate?: string | null;
      dailyLastAttemptAt?: string | null;
    } | null = null;

    try {
      const { data: backupData } = await supabase
        .from('ticketing_settings')
        .select('value')
        .eq('key', 'daily_recap_email_settings')
        .maybeSingle();

      if (backupData?.value && typeof backupData.value === 'object' && !Array.isArray(backupData.value)) {
        const val = backupData.value as Record<string, unknown>;
        dailyBackup = {
          dailyRecipients: Array.isArray(val.dailyRecipients) ? (val.dailyRecipients as string[]) : undefined,
          dailyIsActive: typeof val.dailyIsActive === 'boolean' ? val.dailyIsActive : undefined,
          dailySendTime: typeof val.dailySendTime === 'string' ? val.dailySendTime : undefined,
          dailyLastSentAt: typeof val.dailyLastSentAt === 'string' ? val.dailyLastSentAt : null,
          dailyLastStatus: typeof val.dailyLastStatus === 'string' ? val.dailyLastStatus : null,
          dailyAutoLastSentDate:
            typeof val.dailyAutoLastSentDate === 'string' ? val.dailyAutoLastSentDate : null,
          dailyLastAttemptAt:
            typeof val.dailyLastAttemptAt === 'string' ? val.dailyLastAttemptAt : null,
        };
      }
    } catch {
      // Abaikan jika tabel ticketing_settings belum siap
    }

    if (error || !data) {
      const fallbackRecipients =
        Array.isArray(dailyBackup?.dailyRecipients) && dailyBackup.dailyRecipients.length > 0
          ? dailyBackup.dailyRecipients
          : envDailyRecipients.length > 0
          ? envDailyRecipients
          : DEFAULT_FALLBACK_RECIPIENTS;

      return {
        ...DEFAULT_SETTINGS,
        brevoApiKey: DEFAULT_FALLBACK_BREVO_KEY,
        senderEmail: DEFAULT_FALLBACK_SENDER_EMAIL,
        dailyRecipients: fallbackRecipients,
        dailyIsActive: dailyBackup?.dailyIsActive ?? true,
        dailySendTime: dailyBackup?.dailySendTime || '18:00',
        dailyLastSentAt: dailyBackup?.dailyLastSentAt || null,
        dailyLastStatus: dailyBackup?.dailyLastStatus || null,
        dailyAutoLastSentDate: dailyBackup?.dailyAutoLastSentDate || null,
        dailyLastAttemptAt: dailyBackup?.dailyLastAttemptAt || null,
      };
    }

    // Prioritaskan sumber data paling lengkap / terbaru antara tabel dan ticketing_settings
    const dailyRecipients =
      Array.isArray(data.daily_recipients) && data.daily_recipients.length > 0
        ? data.daily_recipients
        : Array.isArray(dailyBackup?.dailyRecipients) && dailyBackup.dailyRecipients.length > 0
        ? dailyBackup.dailyRecipients
        : envDailyRecipients.length > 0
        ? envDailyRecipients
        : Array.isArray(data.recipients) && data.recipients.length > 0
        ? data.recipients
        : DEFAULT_FALLBACK_RECIPIENTS;

    const dailyIsActive =
      data.daily_is_active !== undefined
        ? data.daily_is_active
        : dailyBackup?.dailyIsActive ?? true;

    const dailySendTime = data.daily_send_time || dailyBackup?.dailySendTime || '18:00';
    const dailyLastSentAt = data.daily_last_sent_at || dailyBackup?.dailyLastSentAt || null;
    const dailyLastStatus = data.daily_last_status || dailyBackup?.dailyLastStatus || null;
    const dailyAutoLastSentDate =
      data.daily_auto_last_sent_date || dailyBackup?.dailyAutoLastSentDate || null;
    const dailyLastAttemptAt =
      data.daily_last_attempt_at || dailyBackup?.dailyLastAttemptAt || null;

    return {
      id: data.id,
      recipients: Array.isArray(data.recipients) && data.recipients.length > 0 ? data.recipients : DEFAULT_FALLBACK_RECIPIENTS,
      frequency: data.frequency || 'mingguan',
      isActive: data.is_active ?? true,
      senderName: data.sender_name || 'SANS AGEN',
      senderEmail: data.sender_email || DEFAULT_FALLBACK_SENDER_EMAIL,
      brevoApiKey: data.brevo_api_key || DEFAULT_FALLBACK_BREVO_KEY,
      sendDayWeekly: data.send_day_weekly ?? 1,
      sendTime: data.send_time || '08:00',
      lastSentAt: data.last_sent_at,
      lastStatus: data.last_status,
      updatedAt: data.updated_at,

      // Rekapan harian anak magang
      dailyRecipients,
      dailyIsActive,
      dailySendTime,
      dailyLastSentAt,
      dailyLastStatus,
      dailyAutoLastSentDate,
      dailyLastAttemptAt,
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      brevoApiKey: DEFAULT_FALLBACK_BREVO_KEY,
      senderEmail: DEFAULT_FALLBACK_SENDER_EMAIL,
      dailyRecipients: DEFAULT_FALLBACK_RECIPIENTS,
    };
  }
}

export async function saveEmailRecapSettings(
  settings: Partial<EmailRecapSettings>
): Promise<{ success: boolean; error?: string }> {
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { success: false, error: 'Hanya Akun Master yang diizinkan mengubah pengaturan email rekapan.' };
  }

  const supabase = await createClient();

  try {
    const current = await getEmailRecapSettings();

    const updatedBase = {
      recipients: settings.recipients ?? current.recipients,
      frequency: settings.frequency ?? current.frequency,
      is_active: settings.isActive ?? current.isActive,
      sender_name: settings.senderName ?? current.senderName,
      sender_email: settings.senderEmail ?? current.senderEmail,
      brevo_api_key: settings.brevoApiKey !== undefined ? settings.brevoApiKey : current.brevoApiKey,
      send_day_weekly: settings.sendDayWeekly ?? current.sendDayWeekly,
      send_time: settings.sendTime ?? current.sendTime,
      updated_at: new Date().toISOString(),
    };

    const finalDailyRecipients =
      settings.dailyRecipients !== undefined ? settings.dailyRecipients : current.dailyRecipients;
    const finalDailyIsActive =
      settings.dailyIsActive !== undefined ? settings.dailyIsActive : current.dailyIsActive;
    const finalDailySendTime = settings.dailySendTime ?? current.dailySendTime;

    // 1. Simpan selalu ke ticketing_settings agar persisten dan tidak pernah hilang saat refresh
    let backupErrorMsg: string | null = null;
    try {
      const { error: backupErr } = await supabase
        .from('ticketing_settings')
        .upsert({
          key: 'daily_recap_email_settings',
          value: {
            dailyRecipients: finalDailyRecipients,
            dailyIsActive: finalDailyIsActive,
            dailySendTime: finalDailySendTime,
            dailyLastSentAt: current.dailyLastSentAt || null,
            dailyLastStatus: current.dailyLastStatus || null,
            dailyAutoLastSentDate: current.dailyAutoLastSentDate || null,
            dailyLastAttemptAt: current.dailyLastAttemptAt || null,
          },
          updated_at: new Date().toISOString(),
        });
      if (backupErr) {
        backupErrorMsg = backupErr.message;
        console.warn('Backup daily settings error:', backupErr.message);
      }
    } catch (e) {
      backupErrorMsg = e instanceof Error ? e.message : 'Gagal menyimpan pengaturan harian';
      console.warn('Backup daily settings error:', e);
    }

    // 2. Simpan ke email_recap_settings
    const updatedWithDaily = {
      ...updatedBase,
      daily_recipients: finalDailyRecipients,
      daily_is_active: finalDailyIsActive,
      daily_send_time: finalDailySendTime,
    };

    const { error: fullErr } = await supabase
      .from('email_recap_settings')
      .upsert({
        id: current.id || DEFAULT_SETTINGS.id,
        ...updatedWithDaily,
      });

    if (!fullErr && !backupErrorMsg) {
      return { success: true };
    }

    // Jika kolom daily belum ada di email_recap_settings, simpan base ke email_recap_settings
    // (dailyRecipients sudah aman tersimpan di ticketing_settings!)
    const { error: fallbackErr } = await supabase
      .from('email_recap_settings')
      .upsert({
        id: current.id || DEFAULT_SETTINGS.id,
        ...updatedBase,
      });

    if (fallbackErr && backupErrorMsg) {
      return { success: false, error: `${fallbackErr.message} / ${backupErrorMsg}` };
    }
    if (fallbackErr) {
      return { success: false, error: fallbackErr.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan email.';
    return { success: false, error: msg };
  }
}

// Helper untuk menghitung rentang tanggal mingguan atau bulanan
export function getDateRangeForRecap(periodType: 'mingguan' | 'bulanan'): {
  startDate: string;
  endDate: string;
  title: string;
} {
  const now = new Date();
  // Gunakan waktu WITA (UTC+8)
  const nowUtc = now.getTime() + now.getTimezoneOffset() * 60000;
  const witaDate = new Date(nowUtc + 8 * 3600000);

  if (periodType === 'mingguan') {
    // Rekapan mingguan: Periode 1 minggu penuh dari hari SENIN s/d MINGGU
    const curDate = new Date(witaDate.getFullYear(), witaDate.getMonth(), witaDate.getDate());
    const dayOfWeek = curDate.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu

    let monDate: Date;
    let sunDate: Date;

    if (dayOfWeek === 1) {
      // Jika hari ini Senin: rekap 1 minggu kemarin penuh (Senin s/d Minggu kemarin)
      monDate = new Date(curDate);
      monDate.setDate(curDate.getDate() - 7);
      sunDate = new Date(curDate);
      sunDate.setDate(curDate.getDate() - 1);
    } else {
      // Jika hari lain: rekap minggu ini (Senin s/d Minggu berjalan)
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      monDate = new Date(curDate);
      monDate.setDate(curDate.getDate() + diffToMon);
      sunDate = new Date(monDate);
      sunDate.setDate(monDate.getDate() + 6);
    }

    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const startStr = fmt(monDate);
    const endStr = fmt(sunDate);

    return {
      startDate: startStr,
      endDate: endStr,
      title: `Rekapan Mingguan (${startStr} s/d ${endStr})`,
    };
  } else {
    // 1 bulan kalender saat ini (atau bulan kemarin jika tanggal 1)
    const y = witaDate.getFullYear();
    const m = witaDate.getMonth();
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m + 1, 0));

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const startStr = fmt(start);
    const endStr = fmt(end);

    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    return {
      startDate: startStr,
      endDate: endStr,
      title: `Rekapan Bulanan ${monthNames[m]} ${y}`,
    };
  }
}

// Fungsi pengirim rekapan email via Brevo REST API
export async function sendRecapEmailNow(
  periodType: 'mingguan' | 'bulanan',
  overrideRecipients?: string[],
  customSupabaseClient?: SupabaseClient | null
): Promise<{ success: boolean; message?: string; error?: string }> {
  const supabase = customSupabaseClient || (await createClient());
  const settings = await getEmailRecapSettings(supabase);

  const recipients = overrideRecipients && overrideRecipients.length > 0
    ? overrideRecipients
    : Array.isArray(settings.recipients) && settings.recipients.length > 0
    ? settings.recipients
    : DEFAULT_FALLBACK_RECIPIENTS;

  if (!recipients || recipients.length === 0) {
    return {
      success: false,
      error: 'Belum ada email penerima yang disetel. Silakan tambahkan minimal 1 alamat email tujuan.',
    };
  }

  const apiKey = (settings.brevoApiKey || DEFAULT_FALLBACK_BREVO_KEY).trim();
  if (!apiKey) {
    return {
      success: false,
      error: 'Brevo API Key belum diisi. Masukkan API Key Brevo di form pengaturan ini atau di env BREVO_API_KEY.',
    };
  }

  if (apiKey.startsWith('xsmtpsib-')) {
    return {
      success: false,
      error: 'Kunci yang Anda masukkan adalah Brevo SMTP Key (berawalan xsmtpsib-), bukan API Key. Silakan buka Brevo -> SMTP & API -> klik tab "API Keys" di sebelah kanan tab SMTP -> klik "Generate a new API key" (kuncinya yang benar berawalan xkeysib-...).',
    };
  }

  const senderEmail = (settings.senderEmail || DEFAULT_FALLBACK_SENDER_EMAIL).trim();
  if (!senderEmail) {
    return {
      success: false,
      error: 'Email pengirim (Sender Email) belum diisi. Masukkan alamat email pengirim yang terdaftar di akun Brevo Anda.',
    };
  }

  const { startDate, endDate, title } = getDateRangeForRecap(periodType);

  // 1. Fetch data absensi dalam rentang tanggal
  const { data: attData } = await supabase
    .from('attendances')
    .select('*')
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .order('work_date', { ascending: true });

  const attendances = (attData ?? []) as Attendance[];
  const attendanceIds = attendances.map((a) => a.id);

  // 2. Fetch attachments
  let attachments: Attachment[] = [];
  if (attendanceIds.length > 0) {
    const { data: attachData } = await supabase
      .from('attachments')
      .select('*')
      .in('attendance_id', attendanceIds);
    if (attachData) attachments = attachData as Attachment[];
  }

  // 3. Fetch profiles & holidays (hanya petugas piket yang masuk rekapitulasi piket)
  const [{ data: profData }, { data: holData }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, roles'),
    supabase.from('holidays').select('*'),
  ]);

  const rawProfiles = (profData ?? []) as { id: string; full_name?: string | null; email?: string | null; roles?: string[] }[];
  const profiles = rawProfiles.filter(
    (p) => p.roles && Array.isArray(p.roles) && p.roles.includes('piket')
  );
  const holidays = (holData ?? []) as Holiday[];

  // 4. Generate PDF buffer
  const pdfBuffer = generateServerRecapPdf({
    periodTitle: title,
    periodType,
    startDate,
    endDate,
    attendances,
    attachments,
    profiles,
    holidays,
  });

  const pdfBase64 = pdfBuffer.toString('base64');
  const fileName = `Rekap_Piket_${periodType === 'mingguan' ? 'Mingguan' : 'Bulanan'}_${startDate}_sd_${endDate}.pdf`;

  // 5. Susun konten email HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background: #003B70; color: #ffffff; padding: 28px 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px; }
          .header p { margin: 6px 0 0; font-size: 13px; color: #bae6fd; }
          .body { padding: 28px 24px; }
          .stats-grid { display: flex; gap: 12px; margin: 20px 0; }
          .stat-card { flex: 1; background: #f1f5f9; padding: 14px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; }
          .stat-val { font-size: 20px; font-weight: bold; color: #003B70; }
          .stat-lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
          .info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px; margin-top: 20px; font-size: 13px; color: #1e40af; }
          .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>LAPORAN REKAPITULASI PIKET</h1>
            <p>PT Indonesia Comnets Plus (PLN Icon Plus) • SBU Regional Bali & Nusra</p>
          </div>
          <div class="body">
            <p>Halo,</p>
            <p>Berikut terlampir laporan rekapan piket dan absensi petugas untuk <strong>${title}</strong>.</p>
            
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-val">${attendances.length}</div>
                <div class="stat-lbl">Total Shift</div>
              </div>
              <div class="stat-card">
                <div class="stat-val">${attachments.length}</div>
                <div class="stat-lbl">Foto Bukti</div>
              </div>
              <div class="stat-card">
                <div class="stat-val">${profiles.length}</div>
                <div class="stat-lbl">Petugas</div>
              </div>
            </div>

            <div class="info-box">
              📎 <strong>Dokumen Terlampir:</strong> File PDF resmi laporan rekapan telah dilampirkan pada email ini (${fileName}). Silakan unduh untuk melihat rincian kehadiran dan log shift per petugas.
            </div>
          </div>
          <div class="footer">
            Email ini dikirim secara otomatis oleh Sistem Magang ICONNET.<br/>
            Waktu Pengiriman: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })} WITA
          </div>
        </div>
      </body>
    </html>
  `;

  // 6. Kirim via Brevo REST API v3
  const brevoPayload = {
    sender: {
      name: settings.senderName || 'Magang ICONNET',
      email: senderEmail,
    },
    to: recipients.map((email) => ({ email: email.trim() })),
    subject: `[Laporan Piket] ${title} - ICONNET`,
    htmlContent,
    attachment: [
      {
        content: pdfBase64,
        name: fileName,
      },
    ],
  };

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(brevoPayload),
    });

    const resData = await res.json().catch(() => null);

    if (!res.ok) {
      let errMsg = resData?.message || resData?.error || `HTTP ${res.status}`;
      if (errMsg.toLowerCase().includes('unrecognised ip') || errMsg.toLowerCase().includes('authorised_ips')) {
        errMsg = `Brevo memblokir IP server (${errMsg}). Silakan buka https://app.brevo.com/security/authorised_ips lalu nonaktifkan batasan IP atau masukkan IP tersebut ke daftar Authorized IPs.`;
      }
      // Update status gagal
      await supabase
        .from('email_recap_settings')
        .update({
          last_sent_at: new Date().toISOString(),
          last_status: `Gagal: ${errMsg}`,
        })
        .eq('id', settings.id);

      return { success: false, error: errMsg };
    }

    // Update status sukses
    const successMsg = `Berhasil dikirim ke ${recipients.length} email (${recipients.join(', ')})`;
    await supabase
      .from('email_recap_settings')
      .update({
        last_sent_at: new Date().toISOString(),
        last_status: successMsg,
      })
      .eq('id', settings.id);

    return {
      success: true,
      message: successMsg,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Koneksi ke Brevo API gagal.';
    return { success: false, error: msg };
  }
}

/**
 * Mengirimkan email rekapan absensi harian anak magang via Brevo
 */
export async function sendDailyRecapEmailNow(
  targetDate?: string,
  overrideRecipients?: string[],
  forceSendOnHoliday = false,
  skipAuthCheck = false,
  customSupabaseClient?: SupabaseClient | null,
  options?: { isTest?: boolean; isScheduledAuto?: boolean }
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  isHolidaySkipped?: boolean;
  alreadySent?: boolean;
}> {
  if (!skipAuthCheck) {
    const { isMaster } = await getCurrentUserProfile();
    if (!isMaster) {
      return { success: false, error: 'Hanya Akun Master yang diizinkan mengirim rekapan email.' };
    }
  }

  const isTest = Boolean(options?.isTest);
  const isScheduledAuto = Boolean(options?.isScheduledAuto);
  const workDate = targetDate || todayWITA();
  const supabase = customSupabaseClient || (await createClient());

  // Cek apakah workDate adalah hari libur (dari tabel setting holidays atau akhir pekan)
  const { data: holidayData } = await supabase
    .from('holidays')
    .select('id, name')
    .eq('holiday_date', workDate)
    .maybeSingle();

  const [y, m, d] = workDate.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Minggu, 6 = Sabtu
  const isWeekend = dow === 0 || dow === 6;
  const isHoliday = Boolean(holidayData) || isWeekend;

  if (isHoliday && !forceSendOnHoliday) {
    const holidayName = holidayData?.name
      ? `Tanggal Merah (${holidayData.name})`
      : isWeekend
      ? 'Akhir Pekan (Sabtu/Minggu)'
      : 'Hari Libur';
    return {
      success: false,
      isHolidaySkipped: true,
      error: `Tanggal ${formatIndonesia(workDate)} adalah ${holidayName}. Rekapan absen harian tidak dikirim pada hari libur.`,
    };
  }

  const settings = await getEmailRecapSettings(supabase);

  // Deduplikasi & anti-race-condition lock khusus pengiriman terjadwal otomatis
  if (isScheduledAuto && !isTest) {
    if (settings.dailyAutoLastSentDate === workDate) {
      return {
        success: true,
        alreadySent: true,
        message: `Rekapan absen harian tanggal ${workDate} sudah pernah terkirim otomatis hari ini.`,
      };
    }

    if (settings.dailyLastAttemptAt) {
      const elapsedMs = Date.now() - new Date(settings.dailyLastAttemptAt).getTime();
      if (!Number.isNaN(elapsedMs) && elapsedMs >= 0 && elapsedMs < 90000) {
        return {
          success: true,
          alreadySent: true,
          message: 'Pengiriman rekapan harian sedang diproses oleh proses terjadwal lain.',
        };
      }
    }

    // Ambil kunci sementara 90 detik sebelum memanggil Brevo
    try {
      const { data: bData } = await supabase
        .from('ticketing_settings')
        .select('value')
        .eq('key', 'daily_recap_email_settings')
        .maybeSingle();

      const curVal = (bData?.value && typeof bData.value === 'object' ? bData.value : {}) as Record<string, unknown>;
      await supabase.from('ticketing_settings').upsert({
        key: 'daily_recap_email_settings',
        value: {
          ...curVal,
          dailyLastAttemptAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Abaikan jika gagal update lock sementara
    }
  }

  // Prioritaskan daftar email magang khusus, fallback ke settings.recipients, lalu DEFAULT_FALLBACK_RECIPIENTS
  const recipients =
    Array.isArray(overrideRecipients) && overrideRecipients.length > 0
      ? overrideRecipients
      : Array.isArray(settings.dailyRecipients) && settings.dailyRecipients.length > 0
      ? settings.dailyRecipients
      : Array.isArray(settings.recipients) && settings.recipients.length > 0
      ? settings.recipients
      : DEFAULT_FALLBACK_RECIPIENTS;

  if (recipients.length === 0) {
    return {
      success: false,
      error: 'Belum ada alamat email tujuan rekapan magang yang dikonfigurasi. Harap tambahkan minimal 1 email pada daftar Penerima Rekapan Magang.',
    };
  }

  const apiKey = (settings.brevoApiKey || DEFAULT_FALLBACK_BREVO_KEY).trim();
  if (!apiKey) {
    return {
      success: false,
      error: 'Brevo API Key belum diisi. Masukkan API Key Brevo yang valid di Pengaturan Rekapan.',
    };
  }

  const senderEmail = (settings.senderEmail || DEFAULT_FALLBACK_SENDER_EMAIL).trim();
  if (!senderEmail) {
    return {
      success: false,
      error: 'Email pengirim (Sender Email) belum diisi. Masukkan alamat email pengirim yang terdaftar di Brevo.',
    };
  }

  const recap = await getDailyAttendanceRecap(workDate, supabase);

  if (recap.error) {
    return { success: false, error: recap.error };
  }

  const dateFormatted = formatIndonesia(workDate);

  const hadirList = recap.records.filter((r) => r.isHadir);
  const tidakHadirList = recap.records.filter((r) => !r.isHadir);

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  // Baris tabel Hadir (Hanya: No, Nama, Status, Jam)
  const hadirRows =
    hadirList.length > 0
      ? hadirList
          .map(
            (r, idx) => `
        <tr style="background: #ffffff;">
          <td class="cell-pad" style="padding: 9px 6px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center; color: #64748b; white-space: nowrap; width: 1%; vertical-align: middle;">${idx + 1}</td>
          <td class="cell-pad" style="padding: 9px 6px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #0f172a; text-align: left; word-break: break-word; vertical-align: middle;">${escapeHtml(r.user.full_name || '-')}</td>
          <td class="cell-pad" style="padding: 9px 6px; border-bottom: 1px solid #e2e8f0; text-align: center; white-space: nowrap; width: 1%; vertical-align: middle;">
            <span class="badge-pill" style="display: inline-block; white-space: nowrap; background: #dcfce7; color: #166534; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; line-height: 1.2;">&#10003; Hadir</span>
          </td>
          <td class="cell-pad time-cell" style="padding: 9px 6px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #0f172a; font-weight: 700; text-align: center; white-space: nowrap; width: 1%; vertical-align: middle;">${escapeHtml(r.attendanceTime ? (r.attendanceTime.includes('WITA') ? r.attendanceTime : r.attendanceTime + ' WITA') : '-')}</td>
        </tr>
      `
          )
          .join('')
      : `<tr><td colspan="4" style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">Belum ada anak magang yang hadir pada tanggal ini.</td></tr>`;

  // Baris tabel Tidak Hadir (No, Nama, Status - tanpa nomor WhatsApp)
  const tidakHadirRows =
    tidakHadirList.length > 0
      ? tidakHadirList
          .map(
            (r, idx) => `
        <tr style="background: #fff5f5;">
          <td class="cell-pad" style="padding: 9px 6px; border-bottom: 1px solid #fee2e2; font-size: 12px; text-align: center; color: #991b1b; white-space: nowrap; width: 1%; vertical-align: middle;">${idx + 1}</td>
          <td class="cell-pad" style="padding: 9px 6px; border-bottom: 1px solid #fee2e2; font-size: 13px; font-weight: 700; color: #991b1b; text-align: left; word-break: break-word; vertical-align: middle;">${escapeHtml(r.user.full_name || '-')}</td>
          <td class="cell-pad" style="padding: 9px 6px; border-bottom: 1px solid #fee2e2; text-align: center; white-space: nowrap; width: 1%; vertical-align: middle;">
            <span class="badge-pill" style="display: inline-block; white-space: nowrap; background: #fee2e2; color: #dc2626; padding: 3px 9px; border-radius: 9999px; font-size: 11px; font-weight: 700; line-height: 1.2;">&#10005; Tidak Hadir</span>
          </td>
        </tr>
      `
          )
          .join('')
      : `<tr><td colspan="3" style="padding: 16px; text-align: center; color: #16a34a; font-size: 13px; font-weight: bold;">🎉 Luar biasa! Seluruh anak magang hadir lengkap hari ini (100%).</td></tr>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 0; background-color: #f8fafc; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
          table { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
          .email-wrapper { width: 100%; background-color: #f8fafc; padding: 16px 8px; box-sizing: border-box; }
          .container { width: 100%; max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background: #003B70; color: #ffffff; padding: 22px 16px; text-align: center; }
          .header h1 { margin: 0; font-size: 17px; font-weight: bold; letter-spacing: 0.4px; line-height: 1.3; }
          .header p { margin: 5px 0 0; font-size: 12px; color: #bae6fd; line-height: 1.4; }
          .body { padding: 20px 16px; }
          .section-title { font-size: 14px; font-weight: bold; margin: 20px 0 8px; color: #0f172a; }
          .data-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #e2e8f0; }
          .data-table th { background: #f1f5f9; padding: 8px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #475569; border-bottom: 1px solid #e2e8f0; }
          .footer { background: #f8fafc; padding: 14px 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
          @media only screen and (max-width: 600px) {
            .email-wrapper { padding: 8px 4px !important; }
            .container { border-radius: 10px !important; }
            .header { padding: 18px 12px !important; }
            .header h1 { font-size: 15px !important; }
            .body { padding: 14px 10px !important; }
            .stat-cell { padding: 10px 4px !important; }
            .stat-val { font-size: 18px !important; }
            .stat-lbl { font-size: 10px !important; }
            .data-table th { padding: 7px 5px !important; font-size: 10px !important; }
            .cell-pad { padding: 8px 5px !important; font-size: 12px !important; }
            .badge-pill { padding: 3px 7px !important; font-size: 10.5px !important; }
            .time-cell { font-size: 11.5px !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc;">
        <div class="email-wrapper" style="width: 100%; background-color: #f8fafc; padding: 16px 8px; box-sizing: border-box;">
          <div class="container" style="width: 100%; max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0;">
            <div class="header" style="background: #003B70; color: #ffffff; padding: 22px 16px; text-align: center;">
              <h1 style="margin: 0; font-size: 17px; font-weight: bold; letter-spacing: 0.4px; line-height: 1.3; color: #ffffff;">LAPORAN REKAPITULASI ABSENSI HARIAN</h1>
              <p style="margin: 5px 0 0; font-size: 12px; color: #bae6fd; line-height: 1.4;">PT Indonesia Comnets Plus (PLN Icon Plus) • SBU Regional Bali &amp; Nusra</p>
            </div>
            <div class="body" style="padding: 20px 16px;">
              <p style="margin: 0 0 4px; font-size: 14px; color: #0f172a;"><strong>Laporan Kehadiran:</strong> ${escapeHtml(dateFormatted)}</p>
              <p style="margin: 0; font-size: 12px; color: #64748b;">Khusus pemantauan absensi pagi anak magang ICONNET.</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 16px 0 6px; border: none; border-collapse: collapse;">
                <tr>
                  <td class="stat-cell" width="32%" style="width: 32%; background: #eff6ff; padding: 10px 6px; border-radius: 10px; text-align: center; border: 1px solid #dbeafe; vertical-align: middle;">
                    <div class="stat-val" style="font-size: 20px; font-weight: bold; color: #1d4ed8; line-height: 1.2;">${recap.totalInterns}</div>
                    <div class="stat-lbl" style="font-size: 11px; color: #1e40af; margin-top: 2px; line-height: 1.2;">Total Anak Magang</div>
                  </td>
                  <td width="2%" style="width: 2%; font-size: 0; line-height: 0;">&nbsp;</td>
                  <td class="stat-cell" width="32%" style="width: 32%; background: #f0fdf4; padding: 10px 6px; border-radius: 10px; text-align: center; border: 1px solid #bbf7d0; vertical-align: middle;">
                    <div class="stat-val" style="font-size: 20px; font-weight: bold; color: #15803d; line-height: 1.2;">${recap.totalHadir}</div>
                    <div class="stat-lbl" style="font-size: 11px; color: #166534; margin-top: 2px; line-height: 1.2;">Hadir (${recap.persentaseHadir}%)</div>
                  </td>
                  <td width="2%" style="width: 2%; font-size: 0; line-height: 0;">&nbsp;</td>
                  <td class="stat-cell" width="32%" style="width: 32%; background: #fff1f2; padding: 10px 6px; border-radius: 10px; text-align: center; border: 1px solid #fecdd3; vertical-align: middle;">
                    <div class="stat-val" style="font-size: 20px; font-weight: bold; color: #be123c; line-height: 1.2;">${recap.totalTidakHadir}</div>
                    <div class="stat-lbl" style="font-size: 11px; color: #9f1239; margin-top: 2px; line-height: 1.2;">Tidak Hadir</div>
                  </td>
                </tr>
              </table>

              <div class="section-title" style="font-size: 14px; font-weight: bold; margin: 20px 0 8px; color: #0f172a;">
                <span>1. Daftar Anak Magang Hadir (${recap.totalHadir})</span>
              </div>
              <table class="data-table" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #e2e8f0;">
                <thead>
                  <tr>
                    <th style="background: #f1f5f9; padding: 8px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #475569; border-bottom: 1px solid #e2e8f0; width: 1%; white-space: nowrap; text-align: center;">No</th>
                    <th style="background: #f1f5f9; padding: 8px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #475569; border-bottom: 1px solid #e2e8f0; text-align: left;">Nama Anak Magang</th>
                    <th style="background: #f1f5f9; padding: 8px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #475569; border-bottom: 1px solid #e2e8f0; width: 1%; white-space: nowrap; text-align: center;">Status</th>
                    <th style="background: #f1f5f9; padding: 8px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #475569; border-bottom: 1px solid #e2e8f0; width: 1%; white-space: nowrap; text-align: center;">Jam</th>
                  </tr>
                </thead>
                <tbody>
                  ${hadirRows}
                </tbody>
              </table>

              <div class="section-title" style="font-size: 14px; font-weight: bold; margin: 20px 0 8px; color: #be123c;">
                <span>2. Daftar Anak Magang Tidak Hadir / Belum Absen (${recap.totalTidakHadir})</span>
              </div>
              <table class="data-table" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #e2e8f0;">
                <thead>
                  <tr>
                    <th style="background: #f1f5f9; padding: 8px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #475569; border-bottom: 1px solid #e2e8f0; width: 1%; white-space: nowrap; text-align: center;">No</th>
                    <th style="background: #f1f5f9; padding: 8px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #475569; border-bottom: 1px solid #e2e8f0; text-align: left;">Nama Anak Magang</th>
                    <th style="background: #f1f5f9; padding: 8px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #475569; border-bottom: 1px solid #e2e8f0; width: 1%; white-space: nowrap; text-align: center;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${tidakHadirRows}
                </tbody>
              </table>
            </div>
            <div class="footer" style="background: #f8fafc; padding: 14px 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              Email ini dikirim secara otomatis oleh Sistem Magang ICONNET.<br/>
              Waktu Pengiriman: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })} WITA
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const brevoPayload = {
    sender: {
      name: settings.senderName || 'Magang ICONNET',
      email: senderEmail,
    },
    to: recipients.map((email) => ({ email: email.trim() })),
    subject: `[Rekap Absensi Harian] ${dateFormatted} - ICONNET`,
    htmlContent,
  };

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(brevoPayload),
    });

    const resData = await res.json().catch(() => null);

    if (!res.ok) {
      let errMsg = resData?.message || resData?.error || `HTTP ${res.status}`;
      if (errMsg.toLowerCase().includes('unrecognised ip') || errMsg.toLowerCase().includes('authorised_ips')) {
        errMsg = `Brevo memblokir IP server (${errMsg}). Silakan buka https://app.brevo.com/security/authorised_ips lalu nonaktifkan batasan IP atau tambahkan IP tersebut ke daftar Authorized IPs.`;
      }
      return { success: false, error: errMsg };
    }

    const successMsg = `Rekap harian berhasil dikirim ke ${recipients.length} email (${recipients.join(', ')})`;
    const sentAtIso = new Date().toISOString();
    // Hanya catat dailyAutoLastSentDate jika ini pengiriman nyata/terjadwal (bukan tombol Uji Coba/Tes)
    const nextAutoSentDate = isTest ? (settings.dailyAutoLastSentDate || null) : workDate;

    // Update status ke database dan ticketing_settings backup
    try {
      await supabase
        .from('email_recap_settings')
        .update({
          daily_last_sent_at: sentAtIso,
          daily_last_status: successMsg,
          daily_auto_last_sent_date: nextAutoSentDate,
        })
        .eq('id', settings.id);
    } catch {
      // Abaikan jika kolom daily_* belum dimigrasi di email_recap_settings
    }

    try {
      const { data: bData } = await supabase
        .from('ticketing_settings')
        .select('value')
        .eq('key', 'daily_recap_email_settings')
        .maybeSingle();

      const curVal = (bData?.value && typeof bData.value === 'object' ? bData.value : {}) as Record<string, unknown>;
      await supabase
        .from('ticketing_settings')
        .upsert({
          key: 'daily_recap_email_settings',
          value: {
            ...curVal,
            dailyLastSentAt: sentAtIso,
            dailyLastStatus: successMsg,
            dailyAutoLastSentDate: nextAutoSentDate,
            dailyLastAttemptAt: sentAtIso,
          },
          updated_at: sentAtIso,
        });
    } catch {
      // Abaikan jika gagal update ticketing_settings
    }

    return {
      success: true,
      message: successMsg,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Koneksi ke Brevo API gagal.';
    return { success: false, error: msg };
  }
}


