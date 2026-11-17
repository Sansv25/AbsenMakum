import { createClient } from '@/lib/supabase/server';
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
}

const DEFAULT_SETTINGS: EmailRecapSettings = {
  id: '00000000-0000-0000-0000-000000000001',
  recipients: [],
  frequency: 'mingguan',
  isActive: true,
  senderName: 'Absensi Piket ICONNET',
  senderEmail: '',
  brevoApiKey: '',
  sendDayWeekly: 1,
  sendTime: '08:00',
  lastSentAt: null,
  lastStatus: null,
  dailyRecipients: [],
  dailyIsActive: true,
  dailySendTime: '18:00',
  dailyLastSentAt: null,
  dailyLastStatus: null,
};

export async function getEmailRecapSettings(): Promise<EmailRecapSettings> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('email_recap_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return {
        ...DEFAULT_SETTINGS,
        brevoApiKey: process.env.BREVO_API_KEY || '',
        senderEmail: process.env.BREVO_SENDER_EMAIL || '',
      };
    }

    return {
      id: data.id,
      recipients: Array.isArray(data.recipients) ? data.recipients : [],
      frequency: data.frequency || 'mingguan',
      isActive: data.is_active ?? true,
      senderName: data.sender_name || 'Absensi Piket ICONNET',
      senderEmail: data.sender_email || process.env.BREVO_SENDER_EMAIL || '',
      brevoApiKey: data.brevo_api_key || process.env.BREVO_API_KEY || '',
      sendDayWeekly: data.send_day_weekly ?? 1,
      sendTime: data.send_time || '08:00',
      lastSentAt: data.last_sent_at,
      lastStatus: data.last_status,
      updatedAt: data.updated_at,

      // Rekapan harian anak magang
      dailyRecipients: Array.isArray(data.daily_recipients)
        ? data.daily_recipients
        : [],
      dailyIsActive: data.daily_is_active ?? true,
      dailySendTime: data.daily_send_time || '18:00',
      dailyLastSentAt: data.daily_last_sent_at,
      dailyLastStatus: data.daily_last_status,
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      brevoApiKey: process.env.BREVO_API_KEY || '',
      senderEmail: process.env.BREVO_SENDER_EMAIL || '',
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

    const updatedWithDaily = {
      ...updatedBase,
      daily_recipients: settings.dailyRecipients ?? current.dailyRecipients,
      daily_is_active: settings.dailyIsActive ?? current.dailyIsActive,
      daily_send_time: settings.dailySendTime ?? current.dailySendTime,
    };

    // Coba simpan dengan kolom daily terlebih dahulu
    const { error: fullErr } = await supabase
      .from('email_recap_settings')
      .upsert({
        id: current.id || DEFAULT_SETTINGS.id,
        ...updatedWithDaily,
      });

    if (!fullErr) {
      return { success: true };
    }

    // Jika kolom daily belum dimigrasi di Postgres, fallback simpan base
    if (fullErr.message.includes('daily_')) {
      const { error: fallbackErr } = await supabase
        .from('email_recap_settings')
        .upsert({
          id: current.id || DEFAULT_SETTINGS.id,
          ...updatedBase,
        });

      if (fallbackErr) {
        return { success: false, error: fallbackErr.message };
      }
      return {
        success: true,
        error: 'Pengaturan dasar tersimpan. Jalankan migration_daily_email_recap.sql di Supabase untuk mengaktifkan kolom email harian.',
      };
    }

    return { success: false, error: fullErr.message };
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
    // 7 hari terakhir hingga hari ini
    const end = new Date(witaDate);
    const start = new Date(witaDate);
    start.setDate(end.getDate() - 6);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const startStr = fmt(start);
    const endStr = fmt(end);

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
  overrideRecipients?: string[]
): Promise<{ success: boolean; message?: string; error?: string }> {
  const settings = await getEmailRecapSettings();

  const recipients = overrideRecipients && overrideRecipients.length > 0
    ? overrideRecipients
    : settings.recipients;

  if (!recipients || recipients.length === 0) {
    return {
      success: false,
      error: 'Belum ada email penerima yang disetel. Silakan tambahkan minimal 1 alamat email tujuan.',
    };
  }

  const apiKey = (settings.brevoApiKey || process.env.BREVO_API_KEY || '').trim();
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

  const senderEmail = (settings.senderEmail || process.env.BREVO_SENDER_EMAIL || '').trim();
  if (!senderEmail) {
    return {
      success: false,
      error: 'Email pengirim (Sender Email) belum diisi. Masukkan alamat email pengirim yang terdaftar di akun Brevo Anda.',
    };
  }

  const supabase = await createClient();
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

  // 3. Fetch profiles & holidays
  const [{ data: profData }, { data: holData }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email'),
    supabase.from('holidays').select('*'),
  ]);

  const profiles = profData ?? [];
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
            Email ini dikirim secara otomatis oleh Sistem Absensi Piket ICONNET.<br/>
            Waktu Pengiriman: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })} WITA
          </div>
        </div>
      </body>
    </html>
  `;

  // 6. Kirim via Brevo REST API v3
  const brevoPayload = {
    sender: {
      name: settings.senderName || 'Absensi Piket ICONNET',
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
      const errMsg = resData?.message || resData?.error || `HTTP ${res.status}`;
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
  targetDate?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { success: false, error: 'Hanya Akun Master yang diizinkan mengirim rekapan email.' };
  }

  const settings = await getEmailRecapSettings();
  const recipients =
    settings.dailyRecipients && settings.dailyRecipients.length > 0
      ? settings.dailyRecipients
      : settings.recipients;

  if (!recipients || recipients.length === 0) {
    return {
      success: false,
      error: 'Belum ada alamat email tujuan rekapan harian yang dikonfigurasi. Atur email tujuan di Pengaturan Rekapan.',
    };
  }

  const apiKey = (settings.brevoApiKey || process.env.BREVO_API_KEY || '').trim();
  if (!apiKey) {
    return {
      success: false,
      error: 'Brevo API Key belum diisi. Masukkan API Key Brevo yang valid di Pengaturan Rekapan.',
    };
  }

  const senderEmail = (settings.senderEmail || process.env.BREVO_SENDER_EMAIL || '').trim();
  if (!senderEmail) {
    return {
      success: false,
      error: 'Email pengirim (Sender Email) belum diisi. Masukkan alamat email pengirim yang terdaftar di Brevo.',
    };
  }

  const workDate = targetDate || todayWITA();
  const recap = await getDailyAttendanceRecap(workDate);

  if (recap.error) {
    return { success: false, error: recap.error };
  }

  const dateFormatted = formatIndonesia(workDate);

  const hadirList = recap.records.filter((r) => r.isHadir);
  const tidakHadirList = recap.records.filter((r) => !r.isHadir);

  // Baris tabel Hadir
  const hadirRows =
    hadirList.length > 0
      ? hadirList
          .map(
            (r, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
          <td style="padding: 10px 12px; font-size: 13px; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 10px 12px; font-size: 13px; font-weight: bold; color: #0f172a;">${r.user.full_name}</td>
          <td style="padding: 10px 12px; font-size: 12px; color: #166534; font-weight: bold;">
            <span style="background: #dcfce7; padding: 3px 8px; border-radius: 9999px;">✓ Hadir</span>
          </td>
          <td style="padding: 10px 12px; font-size: 12px; color: #0f172a; font-weight: 600;">${r.attendanceTime || '-'}</td>
          <td style="padding: 10px 12px; font-size: 12px; color: #475569;">${r.methodLabel || '-'}</td>
          <td style="padding: 10px 12px; font-size: 12px; color: #64748b;">${r.message || '-'}</td>
        </tr>
      `
          )
          .join('')
      : `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">Belum ada anak magang yang hadir pada tanggal ini.</td></tr>`;

  // Baris tabel Tidak Hadir
  const tidakHadirRows =
    tidakHadirList.length > 0
      ? tidakHadirList
          .map(
            (r, idx) => `
        <tr style="border-bottom: 1px solid #fee2e2; background: #fff5f5;">
          <td style="padding: 10px 12px; font-size: 13px; text-align: center; color: #991b1b;">${idx + 1}</td>
          <td style="padding: 10px 12px; font-size: 13px; font-weight: bold; color: #991b1b;">${r.user.full_name}</td>
          <td style="padding: 10px 12px; font-size: 12px; color: #dc2626; font-weight: bold;">
            <span style="background: #fee2e2; padding: 3px 8px; border-radius: 9999px;">✕ Tidak Hadir</span>
          </td>
          <td style="padding: 10px 12px; font-size: 12px; color: #7f1d1d;">${r.user.email}</td>
          <td style="padding: 10px 12px; font-size: 12px; color: #7f1d1d;">${r.user.phone || '-'}</td>
        </tr>
      `
          )
          .join('')
      : `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #16a34a; font-size: 13px; font-weight: bold;">🎉 Luar biasa! Seluruh anak magang hadir lengkap hari ini (100%).</td></tr>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 680px; margin: 24px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background: #003B70; color: #ffffff; padding: 24px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 18px; font-weight: bold; letter-spacing: 0.5px; }
          .header p { margin: 4px 0 0; font-size: 12px; color: #bae6fd; }
          .body { padding: 24px 20px; }
          .stats-grid { display: flex; gap: 10px; margin: 16px 0 24px; }
          .stat-card { flex: 1; background: #f8fafc; padding: 12px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; }
          .stat-val { font-size: 22px; font-weight: bold; }
          .stat-lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
          .section-title { font-size: 14px; font-weight: bold; margin: 20px 0 8px; color: #0f172a; display: flex; align-items: center; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
          th { background: #f1f5f9; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; text-align: left; }
          .footer { background: #f8fafc; padding: 16px 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>LAPORAN REKAPITULASI ABSENSI HARIAN</h1>
            <p>PT Indonesia Comnets Plus (PLN Icon Plus) • SBU Regional Bali & Nusra</p>
          </div>
          <div class="body">
            <p style="margin: 0 0 4px; font-size: 14px;"><strong>Laporan Kehadiran:</strong> ${dateFormatted}</p>
            <p style="margin: 0; font-size: 12px; color: #64748b;">Khusus pemantauan absensi pagi anak magang ICONNET.</p>

            <table style="margin-top: 16px; border: none;">
              <tr>
                <td style="background: #eff6ff; padding: 12px; border-radius: 10px; text-align: center; border: 1px solid #dbeafe;">
                  <div style="font-size: 20px; font-weight: bold; color: #1d4ed8;">${recap.totalInterns}</div>
                  <div style="font-size: 11px; color: #1e40af; margin-top: 2px;">Total Anak Magang</div>
                </td>
                <td style="width: 8px;"></td>
                <td style="background: #f0fdf4; padding: 12px; border-radius: 10px; text-align: center; border: 1px solid #bbf7d0;">
                  <div style="font-size: 20px; font-weight: bold; color: #15803d;">${recap.totalHadir}</div>
                  <div style="font-size: 11px; color: #166534; margin-top: 2px;">Hadir (${recap.persentaseHadir}%)</div>
                </td>
                <td style="width: 8px;"></td>
                <td style="background: #fff1f2; padding: 12px; border-radius: 10px; text-align: center; border: 1px solid #fecdd3;">
                  <div style="font-size: 20px; font-weight: bold; color: #be123c;">${recap.totalTidakHadir}</div>
                  <div style="font-size: 11px; color: #9f1239; margin-top: 2px;">Tidak Hadir</div>
                </td>
              </tr>
            </table>

            <div class="section-title">
              <span>1. Daftar Anak Magang Hadir (${recap.totalHadir})</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 30px; text-align: center;">No</th>
                  <th>Nama Petugas</th>
                  <th>Status</th>
                  <th>Waktu</th>
                  <th>Metode</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                ${hadirRows}
              </tbody>
            </table>

            <div class="section-title" style="color: #be123c;">
              <span>2. Daftar Anak Magang Tidak Hadir / Belum Absen (${recap.totalTidakHadir})</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 30px; text-align: center;">No</th>
                  <th>Nama Petugas</th>
                  <th>Status</th>
                  <th>Email</th>
                  <th>No. WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                ${tidakHadirRows}
              </tbody>
            </table>
          </div>
          <div class="footer">
            Email ini dikirim secara otomatis oleh Sistem Absensi ICONNET.<br/>
            Waktu Pengiriman: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })} WITA
          </div>
        </div>
      </body>
    </html>
  `;

  const brevoPayload = {
    sender: {
      name: settings.senderName || 'Absensi ICONNET',
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
      const errMsg = resData?.message || resData?.error || `HTTP ${res.status}`;
      return { success: false, error: errMsg };
    }

    const successMsg = `Rekap harian berhasil dikirim ke ${recipients.length} email (${recipients.join(', ')})`;

    // Update status ke database jika kolom sudah ada
    try {
      const supabase = await createClient();
      await supabase
        .from('email_recap_settings')
        .update({
          daily_last_sent_at: new Date().toISOString(),
          daily_last_status: successMsg,
        })
        .eq('id', settings.id);
    } catch {
      // Abaikan jika kolom database belum dimigrasi
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


