/**
 * ICONNET TICKET RUNNER BOT (LOCAL PUPPETEER + AI AUTO-RESPONDER)
 * Memantau antrean tiket Supabase, mengetikkan pesan pembuka ke DM Instagram @iconnet.here,
 * menjawab pertanyaan CS secara cerdas menggunakan AI Nemotron, dan mengekstrak nomor tiket resmi.
 */

import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auto-Deteksi Lokasi Google Chrome di Komputer Pengguna
function findChromeExecutable() {
  const commonPaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];
  for (const p of commonPaths) {
    if (p && fs.existsSync(p)) return p;
  }
  return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

const chromePath = findChromeExecutable();
const DIRECT_THREAD_URL = 'https://www.instagram.com/direct/t/17848314279030884/';

function getProfileDir() {
  // 1. Cek folder profil portabel di dalam folder bot ini (.chrome_profile)
  const portableProfile = path.resolve(__dirname, '.chrome_profile');
  if (fs.existsSync(portableProfile)) {
    return portableProfile;
  }
  // 2. Cek path eksternal lama jika ada
  const externalProfile = 'D:\\otomasi\\Auto tiket\\.chrome_instagram_profile';
  if (fs.existsSync(externalProfile)) {
    return externalProfile;
  }
  // 3. Cek folder profil di level parent
  const localProfile = path.resolve(__dirname, '..', '.chrome_instagram_profile');
  if (fs.existsSync(localProfile)) {
    return localProfile;
  }
  // Default: gunakan folder portabel
  return portableProfile;
}

// Baca Env Supabase & AI Key
function loadEnv() {
  const envPaths = [
    path.resolve(__dirname, '.env'),
    path.resolve(__dirname, '..', 'app', '.env.local'),
    path.resolve(__dirname, '..', '.env.local'),
  ];

  let supabaseUrl = 'https://osaliefiqfydqibwfafl.supabase.co';
  let supabaseAnonKey = '';
  let serviceRoleKey = '';
  let nvidiaApiKey = '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';

  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
          supabaseUrl = trimmed.split('=')[1].trim();
        }
        if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
          supabaseAnonKey = trimmed.split('=')[1].trim();
        }
        if (trimmed.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
          serviceRoleKey = trimmed.split('=')[1].trim();
        }
        if (trimmed.startsWith('NVIDIA_NIM_API_KEY=')) {
          nvidiaApiKey = trimmed.split('=')[1].trim();
        }
      }
    }
  }

  return { supabaseUrl, supabaseAnonKey, serviceRoleKey, nvidiaApiKey };
}

const { supabaseUrl, supabaseAnonKey, serviceRoleKey, nvidiaApiKey } = loadEnv();
const activeKey = serviceRoleKey || supabaseAnonKey;

const supabase = createClient(supabaseUrl, activeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Otomatis perbarui file sesi jika token Supabase diperbarui
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    try {
      const sessionFile = path.resolve(__dirname, '.session.json');
      fs.writeFileSync(
        sessionFile,
        JSON.stringify(
          {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            user: session.user?.email || '',
          },
          null,
          2
        )
      );
    } catch {}
  }
});

// Utilitas Logging Bersih & Anti-Spam
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerIdx = 0;
let lastReportedChatSig = '';

function clearStatusLine() {
  const width = process.stdout.columns || 80;
  process.stdout.write('\r' + ' '.repeat(Math.max(0, width - 1)) + '\r');
}

const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => {
  clearStatusLine();
  originalLog(...args);
};
console.error = (...args) => {
  clearStatusLine();
  originalError(...args);
};

function logEvent(...args) {
  clearStatusLine();
  originalLog(...args);
}

function updateStatusLine(text) {
  const spinner = spinnerFrames[spinnerIdx++ % spinnerFrames.length];
  const time = new Date().toLocaleTimeString();
  const width = process.stdout.columns || 80;
  const raw = `[${time}] ${spinner} ${text}`;
  const truncated = raw.length >= width ? raw.slice(0, width - 4) + '...' : raw;
  const padding = ' '.repeat(Math.max(0, width - 1 - truncated.length));
  process.stdout.write(`\r${truncated}${padding}`);
}

// Cache pesan terakhir yang sudah dijawab agar tidak menjawab berulang-ulang
let lastAnsweredMessage = '';

// Format Pesan Pembuka Standar (Tanpa awalan dan akhiran kata)
function buildFirstMessage(ticket) {
  const parts = [];
  parts.push(`ID Pelanggan: ${ticket.customer_id || '-'}`);
  if (ticket.pln_id) parts.push(`ID PLN: ${ticket.pln_id}`);
  if (ticket.phone) parts.push(`No Telp/WA: ${ticket.phone}`);
  if (ticket.alt_phone) parts.push(`No Telp/CP Alternatif: ${ticket.alt_phone}`);
  parts.push(`Nama Pelanggan: ${ticket.name || '-'}`);
  if (ticket.address) parts.push(`Alamat: ${ticket.address}`);
  if (ticket.email) parts.push(`Email: ${ticket.email}`);
  if (ticket.regional) parts.push(`Regional: ${ticket.regional}`);
  if (ticket.office) parts.push(`Kantor Perwakilan: ${ticket.office}`);
  parts.push('');
  parts.push(`Keluhan: ${ticket.complaint || '-'}`);
  if (ticket.alt_phone) parts.push(`cp alt ${ticket.alt_phone}`);
  return parts.join('\n');
}

// Ekstraksi Nomor Tiket & Hasil Resolusi Otomatis
function extractTicketOutcome(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  // 1. Cek nomor tiket resmi alfanumerik (6 s/d 12 karakter, wajib ada angka)
  const ticketRegex = /(?:id\s*tiket|nomor\s*tiket|no\.?\s*tiket|tiket|nomor\s*pelaporan|no\.?\s*pelaporan)\s*[:#]?\s*([A-Z0-9]{6,12})\b/i;
  const match = text.match(ticketRegex);
  if (match && match[1] && /\d/.test(match[1])) {
    return { type: 'ticket', value: match[1].toUpperCase() };
  }

  // Standalone kode tiket (mis. A2000842, IN123456, R2J92BW3)
  const standaloneMatch = text.match(/\b([A-Z][A-Z0-9]{6,10})\b/);
  if (standaloneMatch && standaloneMatch[1] && /\d/.test(standaloneMatch[1])) {
    const val = standaloneMatch[1].toUpperCase();
    const blacklist = new Set(['ICONNET', 'WHATSAPP', 'INSTAGRAM', 'INTERNET', 'MODEMNYA', 'PELAPORAN']);
    if (!blacklist.has(val)) {
      return { type: 'ticket', value: val };
    }
  }

  // 2. Cek tagihan belum bayar / isolir (hindari mencocokkan kata biasa/password seperti 'bayardong')
  if (
    /\b(?:terisolir|isolir)\b/i.test(text) ||
    /(?:belum\s*(?:melakukan\s*)?pembayaran|tagihan\s*(?:belum\s*dibayar|tertunggak|menunggak))/i.test(text) ||
    /(?:ada\s*tagihan|menunggu\s*pembayaran)/i.test(text) ||
    /(?:melakukan\s*pembayaran|lakukan\s*pembayaran)/i.test(text)
  ) {
    return { type: 'billing', value: 'Belum Bayar / Tagihan Tertunggak' };
  }

  // 3. Cek perbaikan / restart dari sistem pusat
  if (
    lower.includes('perbaikan melalui sistem') ||
    lower.includes('perbaikan sistem') ||
    lower.includes('restart dari sistem') ||
    lower.includes('dibantu restart') ||
    lower.includes('restart sistem') ||
    lower.includes('refresh sistem') ||
    lower.includes('5-10 menit') ||
    lower.includes('5 hingga 10 menit') ||
    lower.includes('menunggu 5') ||
    lower.includes('10 menit setelah itu bisa mencoba')
  ) {
    return { type: 'restart', value: 'Perbaikan Sistem (Tunggu 5-10 Menit)' };
  }

  // 4. Cek gangguan massal / pemeliharaan area
  if (lower.includes('gangguan massal') || lower.includes('pemeliharaan jaringan') || lower.includes('maintenance')) {
    return { type: 'mass_outage', value: 'Gangguan Massal di Area' };
  }

  // 5. Cek chat diakhiri oleh CS
  if (lower.includes('chat akan kami akhiri') || lower.includes('percakapan kami akhiri') || lower.includes('sesi kami akhiri')) {
    return { type: 'closed_by_cs', value: 'Sesi Diakhiri oleh CS ICONNET' };
  }

  return null;
}

// Konteks Waktu WITA (UTC+8) untuk Salam Penutup Alami
function getWitaTimeContext() {
  const now = new Date();
  const witaHours = (now.getUTCHours() + 8) % 24;
  const minutes = now.getUTCMinutes().toString().padStart(2, '0');

  let period = 'Malam';
  if (witaHours >= 5 && witaHours < 11) {
    period = 'Pagi';
  } else if (witaHours >= 11 && witaHours < 15) {
    period = 'Siang';
  } else if (witaHours >= 15 && witaHours < 18) {
    period = 'Sore';
  }

  return {
    timeStr: `${witaHours.toString().padStart(2, '0')}:${minutes} WITA`,
    period,
    greeting: `Selamat ${period}`,
  };
}

// Otak AI: Menjawab Pertanyaan CS ICONNET Sesuai Data Tiket & Deteksi Penutupan Percakapan
async function generateAIReply(ticket, incomingMessage) {
  const isLoss = (ticket.complaint || '').toLowerCase().includes('loss') || (ticket.complaint || '').toLowerCase().includes('los');
  const statusIndikatorText = isLoss ? 'lampu indikator merah (LOS)' : 'tidak ada indikator merah';
  const timeContext = getWitaTimeContext();

  // Cek apakah tiket memiliki foto lampiran di Supabase
  let hasImages = false;
  try {
    const { data: ticketImages } = await supabase
      .from('ticket_images')
      .select('id')
      .eq('ticket_id', ticket.id);
    hasImages = Boolean(ticketImages && ticketImages.length > 0);
  } catch {}

  const contactInfo = ticket.alt_phone
    ? `nomor alternatif di ${ticket.alt_phone} dan nomor WhatsApp di ${ticket.phone || '-'}`
    : `nomor WhatsApp/telepon di ${ticket.phone || '-'}`;

  const photoInfo = hasImages
    ? 'foto lampu indikator modem dan nomor SN di bagian belakang sudah kami kirimkan di atas ya Kak'
    : 'untuk foto saat ini belum dapat kami lampirkan';

  const defaultSafeReply = `Baik Kak, ${photoInfo}. Untuk kendalanya ${statusIndikatorText}, dan untuk ${contactInfo}. Mohon bantuannya untuk dilakukan pengecekan Kak. Terima kasih.`;

  const prompt = `Kamu adalah PELAPOR / ADMIN PELANGGAN yang sedang berkomunikasi dengan CS ICONNET di Instagram Direct Message (DM).
PENTING:
- LAWAN BICARAMU: Petugas Customer Service ICONNET (sapa dengan "Kak" atau "Kak [Nama Agen CS]").
- IDENTITAS KITA: Pihak pelapor yang mewakili pelanggan "${ticket.name}".
- DILARANG KERAS menyapa "Kak ${ticket.name}" karena "${ticket.name}" adalah nama pihak kita sendiri/nama pelanggan kita!
- DILARANG KERAS meminta foto, nomor telepon, atau data kepada CS! Tugasmu adalah MEMBERIKAN informasi kepada CS, bukan meminta ke CS.
- DILARANG mengulang permintaan CS (misal jangan katakan "mohon bantuannya untuk mengirimkan lampiran")!

WAKTU SEKARANG: ${timeContext.timeStr} (Salam penutup yang tepat: "${timeContext.greeting}")

DATA TIKET KITA (Satu-satunya sumber fakta):
- Nama Pelanggan: ${ticket.name}
- ID Pelanggan: ${ticket.customer_id}
- No Telepon: ${ticket.phone || '-'}
- No Telepon Alternatif: ${ticket.alt_phone || '-'}
- Keluhan: ${ticket.complaint}
- Kondisi Indikator Modem: ${statusIndikatorText}
- Status Foto Lampiran: ${hasImages ? 'SUDAH TERKIRIM DI CHAT SEBELUMNYA' : 'BELUM TERSEDIA'}

CONTOH KASUS & JAWABAN YANG BENAR:

Contoh 1 (CS meminta lampiran / foto & no telepon):
Pesan CS: "Mohon dibantu kirimkan foto modem depan indikator, foto SN belakang, dan no alternatif."
Jawaban Kamu:
"Baik Kak, ${photoInfo}. Untuk kendalanya ${statusIndikatorText}, dan untuk ${contactInfo}. Mohon bantuannya untuk dilakukan pengecekan Kak. Terima kasih."

Contoh 2 (CS menanyakan apakah sudah restart):
Pesan CS: "Apakah sudah dicoba mematikan modem 5-10 menit?"
Jawaban Kamu:
"Sudah kami coba matikan dan restart modem selama beberapa menit Kak, namun kendalanya masih tetap sama. Mohon dibantu pengecekannya Kak. Terima kasih."

Contoh 3 (CS menanyakan konfirmasi data/perubahan wifi):
Pesan CS: "Apakah bersedia untuk pergantian password / reset konfigurasi?"
Jawaban Kamu:
"Sudah sesuai Kak, kami bersedia untuk dibantu prosesnya. Terima kasih Kak."

Contoh 4 (CS baru menyapa di awal chat):
Pesan CS: "Halo Kak, dengan Jadug siap membantu. Ada yang bisa dibantu?"
Jawaban Kamu:
"Baik Kak Jadug, mohon bantuannya untuk penanganan kendala internet kami. Terima kasih."

Contoh 5 (CS memberikan nomor tiket resmi):
Pesan CS: "Laporan sudah dibuatkan dengan nomor tiket IN12345678. Petugas akan menghubungi."
Jawaban Kamu:
Set is_closing = true, ticket_number = "IN12345678", text = "Baik Kak, terima kasih banyak atas bantuannya. ${timeContext.greeting}!"

Contoh 6 (CS melakukan perbaikan sistem / restart dari pusat):
Pesan CS: "Sudah kami bantu perbaikan/refresh dari sistem kami, mohon tunggu 5-10 menit."
Jawaban Kamu:
Set is_closing = true, ticket_number = "Perbaikan Sistem (Tunggu 5-10 Menit)", text = "Baik Kak, terima kasih atas bantuannya. Kami tunggu prosesnya. ${timeContext.greeting}!"

Contoh 7 (CS menginfokan layanan terisolir / ada tagihan tertunggak):
Pesan CS: "Status layanan internet terisolir. Silakan dapat melakukan pembayaran agar dapat kami bantu tindak lanjut kendala yang dialami ya kak."
Jawaban Kamu:
Set is_closing = true, ticket_number = "Belum Bayar / Tagihan Tertunggak", text = "Baik Kak, terima kasih atas informasinya. Akan kami sampaikan ke pelanggan untuk melakukan pembayaran terlebih dahulu. Terima kasih atas bantuannya Kak. ${timeContext.greeting}!"

Contoh 8 (CS menginfokan gangguan massal / pemeliharaan area):
Pesan CS: "Saat ini sedang ada gangguan massal / pemeliharaan di area pelanggan."
Jawaban Kamu:
Set is_closing = true, ticket_number = "Gangguan Massal di Area", text = "Baik Kak, terima kasih atas informasinya. Kami tunggu proses normalisasi jaringannya Kak. Terima kasih bantuannya Kak. ${timeContext.greeting}!"

PENTING: DILARANG KERAS MENGIRIM SALAM PENUTUP ATAU SET "is_closing": true KECUALI CS SUDAH MEMBERIKAN NOMOR TIKET RESMI ATAU TINDAKAN PENYELESAIAN JELAS (SEPERTI ISOLIR / GANGGUAN MASSAL / RESTART)!

KELUARAN HANYA JSON VALID TANPA MARKDOWN:
{
  "action": "reply",
  "text": "isi balasan ke CS",
  "ticket_number": "kode tiket atau null",
  "is_closing": true/false
}`;

  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${nvidiaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: incomingMessage.trim() },
        ],
        temperature: 0.1,
        max_tokens: 300,
        chat_template_kwargs: { enable_thinking: false },
      }),
    });

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    const cleaned = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
      if (!parsed.action) parsed.action = 'reply';
    } catch {
      parsed = { action: 'reply', text: cleaned, is_closing: false, ticket_number: null };
    }

    // Post-processing Sanitizer untuk menjamin 100% akurasi respon
    if (parsed.text) {
      // 1. Bersihkan jika LLM salah menyapa nama pelanggan sendiri (misal "Kak Suardana")
      if (ticket.name) {
        const escapedName = ticket.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nameRegex = new RegExp(`\\b(?:Kak|Pak|Ibu|Bpk)?\\s*${escapedName}\\b`, 'gi');
        parsed.text = parsed.text.replace(nameRegex, 'Kak').trim();
      }

      // 2. Cegah mirroring / parroting jika LLM mengulang permintaan lampiran CS
      const lower = parsed.text.toLowerCase();
      if (
        lower.includes('mohon bantuannya untuk mengirimkan lampiran') ||
        lower.includes('mohon bantuannya untuk kirimkan lampiran') ||
        lower.includes('mohon dibantu untuk mengirimkan lampiran') ||
        lower.includes('mohon bantuannya untuk mengirimkan nomor telepon') ||
        lower.includes('mohon informasikan nomor telepon alternatif')
      ) {
        parsed.text = defaultSafeReply;
      }

      // 3. Rapikan spasi dan sapaan berulang ("Kak Kak")
      parsed.text = parsed.text.replace(/\bKak\s+Kak\b/gi, 'Kak').replace(/\s{2,}/g, ' ').trim();
    } else {
      parsed.text = defaultSafeReply;
    }

    return parsed;
  } catch (err) {
    console.error('[AI Error]:', err.message);
    return {
      action: 'reply',
      text: defaultSafeReply,
      is_closing: false,
      ticket_number: null,
    };
  }
}

// Pastikan User Terautentikasi di Supabase
async function ensureAuthenticated() {
  if (serviceRoleKey) {
    console.log('[AUTH] Menggunakan SUPABASE_SERVICE_ROLE_KEY.');
    return;
  }

  const sessionFile = path.resolve(__dirname, '.session.json');

  if (fs.existsSync(sessionFile)) {
    try {
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      if (sessionData?.refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token: sessionData.access_token,
          refresh_token: sessionData.refresh_token,
        });
        if (!error && data?.user) {
          console.log(`[AUTH] Sesi tersimpan aktif untuk: ${data.user.email}`);
          return;
        } else if (error) {
          console.log(`[AUTH] Sesi tersimpan sudah kedaluwarsa (${error.message}). Memerlukan login ulang...`);
          try {
            fs.unlinkSync(sessionFile);
          } catch {}
        }
      }
    } catch {}
  }

  console.log('\n======================================================');
  console.log('  LOGIN KE SUPABASE UNTUK MENJALANKAN BOT LOKAL');
  console.log('======================================================');
  console.log('Masukkan akun login Absensi Piket Anda (cukup sekali):');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  const email = await ask('Email: ');
  const password = await ask('Password: ');
  rl.close();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: password.trim(),
  });

  if (error || !data?.session) {
    console.error('❌ Gagal login Supabase:', error?.message || 'Kredensial tidak valid');
    process.exit(1);
  }

  fs.writeFileSync(
    sessionFile,
    JSON.stringify(
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: data.user.email,
      },
      null,
      2
    )
  );

  console.log(`✓ Berhasil login sebagai: ${data.user.email}\n`);
}

// Luncurkan Browser Chrome
async function launchChrome(headless = true) {
  const profileDir = getProfileDir();
  return await puppeteer.launch({
    executablePath: chromePath,
    userDataDir: profileDir,
    headless: headless,
    defaultViewport: { width: 1280, height: 800 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-notifications',
    ],
  });
}

// Browser & Tab Persistent Singleton (Membuat sinkronisasi chat instan ~100ms tanpa spawn/kill Chrome berulang kali)
let persistentBrowser = null;
let persistentPage = null;

async function scrollChatToBottom(page) {
  try {
    await page.evaluate(() => {
      const scrollContainers = [
        document.querySelector('div[role="grid"]'),
        document.querySelector('div[role="main"] div[style*="overflow"]'),
        ...Array.from(document.querySelectorAll('div')).filter(
          (d) => d.scrollHeight > d.clientHeight && d.clientHeight > 150
        ),
      ];
      for (const c of scrollContainers) {
        if (c) c.scrollTop = c.scrollHeight;
      }
    });
  } catch {}
}

async function getDirectThreadPage() {
  if (persistentBrowser && persistentPage) {
    try {
      if (!persistentPage.isClosed()) {
        await persistentPage.evaluate(() => 1);
        if (persistentPage.url().includes('/direct/t/')) {
          await scrollChatToBottom(persistentPage);
          return persistentPage;
        }
      }
    } catch {
      console.log('\n⚠️ Tab Chrome tidak responsif, me-restart browser...');
      try { await persistentBrowser.close(); } catch {}
      persistentBrowser = null;
      persistentPage = null;
    }
  }

  // Buka sesi browser baru jika belum ada
  console.log('\n🌐 [CHROME LIVE] Menghubungkan sesi Chrome persistent ke Instagram DM...');
  persistentBrowser = await launchChrome(true);
  persistentPage = (await persistentBrowser.pages())[0] || (await persistentBrowser.newPage());

  await persistentPage.goto(DIRECT_THREAD_URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await new Promise((r) => setTimeout(r, 2000));

  if (persistentPage.url().includes('/accounts/login')) {
    throw new Error(
      'Sesi login Instagram belum tersimpan. Silakan jalankan "login_instagram.bat" terlebih dahulu.'
    );
  }

  // Dismiss modal dialog jika ada
  try {
    const buttons = await persistentPage.$$('button');
    for (const btn of buttons) {
      const text = await persistentPage.evaluate((el) => el.textContent, btn);
      if (text && (text.includes('Not Now') || text.includes('Lain Kali') || text.includes('Batal'))) {
        await btn.click();
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  } catch {}

  // Scroll ke paling bawah
  await scrollChatToBottom(persistentPage);

  return persistentPage;
}

// Ketikkan dan kirim pesan teks ke thread DM Instagram
async function sendMessageToDirectThread(page, text) {
  const messageInputSelector =
    'div[role="textbox"][contenteditable="true"], div[aria-label="Message"], div[aria-label="Pesan"]';
  const messageBox = await page.waitForSelector(messageInputSelector, { timeout: 15000 });

  if (!messageBox) {
    throw new Error('Kotak ketik pesan Instagram DM tidak ditemukan.');
  }

  await messageBox.click();
  await new Promise((r) => setTimeout(r, 400));

  for (const char of text) {
    if (char === '\n') {
      await page.keyboard.down('Shift');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Shift');
    } else {
      await page.keyboard.sendCharacter(char);
    }
    const delay = Math.floor(Math.random() * (45 - 20 + 1)) + 20;
    await new Promise((r) => setTimeout(r, delay));
  }

  await new Promise((r) => setTimeout(r, 600));
  await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 2500));
}

// Eksekusi Kirim Tiket Baru ke Instagram
async function dispatchTicket(ticket) {
  console.log(`\n🚀 [KIRIM TIKET] Memulai pengiriman: "${ticket.name}" (ID: ${ticket.customer_id})...`);
  const messageText = buildFirstMessage(ticket);

  try {
    const page = await getDirectThreadPage();

    await scrollChatToBottom(page);
    await new Promise((r) => setTimeout(r, 1000));

    console.log('   Mengetik teks keluhan tiket baru...');
    await sendMessageToDirectThread(page, messageText);
    console.log('   ✓ Teks pesan terkirim.');

    // Upload foto keluhan jika ada
    const { data: images } = await supabase
      .from('ticket_images')
      .select('*')
      .eq('ticket_id', ticket.id);

    if (images && images.length > 0) {
      console.log(`   Mengunggah ${images.length} foto lampiran...`);
      const tempPaths = [];
      try {
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('ticket-images')
            .download(img.storage_path);

          if (!downloadError && fileData) {
            const ext = img.storage_path.endsWith('.png') ? '.png' : '.jpg';
            const tempPath = path.resolve(__dirname, `temp_${Date.now()}_${i}${ext}`);
            const buffer = Buffer.from(await fileData.arrayBuffer());
            fs.writeFileSync(tempPath, buffer);
            tempPaths.push(tempPath);
          }
        }

        if (tempPaths.length > 0) {
          const fileInput = await page.$('input[type="file"]');
          if (fileInput) {
            await fileInput.uploadFile(...tempPaths);
            await new Promise((r) => setTimeout(r, 2500));

            const sendClicked = await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
              for (const b of buttons) {
                const text = (b.innerText || b.getAttribute('aria-label') || '').trim();
                if (text === 'Send' || text === 'Kirim') {
                  b.click();
                  return true;
                }
              }
              return false;
            });

            if (!sendClicked) {
              await page.keyboard.press('Enter');
            }
            await new Promise((r) => setTimeout(r, 4000));
            console.log('   ✓ Foto berhasil dilampirkan.');
          }
        }
      } catch (err) {
        console.warn('   ⚠️ Gagal upload foto otomatis:', err.message);
      } finally {
        for (const p of tempPaths) {
          try {
            fs.unlinkSync(p);
          } catch {}
        }
      }
    }

    const now = new Date().toISOString();
    await supabase
      .from('tickets')
      .update({
        status: 'in_conversation',
        started_at: now,
        updated_at: now,
      })
      .eq('id', ticket.id);

    await supabase.from('ticket_messages').insert({
      ticket_id: ticket.id,
      direction: 'out',
      sender: 'admin',
      body: messageText,
    });

    console.log(`✅ [SUKSES] Tiket "${ticket.name}" kini berstatus SEDANG BERJALAN di Instagram!\n`);
  } catch (err) {
    console.error(`❌ Gagal mengirim tiket: ${err.message}\n`);
  }
}

// Kirim pesan manual yang diketik admin di Web Dashboard ke DM Instagram
async function sendPendingOutboundMessages(page, activeTicket) {
  try {
    const { data: pendingMsgs } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', activeTicket.id)
      .eq('direction', 'out')
      .eq('sender', 'admin')
      .eq('ig_mid', 'pending')
      .order('created_at', { ascending: true });

    if (!pendingMsgs || pendingMsgs.length === 0) return;

    for (const msg of pendingMsgs) {
      console.log(`\n📤 [KIRIM MANUAL WEB -> IG] Mengirim pesan admin ke DM Instagram: "${msg.body}"`);
      await supabase
        .from('ticket_messages')
        .update({ ig_mid: 'sending' })
        .eq('id', msg.id);

      await sendMessageToDirectThread(page, msg.body);

      await supabase
        .from('ticket_messages')
        .update({ ig_mid: 'sent' })
        .eq('id', msg.id);

      console.log(`   ✓ Pesan manual admin sukses terkirim ke Instagram DM.`);
    }
  } catch (err) {
    console.error('⚠️ Gagal mengirim pesan manual pending ke Instagram:', err.message);
  }
}

// Cek Pesan Masuk, Ekstrak Nomor Tiket, & Jalankan AI Auto-Reply
async function syncActiveChat(activeTicket) {
  try {
    const page = await getDirectThreadPage();

    // 0. Cek dan kirim balasan manual dari Web Dashboard jika ada yang berstatus pending
    await sendPendingOutboundMessages(page, activeTicket);

    const messages = await page.evaluate(() => {
      // Abaikan sidebar navigasi, panel rincian/info di sebelah kanan, dan dialog
      const isInsideIgnoredContainer = (el) => {
        // Abaikan jika el berada di dalam input box pesan / form pengiriman chat
        if (
          el.closest('[role="textbox"], [aria-label="Message"], [aria-label="Pesan"], form')
        ) {
          return true;
        }

        // Abaikan jika el berada di dalam tombol / kartu kontak WhatsApp itu sendiri
        if (
          el.closest('a[href*="whatsapp.com"], a[href*="wa.me"]') ||
          el.closest('[aria-label*="WhatsApp" i]')
        ) {
          return true;
        }

        let p = el.parentElement;
        while (p && p !== document.body) {
          const tag = p.tagName;
          if (tag === 'NAV' || tag === 'ASIDE') return true;
          const role = p.getAttribute('role');
          if (role === 'complementary' || role === 'navigation') return true;
          const ariaLabel = p.getAttribute('aria-label');
          if (
            ariaLabel &&
            (ariaLabel === 'Details' ||
              ariaLabel === 'Rincian' ||
              ariaLabel === 'Info' ||
              ariaLabel === 'Thread details')
          ) {
            return true;
          }
          p = p.parentElement;
        }
        return false;
      };

      const ignored = new Set([
        'Home',
        'Search',
        'Explore',
        'Reels',
        'Messages',
        'Notifications',
        'Create',
        'Profile',
        'More',
        'Threads',
        'Phone number',
        'Phone Number',
        'Nomor telepon',
        'Nomor Telepon',
        'Pesan WhatsApp',
        'Pesan Whatsapp',
        'Panggilan WhatsApp',
        'Panggilan Whatsapp',
        'Kirim pesan WhatsApp',
        'New messages',
        'New Messages',
        'new messages',
        'Pesan baru',
        'Pesan Baru',
        'Unread messages',
        'Pesan belum dibaca',
        'Today',
        'Yesterday',
        'Hari ini',
        'Kemarin',
        'Seen',
        'Delivered',
        'Sent',
        'Sending...',
        'Dilihat',
        'Terkirim',
      ]);

      function isTimestampOrMeta(t) {
        if (!t) return true;
        const s = t.replace(/\s+/g, ' ').trim();
        if (!s) return true;
        if (/^\d+$/.test(s)) return true;
        if (/^\d+[smhdwy]$/i.test(s)) return true;
        if (/^\d{1,2}[:.]\d{2}(\s*(?:am|pm|wib|wita|wit))?$/i.test(s)) return true;
        if (/^(today|yesterday|hari ini|kemarin|\w+,\s*\d+\s*\w+|\d+\s*\w+(\s*\d{4})?)[,\s]+(\d{1,2}[:.]\d{2}(\s*(?:am|pm|wib|wita|wit))?)$/i.test(s)) return true;
        if (/^(seen|delivered|sent|sending|dilihat|terkirim|mengirim)[\s.]*$/i.test(s)) return true;
        if (/^dilihat\s*(oleh|pukul|\d)/i.test(s)) return true;
        if (/^seen\s*(by|\d)/i.test(s)) return true;
        return false;
      }

      const inputBox = document.querySelector(
        'div[role="textbox"][contenteditable="true"], div[aria-label="Message"], div[aria-label="Pesan"]'
      );
      const chatBounds = inputBox ? inputBox.getBoundingClientRect() : null;

      function detectDirection(el) {
        let isBlue = false;
        let isGray = false;
        let c = el;
        for (let i = 0; i < 6 && c && c !== document.body; i++) {
          const bg = window.getComputedStyle(c).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            const rgb = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (rgb) {
              const r = parseInt(rgb[1], 10);
              const g = parseInt(rgb[2], 10);
              const b = parseInt(rgb[3], 10);
              // Bubble biru/ungu khas pesan keluar Instagram (outgoing)
              if ((b > 150 && b > r + 30) || (b > 180 && g < 200)) {
                isBlue = true;
                break;
              }
              // Bubble abu-abu netral CS (incoming)
              if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r < 200) {
                isGray = true;
              }
            }
          }
          c = c.parentElement;
        }
        if (isBlue) return 'out';

        let isFlexEnd = false;
        let isFlexStart = false;
        let cp = el.parentElement;
        for (let i = 0; i < 8 && cp && cp !== document.body; i++) {
          const style = window.getComputedStyle(cp);
          const jc = style.justifyContent;
          const ai = style.alignItems;
          const as = style.alignSelf;
          if (jc === 'flex-end' || jc === 'end' || ai === 'flex-end' || as === 'flex-end') {
            isFlexEnd = true;
          }
          if (jc === 'flex-start' || jc === 'start' || ai === 'flex-start' || as === 'flex-start') {
            isFlexStart = true;
          }
          cp = cp.parentElement;
        }
        if (isFlexEnd && !isFlexStart) return 'out';

        if (chatBounds && chatBounds.width > 0) {
          const r = el.getBoundingClientRect();
          const chatMid = chatBounds.left + (chatBounds.width / 2);
          const bubbleCenter = (r.left + r.right) / 2;
          if (bubbleCenter > chatMid && !isGray && !isFlexStart) {
            return 'out';
          }
        }

        return 'in';
      }

      const allNodes = Array.from(document.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
      // Ambil leaf nodes yang tidak punya child dir="auto" di dalamnya untuk mencegah duplikasi
      const leafNodes = allNodes.filter((n) => {
        if (isInsideIgnoredContainer(n)) return false;
        if (n.querySelector('div[dir="auto"], span[dir="auto"]')) return false;
        return true;
      });

      const items = [];
      for (const n of leafNodes) {
        const text = n.innerText?.replace(/\s+/g, ' ').trim();
        if (!text) continue;
        const lower = text.toLowerCase();
        if (ignored.has(text) || ignored.has(lower)) continue;
        if (isTimestampOrMeta(text)) continue;

        const direction = detectDirection(n);
        items.push({ text, direction });
      }

      return items;
    });

    if (!messages || messages.length === 0) return;

    // Filter Kata & Label Antarmuka (Abaikan label Meta, status pengiriman, dll.)
    const ignoredChatKeywords = new Set([
      'iconnet.here',
      'mitraiconnet.balinusra',
      'Primary',
      'General',
      'Requests',
      'Seen',
      'Delivered',
      'Sent',
      'Sending...',
      'Dashboard',
      'Active now',
      'Details',
      'Info',
      'WhatsApp',
      'Also from Meta',
      'Auto-detected outcome',
      'Auto-detected',
      'Outcome',
      'Your note',
      'New messages',
      'New Messages',
      'new messages',
      'Pesan baru',
      'Pesan Baru',
      'Unread messages',
      'Pesan belum dibaca',
      'Nomor telepon',
      'Nomor Telepon',
      'Phone number',
      'Phone Number',
      'Pesan WhatsApp',
      'Pesan Whatsapp',
      'Panggilan WhatsApp',
      'Panggilan Whatsapp',
      'Kirim pesan WhatsApp',
      'Today',
      'Yesterday',
      'Hari ini',
      'Kemarin',
      'Dilihat',
      'Terkirim',
    ]);

    // Cari posisi kemunculan pesan pembuka untuk tiket aktif saat ini di thread chat Instagram
    let openingMsgIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const item = messages[i];
      const text = item.text;
      const isOurOpeningReport =
        item.direction === 'out' &&
        text.includes(activeTicket.customer_id) &&
        (text.includes('ID Pelanggan') ||
         text.includes('Nama Pelanggan') ||
         text.includes('Keluhan:') ||
         text.includes('izin melaporkan'));
      if (isOurOpeningReport) {
        openingMsgIndex = i;
        break;
      }
    }

    // Jika format lengkap tidak tampak (misal kepotong karena virtual scroll), cari kemunculan pertama customer_id dari atas
    if (openingMsgIndex === -1) {
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].text.includes(activeTicket.customer_id)) {
          openingMsgIndex = i;
          break;
        }
      }
    }

    // Jika pesan pembuka dengan customer_id tidak tampak (karena virtual scrolling Instagram me-recycle pesan atas),
    // cek apakah tiket ini sudah pernah di-dispatch (started_at ada): jika ya, ambil pesan di thread
    if (openingMsgIndex === -1) {
      if (activeTicket.started_at) {
        openingMsgIndex = 0;
      } else {
        return;
      }
    }

    // Ambil seluruh isi pesan keluar (yang dikirim admin atau AI) untuk tiket ini agar tidak salah dikenali sebagai balasan CS
    const { data: outMsgs } = await supabase
      .from('ticket_messages')
      .select('body')
      .eq('ticket_id', activeTicket.id)
      .eq('direction', 'out');
    const outBodies = new Set((outMsgs || []).map((o) => (o.body || '').replace(/\s+/g, ' ').trim()));

    // Kumpulkan seluruh bubble pesan CS yang masuk SETELAH pesan pembuka tiket ini
    const csBubbles = [];
    const startIndex = openingMsgIndex === 0 && !messages[0]?.text.includes(activeTicket.customer_id) ? 0 : openingMsgIndex + 1;
    for (let i = startIndex; i < messages.length; i++) {
      const item = messages[i];
      const m = item.text?.trim();
      if (!m) continue;

      // JIKA INI BUBBLE PESAN KELUAR (OUTGOING)
      if (item.direction === 'out') {
        const normM = m.replace(/\s+/g, ' ').trim();
        // Cek apakah pesan keluar ini sudah tercatat di database
        if (!outBodies.has(normM)) {
          console.log(`\n💬 [SYNC IG MANUAL] Pesan manual admin dari Instagram terdeteksi: "${m}"`);
          await supabase.from('ticket_messages').insert({
            ticket_id: activeTicket.id,
            direction: 'out',
            sender: 'admin',
            body: m,
            ig_mid: 'from_ig',
          });
          outBodies.add(normM);
        }
        continue; // Lewati, JANGAN masukkan ke csBubbles
      }

      // JIKA INI BUBBLE PESAN MASUK (INCOMING / CS)
      const normM = m.replace(/\s+/g, ' ').trim();
      if (outBodies.has(normM)) continue;
      if (ignoredChatKeywords.has(m)) continue;
      // Abaikan jika ini adalah format laporan pembuka kita sendiri
      if (
        (m.includes('ID Pelanggan') && (m.includes('Keluhan:') || m.includes('Nama Pelanggan:'))) ||
        m.includes('Selamat Pagi/Siang Kak, izin melaporkan')
      ) {
        continue;
      }
      if (activeTicket.pln_id && m.includes(activeTicket.pln_id) && m.includes('ID PLN')) continue;
      if (m.includes(activeTicket.name) && (m.includes('Keluhan:') || m.includes('Alamat:'))) continue;

      // Abaikan jika bubble HANYA nomor telepon atau cocok dengan nomor HP pelanggan / nomor alternatif
      const cleanMDigits = m.replace(/\D/g, '');
      const ticketPhoneDigits = (activeTicket.phone || '').replace(/\D/g, '').slice(-8);
      const altPhoneDigits = (activeTicket.alt_phone || '').replace(/\D/g, '').slice(-8);

      if (ticketPhoneDigits && cleanMDigits.length >= 7 && cleanMDigits.includes(ticketPhoneDigits)) {
        continue;
      }
      if (altPhoneDigits && cleanMDigits.length >= 7 && cleanMDigits.includes(altPhoneDigits)) {
        continue;
      }

      // Format nomor telepon standar tanpa teks lain (misal: 0853-3807-4588 atau +62 853-3807-4588 atau +6285338074588)
      if (/^(\+?62|0)[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,5}$/.test(m)) {
        continue;
      }

      // Abaikan pesan antrean otomatis CS / bot pesan tunggu live chat / info profil kontak / divider UI
      const lowerM = m.toLowerCase();
      if (
        lowerM === 'seen' ||
        lowerM.startsWith('seen ') ||
        lowerM === 'sent' ||
        lowerM.startsWith('sent ') ||
        lowerM === 'delivered' ||
        lowerM.startsWith('delivered ') ||
        lowerM === 'active now' ||
        lowerM.startsWith('active ') ||
        lowerM.includes('typing...') ||
        lowerM === 'new messages' ||
        lowerM === 'new message' ||
        lowerM === 'pesan baru' ||
        lowerM === 'unread messages' ||
        lowerM === 'pesan belum dibaca' ||
        lowerM === 'nomor telepon' ||
        lowerM === 'phone number' ||
        lowerM.includes('pesan whatsapp') ||
        lowerM.includes('panggilan whatsapp') ||
        lowerM.includes('whatsapp message') ||
        lowerM.includes('whatsapp call') ||
        lowerM === 'today' ||
        lowerM === 'yesterday' ||
        lowerM === 'hari ini' ||
        lowerM === 'kemarin' ||
        lowerM.includes('auto-detected') ||
        lowerM.includes('outcome') ||
        lowerM.includes('seluruh agent') ||
        lowerM.includes('melayani pelanggan lain') ||
        lowerM.includes('menunggu dengan menyampaikan') ||
        lowerM.includes('antrean') ||
        lowerM.includes('antrian') ||
        lowerM.includes('menunggu antrian') ||
        lowerM.startsWith('+55 ') ||
        lowerM.startsWith('phone number') ||
        lowerM.includes('business account') ||
        lowerM.includes('view profile') ||
        lowerM.includes('suggested')
      ) {
        continue;
      }

      // Hindari duplikat bubble berurutan
      if (csBubbles.length === 0 || csBubbles[csBubbles.length - 1] !== m) {
        csBubbles.push(m);
      }
    }

    if (csBubbles.length === 0) return;

    // Cetak log HANYA jika ada pesan CS yang benar-benar baru masuk (anti-spam)
    const currentSig = `${activeTicket.id}::${csBubbles.length}::${csBubbles[csBubbles.length - 1]}`;
    if (currentSig !== lastReportedChatSig) {
      lastReportedChatSig = currentSig;
      logEvent(`\n📬 [PESAN CS MASUK] (${csBubbles.length} pesan): "${csBubbles[csBubbles.length - 1].slice(0, 80)}"`);
    }

    // 1. Simpan bubble pesan CS baru ke tabel ticket_messages agar admin melihat isi chat CS di Web
    for (const bubble of csBubbles) {
      const { data: existingMsg } = await supabase
        .from('ticket_messages')
        .select('id')
        .eq('ticket_id', activeTicket.id)
        .eq('direction', 'in')
        .eq('body', bubble)
        .maybeSingle();

      if (!existingMsg) {
        await supabase.from('ticket_messages').insert({
          ticket_id: activeTicket.id,
          direction: 'in',
          sender: 'iconnet',
          body: bubble,
        });
      }
    }

    // 2. DETEKSI OUTPUT TIKET SECARA UNIVERSAL (Nomor Tiket / Restart Sistem / Gangguan Massal / Tagihan)
    const combinedCsText = csBubbles.join('\n');
    const directOutcome = extractTicketOutcome(combinedCsText);

    if (directOutcome && directOutcome.value !== activeTicket.ticket_number) {
      console.log(`\n🎉 [OUTPUT TERDETEKSI] "${directOutcome.value}" (Tipe: ${directOutcome.type})`);
      await supabase
        .from('tickets')
        .update({ ticket_number: directOutcome.value, updated_at: new Date().toISOString() })
        .eq('id', activeTicket.id);
      activeTicket.ticket_number = directOutcome.value;
    }

    // 2.1 JIKA TIKET INI MENDAPATKAN NOMOR TIKET RESMI CS ATAU RESOLUSI
    const isActualTicketFound =
      (directOutcome && directOutcome.type === 'ticket') ||
      (activeTicket.ticket_number && /^[A-Z0-9]{8}$/.test(activeTicket.ticket_number));
    const confirmedNumber = directOutcome?.value || activeTicket.ticket_number;

    if (isActualTicketFound && confirmedNumber) {
      console.log(`\n🎉 [TIKET RESMI DIDAPATKAN] Tiket "${activeTicket.name}" mendapatkan nomor tiket resmi: ${confirmedNumber}`);

      // Cek apakah kita sudah pernah mengirimkan ucapan penutup / terima kasih untuk tiket ini
      const { data: outMsgs } = await supabase
        .from('ticket_messages')
        .select('body')
        .eq('ticket_id', activeTicket.id)
        .eq('direction', 'out');

      const hasSentClosing = (outMsgs || []).some(
        (m) =>
          (m.body || '').toLowerCase().includes('terima kasih') ||
          (m.body || '').toLowerCase().includes('sudah cukup') ||
          (m.body || '').toLowerCase().includes('selamat pagi') ||
          (m.body || '').toLowerCase().includes('selamat siang') ||
          (m.body || '').toLowerCase().includes('selamat sore') ||
          (m.body || '').toLowerCase().includes('selamat malam')
      );

      if (!hasSentClosing) {
        const timeCtx = getWitaTimeContext();
        const closingText = `Baik Kak, sudah cukup dan tidak ada lagi. Terima kasih banyak atas bantuannya. ${timeCtx.greeting}!`;
        console.log(`💬 [KIRIM SALAM PENUTUP] Mengirim salam penutup resmi ke Instagram: "${closingText}"`);
        try {
          await sendMessageToDirectThread(page, closingText);
          await supabase.from('ticket_messages').insert({
            ticket_id: activeTicket.id,
            direction: 'out',
            sender: 'ai',
            body: closingText,
          });
          console.log(`✓ Salam penutup terkirim ke CS ICONNET.`);
        } catch (e) {
          console.warn('⚠️ Gagal mengetikkan salam penutup:', e.message);
        }
      }

      console.log(`⏳ [JEDA PENUTUPAN SESI] Memberi jeda 25 detik agar CS menyelesaikan tiket sebelum memproses antrean baru...`);
      await new Promise((r) => setTimeout(r, 25000));

      const now = new Date().toISOString();
      await supabase
        .from('tickets')
        .update({
          status: 'ticket_issued',
          ticket_issued_at: now,
          ticket_number: confirmedNumber,
          updated_at: now,
        })
        .eq('id', activeTicket.id);

      await supabase
        .from('ticketing_settings')
        .delete()
        .eq('key', 'pending_ai_reply');

      console.log(`✅ [TIKET SELESAI] Tiket "${activeTicket.name}" resmi ticket_issued dengan nomor ${confirmedNumber}. Sesi CS tuntas tertutup!\n`);
      return;
    }

    // 2.2 JIKA LAYANAN TERISOLIR (BELUM BAYAR) ATAU GANGGUAN MASSAL TERDETEKSI
    const isSpecialResolution =
      directOutcome && (directOutcome.type === 'billing' || directOutcome.type === 'mass_outage');

    if (isSpecialResolution) {
      console.log(`\n📌 [RESOLUSI NON-TIKET] Terdeteksi status khusus: "${directOutcome.value}"`);

      // Cek apakah kita sudah pernah mengirimkan ucapan konfirmasi/penutup untuk tiket ini
      const { data: outMsgs } = await supabase
        .from('ticket_messages')
        .select('body')
        .eq('ticket_id', activeTicket.id)
        .eq('direction', 'out');

      const hasSentAck = (outMsgs || []).some(
        (m) =>
          (m.body || '').toLowerCase().includes('terima kasih') ||
          (m.body || '').toLowerCase().includes('kami sampaikan') ||
          (m.body || '').toLowerCase().includes('kami infokan')
      );

      // Cek apakah sesi chat sudah diakhiri oleh CS
      const isAlreadyClosedByCs =
        combinedCsText.toLowerCase().includes('chat akan kami akhiri') ||
        combinedCsText.toLowerCase().includes('percakapan kami akhiri') ||
        combinedCsText.toLowerCase().includes('sesi kami akhiri') ||
        (combinedCsText.toLowerCase().includes('terima kasih telah menghubungi') &&
          (combinedCsText.toLowerCase().includes('selamat pagi') ||
           combinedCsText.toLowerCase().includes('selamat siang') ||
           combinedCsText.toLowerCase().includes('selamat sore') ||
           combinedCsText.toLowerCase().includes('selamat malam')));

      if (!hasSentAck && !isAlreadyClosedByCs) {
        const timeCtx = getWitaTimeContext();
        let replyMsg = `Baik Kak, terima kasih atas informasinya. Akan kami koordinasikan ke pelanggan. ${timeCtx.greeting}!`;
        if (directOutcome.type === 'billing') {
          replyMsg = `Baik Kak, terima kasih atas informasinya. Akan kami informasikan ke pelanggan terkait pembayaran. Terima kasih banyak Kak. ${timeCtx.greeting}!`;
        } else if (directOutcome.type === 'mass_outage') {
          replyMsg = `Baik Kak, terima kasih atas informasinya terkait pemeliharaan/gangguan massal. Kami tunggu proses normalisasinya Kak. ${timeCtx.greeting}!`;
        }

        console.log(`💬 [KIRIM BALASAN RESOLUSI] Mengirim balasan ke CS: "${replyMsg}"`);
        try {
          await sendMessageToDirectThread(page, replyMsg);
          await supabase.from('ticket_messages').insert({
            ticket_id: activeTicket.id,
            direction: 'out',
            sender: 'ai',
            body: replyMsg,
          });
          console.log(`✓ Balasan resolusi terkirim.`);
        } catch (e) {
          console.warn('⚠️ Gagal mengirim balasan resolusi:', e.message);
        }

        console.log(`⏳ [JEDA PENUTUPAN SESI] Memberi jeda 30 detik agar CS menutup percakapan...`);
        await new Promise((r) => setTimeout(r, 30000));
      }

      const now = new Date().toISOString();
      await supabase
        .from('tickets')
        .update({
          status: 'closed',
          ticket_number: directOutcome.value,
          updated_at: now,
        })
        .eq('id', activeTicket.id);

      await supabase
        .from('ticketing_settings')
        .delete()
        .eq('key', 'pending_ai_reply');

      console.log(`✅ [TIKET SELESAI] Tiket "${activeTicket.name}" resmi closed dengan resolusi "${directOutcome.value}". Antrean baru dapat berjalan!\n`);
      return;
    }

    // 3. DETEKSI APAKAH SESI TELAH DITUTUP OLEH CS (misal: "chat akan kami akhiri", "tidak ada jawaban", dll)
    const lowerCombined = combinedCsText.toLowerCase();
    const isClosedByCs =
      lowerCombined.includes('chat akan kami akhiri') ||
      lowerCombined.includes('percakapan kami akhiri') ||
      lowerCombined.includes('sesi kami akhiri') ||
      (lowerCombined.includes('terima kasih telah menghubungi') &&
        (lowerCombined.includes('selamat pagi') ||
         lowerCombined.includes('selamat siang') ||
         lowerCombined.includes('selamat sore') ||
         lowerCombined.includes('selamat malam')));

    if (isClosedByCs) {
      console.log(`\n🏁 [SESI DITUTUP OLEH CS] CS ICONNET telah menutup percakapan.`);
      const finalNow = new Date().toISOString();
      const isActualTicket = activeTicket.ticket_number && /^[A-Z0-9]{8}$/.test(activeTicket.ticket_number);
      const finalStatus = isActualTicket ? 'ticket_issued' : 'closed';
      const finalOutcome = activeTicket.ticket_number || directOutcome?.value || 'Sesi Diakhiri CS (Selesai)';

      await supabase
        .from('tickets')
        .update({
          status: finalStatus,
          ticket_issued_at: isActualTicket ? finalNow : null,
          ticket_number: finalOutcome,
          updated_at: finalNow,
        })
        .eq('id', activeTicket.id);

      await supabase
        .from('ticketing_settings')
        .delete()
        .eq('key', 'pending_ai_reply');

      console.log(`✅ [TIKET SELESAI] Tiket "${activeTicket.name}" resmi ${finalStatus} dengan output: "${finalOutcome}". Antrean baru dapat berjalan!\n`);
      return;
    }

    // 4. BALASAN AI / ESCALATION UNTUK PERTANYAAN CS (JIKA CHAT BELUM BERAKHIR)
    const recentCsBubbles = csBubbles.slice(-4);
    const lastCsMessage = recentCsBubbles.join('\n');

    if (
      lastCsMessage &&
      lastCsMessage !== lastAnsweredMessage &&
      activeTicket.status === 'in_conversation' &&
      activeTicket.mode === 'ai' &&
      (activeTicket.ai_turns || 0) < 12
    ) {
      console.log(`\n💬 [PESAN CS MASUK] "${lastCsMessage.slice(0, 90)}..."`);
      console.log(`🤖 [AI MEMPROSES JAWABAN] Memanggil Nemotron AI...`);

      const aiReply = await generateAIReply(activeTicket, lastCsMessage);

      if (aiReply && aiReply.text) {
        console.log(`   Draf Balasan AI: "${aiReply.text}"`);

        // Periksa apakah Mode Monitoring Aktif
        const { data: monSetting } = await supabase
          .from('ticketing_settings')
          .select('value')
          .eq('key', 'ai_monitoring_enabled')
          .maybeSingle();

        const isMonitoring = monSetting ? Boolean(monSetting.value) : false;

        // Hanya anggap sebagai balasan penutup jika SUDAH ADA nomor tiket atau resolusi valid
        const hasKnownOutcome = Boolean(aiReply.ticket_number) || Boolean(activeTicket.ticket_number);
        const isClosingReply = hasKnownOutcome && Boolean(aiReply.is_closing);

        if (isMonitoring && !isClosingReply) {
          console.log(`🔔 [MODE MONITORING AKTIF] Balasan AI menunggu approval admin di Web!\n`);
          await supabase.from('ticketing_settings').upsert({
            key: 'pending_ai_reply',
            value: {
              ticket_id: activeTicket.id,
              customer_name: activeTicket.name,
              reply_text: aiReply.text,
              incoming_text: lastCsMessage,
              created_at: new Date().toISOString(),
            },
          });
          await supabase
            .from('tickets')
            .update({ status: 'needs_admin', updated_at: new Date().toISOString() })
            .eq('id', activeTicket.id);

          lastAnsweredMessage = lastCsMessage;
        } else {
          // Mode AI Auto: Ketikkan balasan langsung ke Instagram DM
          console.log(`   Mengetikkan balasan ke DM Instagram...`);
          await sendMessageToDirectThread(page, aiReply.text);

          // Rekam ke ticket_messages dan update ai_turns
            await supabase.from('ticket_messages').insert({
              ticket_id: activeTicket.id,
              direction: 'out',
              sender: 'ai',
              body: aiReply.text,
            });

            await supabase
              .from('tickets')
              .update({
                ai_turns: (activeTicket.ai_turns || 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq('id', activeTicket.id);

            lastAnsweredMessage = lastCsMessage;
            console.log(`✅ [AI TERKIRIM] Berhasil membalas ke CS ICONNET: "${aiReply.text}"\n`);

            // Cek apakah percakapan mencapai akhir sesi (closing / nomor tiket keluar / kesimpulan hasil)
            const fallbackOutcome = extractTicketOutcome(lastCsMessage);
            const detectedOutcome =
              aiReply.ticket_number || (fallbackOutcome ? fallbackOutcome.value : null);
            
            // KUNCI PENGAMAN: Sesi HANYA boleh ditutup jika SUDAH ADA nomor tiket resmi atau output resolusi!
            const hasFinalOutcome = Boolean(detectedOutcome) || Boolean(activeTicket.ticket_number);
            const isClosing = hasFinalOutcome && (aiReply.is_closing || Boolean(detectedOutcome));

            if (detectedOutcome && detectedOutcome !== activeTicket.ticket_number) {
              console.log(`🎉 [OUTPUT / KESIMPULAN TIKET] Terdeteksi Output: "${detectedOutcome}"!`);
              await supabase
                .from('tickets')
                .update({ ticket_number: detectedOutcome })
                .eq('id', activeTicket.id);
            }

            if (isClosing) {
              console.log(`🏁 [SESI PENUTUPAN] AI telah menyampaikan salam penutup / merangkum resolusi sesi chat.`);
              console.log(`⏳ Memberi jeda 40 detik agar CS menutup sesi chat sebelum memproses tiket antrean berikutnya...`);

              await new Promise((r) => setTimeout(r, 40000));

              const finalNow = new Date().toISOString();
              const isActualTicket = detectedOutcome && /^[A-Z0-9]{8}$/.test(detectedOutcome);
              const finalStatus = isActualTicket ? 'ticket_issued' : 'closed';

              await supabase
                .from('tickets')
                .update({
                  status: finalStatus,
                  ticket_issued_at: isActualTicket ? finalNow : null,
                  updated_at: finalNow,
                  ticket_number: detectedOutcome || activeTicket.ticket_number,
                })
                .eq('id', activeTicket.id);

              await supabase
                .from('ticketing_settings')
                .delete()
                .eq('key', 'pending_ai_reply');

              console.log(`✅ [SESI TUNTAS] Tiket "${activeTicket.name}" resmi ${finalStatus} dengan output: "${detectedOutcome || activeTicket.ticket_number}". Antrean baru aman diproses!\n`);
              return;
            }
          }
        }
      }
  } catch (err) {
    console.error('   ⚠️ Error sync chat:', err.message);
  }
}

// Verifikasi & Refresh Sesi Supabase Berkala
async function checkAndRefreshSession() {
  if (serviceRoleKey) return true;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.expires_at) {
      const nowSec = Math.floor(Date.now() / 1000);
      // Jika token masih berlaku lebih dari 60 detik, sesi aman
      if (session.expires_at - nowSec > 60) {
        return true;
      }
    }

    const sessionFile = path.resolve(__dirname, '.session.json');
    if (!fs.existsSync(sessionFile)) return false;

    const fileData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    if (!fileData?.refresh_token) return false;

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: fileData.refresh_token,
    });

    if (error || !data?.session) {
      return false;
    }

    fs.writeFileSync(
      sessionFile,
      JSON.stringify(
        {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          user: data.session.user.email,
        },
        null,
        2
      )
    );
    return true;
  } catch {
    return false;
  }
}

// Kirim Heartbeat ke Supabase agar Web Dashboard Tahu Siapa Petugas yang Aktif
let lastHeartbeatTime = 0;
async function sendHeartbeat(isOnline = true) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email || 'Petugas Piket';
    await supabase.from('ticketing_settings').upsert({
      key: 'bot_runner_heartbeat',
      value: {
        online: isOnline,
        user_email: userEmail,
        hostname: os.hostname(),
        timestamp: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    });
  } catch {}
}

// Pasang listener realtime agar respon manual admin dari Web langsung terkirim seketika
function setupRealtimeOutboundListener() {
  try {
    supabase
      .channel('bot-runner-outbound-sync')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: 'direction=eq.out',
        },
        async (payload) => {
          const msg = payload.new;
          if (msg && msg.sender === 'admin' && msg.ig_mid === 'pending') {
            try {
              const page = await getDirectThreadPage();
              if (page) {
                console.log(`\n⚡ [REALTIME WEB -> IG] Mengirim pesan manual admin: "${msg.body}"`);
                await supabase
                  .from('ticket_messages')
                  .update({ ig_mid: 'sending' })
                  .eq('id', msg.id);

                await sendMessageToDirectThread(page, msg.body);

                await supabase
                  .from('ticket_messages')
                  .update({ ig_mid: 'sent' })
                  .eq('id', msg.id);

                console.log(`   ✓ Pesan admin berhasil diketikkan ke Instagram DM secara instan.`);
              }
            } catch (e) {
              console.warn('⚠️ Realtime outbound tertunda, akan dikirim pada siklus periksa berikutnya:', e.message);
            }
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('⚠️ Gagal memasang realtime outbound listener:', err.message);
  }
}

// Loop Utama Bot
async function startBotLoop() {
  console.log('=======================================================');
  console.log('   ICONNET AUTO-TICKET BOT RUNNER (LOCAL PUPPETEER)   ');
  console.log('=======================================================');
  console.log(`[INFO] Supabase URL: ${supabaseUrl}`);
  console.log(`[INFO] Profil Chrome: ${getProfileDir()}`);
  console.log(`[INFO] Lokasi Chrome: ${chromePath}`);
  console.log('[INFO] Bot siap memantau antrean & balasan AI...\n');

  await ensureAuthenticated();
  await sendHeartbeat(true);
  setupRealtimeOutboundListener();

  let isChecking = false;

  const runCycle = async () => {
    if (isChecking) return;
    isChecking = true;

    try {
      // Kirim heartbeat berkala setiap ~12 detik
      if (Date.now() - lastHeartbeatTime > 12000) {
        lastHeartbeatTime = Date.now();
        sendHeartbeat(true);
      }

      const isAuthValid = await checkAndRefreshSession();
      if (!isAuthValid) {
        updateStatusLine('⚠️ [SESI EXPIRED] Sesi login Supabase habis. Tutup dan buka kembali jalankan_bot.bat untuk login!');
        return;
      }

      // 1. Cek apakah ada tiket aktif (in_conversation / needs_admin)
      const { data: activeTicket } = await supabase
        .from('tickets')
        .select('*')
        .in('status', ['in_conversation', 'needs_admin'])
        .maybeSingle();

      if (activeTicket) {
        updateStatusLine(`Tiket aktif: "${activeTicket.name}" | Memeriksa chat...`);
        await syncActiveChat(activeTicket);
      } else {
        // Reset signature chat saat tidak ada tiket aktif
        lastReportedChatSig = '';

        // 2. Jika tidak ada tiket aktif, periksa apakah ada antrean
        const { data: queuedTickets } = await supabase
          .from('tickets')
          .select('*')
          .eq('status', 'queued')
          .order('queue_order', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(1);

        if (queuedTickets && queuedTickets.length > 0) {
          clearStatusLine();
          const nextTicket = queuedTickets[0];
          await dispatchTicket(nextTicket);
        } else {
          updateStatusLine('Tidak ada antrean tiket aktif. Menunggu tiket baru...');
        }
      }
    } catch (err) {
      console.error('\n⚠️ Error di loop utama:', err.message);
    } finally {
      isChecking = false;
    }
  };

  await runCycle();
  setInterval(runCycle, 4000);
}

const cleanup = async () => {
  console.log('\n🛑 Menutup bot dan browser Chrome...');
  try {
    await sendHeartbeat(false);
  } catch {}
  if (persistentBrowser) {
    try { await persistentBrowser.close(); } catch {}
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

startBotLoop().catch((err) => {
  console.error('Fatal bot error:', err);
  process.exit(1);
});
