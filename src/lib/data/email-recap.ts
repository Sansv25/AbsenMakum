import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { generateServerRecapPdf } from '@/lib/server-pdf';
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

    const updated = {
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

    const { error } = await supabase
      .from('email_recap_settings')
      .upsert({
        id: current.id || DEFAULT_SETTINGS.id,
        ...updated,
      });

    if (error) {
      return { success: false, error: error.message };
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

