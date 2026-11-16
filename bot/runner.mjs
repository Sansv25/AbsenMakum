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
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Konfigurasi Path
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DIRECT_THREAD_URL = 'https://www.instagram.com/direct/t/17848314279030884/';

function getProfileDir() {
  const externalProfile = 'D:\\otomasi\\Auto tiket\\.chrome_instagram_profile';
  if (fs.existsSync(externalProfile)) {
    return externalProfile;
  }
  const localProfile = path.resolve(__dirname, '..', '.chrome_instagram_profile');
  if (!fs.existsSync(localProfile)) {
    fs.mkdirSync(localProfile, { recursive: true });
  }
  return localProfile;
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

// Cache pesan terakhir yang sudah dijawab agar tidak menjawab berulang-ulang
let lastAnsweredMessage = '';

// Format Pesan Pembuka Standar
function buildFirstMessage(ticket) {
  const parts = [];
  parts.push('Selamat Pagi/Siang Kak, izin melaporkan gangguan pelanggan:');
  parts.push('');
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
  parts.push('');
  parts.push('Mohon bantuannya untuk diterbitkan tiket gangguan. Terima kasih.');
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

  // 2. Cek tagihan belum bayar / isolir
  if (lower.includes('bayar') || lower.includes('pembayaran') || lower.includes('tagihan') || lower.includes('isolir')) {
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
  const statusIndikatorText = isLoss ? 'lampu indikator merah' : 'tidak ada indikator merah';
  const indikatorSentence = `Untuk kendalanya ${statusIndikatorText} Kak`;
  const timeContext = getWitaTimeContext();

  const prompt = `Kamu adalah asisten pelapor gangguan layanan yang berkomunikasi dengan CS ICONNET di Instagram DM.
PENTING: POSISIMU ADALAH PELAPOR (PELANGGAN), BUKAN CUSTOMER SERVICE!
Jangan pernah menawarkan bantuan seperti "Ada yang bisa dibantu?". Kamu yang meminta bantuan penanganan layanan ICONNET!

WAKTU SEKARANG: ${timeContext.timeStr} (Salam penutup yang tepat: "${timeContext.greeting}")

DATA TIKET PELANGGAN (Satu-satunya sumber fakta):
- Nama: ${ticket.name}
- ID Pelanggan: ${ticket.customer_id}
- No Telepon / WA: ${ticket.phone || '-'}
- No Telepon Alternatif / CP Alt: ${ticket.alt_phone || '-'}
- Keluhan: ${ticket.complaint}
- Kondisi Indikator Modem: ${statusIndikatorText.toUpperCase()}

LOGIKA DETEKSI DAN JAWABAN:
1. AKHIR PERCAKAPAN & SIMPULKAN OUTPUT TIKET:
   Periksa apakah pesan CS mengarah pada penyelesaian / penutupan chat / tindakan resolusi:
   a. Jika CS memberikan NOMOR TIKET RESMI (kode alfanumerik 8 karakter, misal R2J9S7MA, IN123456):
      - "ticket_number": isi persis kode 8 karakter tersebut (misal "R2J9S7MA").
   b. Jika CS melakukan PERBAIKAN DARI SISTEM / RESTART / RESET (misal "telah kami bantu lakukan perbaikan melalui sistem kami... mohon menunggu 5-10 menit"):
      - "ticket_number": simpulkan ringkas 3-6 kata (misal: "Perbaikan Sistem (Tunggu 5-10 Menit)").
   c. Jika CS menyatakan TAGIHAN BELUM LUNAS / ISOLIR:
      - "ticket_number": "Belum Bayar / Tagihan Tertunggak".
   d. Jika CS menyatakan GANGGUAN MASSAL:
      - "ticket_number": "Gangguan Massal di Area".
   e. Jika CS menutup percakapan ("chat akan kami akhiri", "tidak ada jawaban", atau menanyakan "ada lagi yang bisa dibantu?"):
      - "ticket_number": simpulkan tindakan CS secara ringkas dan padat.
   
   Jika terdeteksi salah satu kondisi penyelesaian / penutupan di atas:
   - Wajib set "is_closing": true.
   - Field "ticket_number": isi dengan nomor tiket atau kesimpulan tindakan CS di atas.
   - Field "text": susun teks balasan penutup yang sopan dan natural, ucapkan terima kasih banyak atas bantuannya dan tutup dengan "${timeContext.greeting}!" (misal: "Baik Kak, terima kasih banyak atas bantuannya. ${timeContext.greeting}!").

2. SAPAAN / PEMBUKA DARI CS (Chat Baru Dimulai):
   - Jika CS baru menyapa atau memperkenalkan diri (misal "siap melayani...", "dengan [nama agen] yang akan membantu", "Selamat pagi/siang Kak", dsb.):
     DILARANG KERAS MENGAKHIRI CHAT ATAU MENGUCAPKAN SALAM PENUTUP!
     Jawab bahwa pelanggan sedang menunggu penanganan: "Baik Kak, mohon bantuannya untuk perbaikan kendala internet kami. Terima kasih."
     Wajib set "is_closing": false, dan "ticket_number": null.

3. PERTANYAAN KENDALA DARI CS (Chat belum berakhir):
   - Jika CS meminta foto modem/SN: jawab bahwa foto saat ini belum dapat dilampirkan ("Untuk foto saat ini belum dapat kami lampirkan Kak. Mohon bantuannya Kak.").
   - Jika CS meminta nomor WhatsApp / alternatif: ${ticket.alt_phone ? `jawab bahwa nomor WhatsApp aktif di ${ticket.phone || '-'} dan nomor alternatif/CP alt di ${ticket.alt_phone}.` : `jawab bahwa nomor WhatsApp aktif di ${ticket.phone || '-'} (tidak ada nomor alternatif lain).`}
   - Jika CS menanyakan kondisi lampu indikator: jawab "${indikatorSentence}. Mohon bantuannya Kak."
   - Jika CS menanyakan foto DAN nomor telepon sekaligus: jawab ringkas keduanya dalam satu pesan ("${indikatorSentence}, untuk foto saat ini belum dapat kami lampirkan, dan untuk nomor WhatsApp aktif di ${ticket.phone || '-'}${ticket.alt_phone ? ` serta nomor alternatif di ${ticket.alt_phone}` : ' (tidak ada nomor alternatif)'}. Mohon bantuannya Kak.").
   - Wajib set "is_closing": false, dan "ticket_number": null.

PENTING: DILARANG KERAS MENGIRIM SALAM PENUTUP ATAU SET "is_closing": true KECUALI CS SUDAH MEMBERIKAN NOMOR TIKET RESMI ATAU TINDAKAN PENYELESAIAN JELAS!

KELUARAN HANYA JSON VALID TANPA MARKDOWN:
{
  "action": "reply",
  "text": "...",
  "ticket_number": "...",
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
    return parsed;
  } catch (err) {
    console.error('[AI Error]:', err.message);
    return {
      action: 'reply',
      text: `${indikatorSentence}, untuk foto saat ini belum dapat kami lampirkan, dan untuk nomor WhatsApp aktif di ${ticket.phone || '-'} (tidak ada nomor alternatif). Mohon bantuannya Kak.`,
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

// Buka Thread DM @iconnet.here
async function openDirectThread(page) {
  await page.goto(DIRECT_THREAD_URL, { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise((r) => setTimeout(r, 2000));

  if (page.url().includes('/accounts/login')) {
    throw new Error(
      'Sesi login Instagram belum tersimpan. Silakan jalankan "login_instagram.bat" terlebih dahulu.'
    );
  }

  try {
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && (text.includes('Not Now') || text.includes('Lain Kali') || text.includes('Batal'))) {
        await btn.click();
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  } catch {}

  // Scroll ke paling bawah
  await page.evaluate(() => {
    const allDivs = Array.from(document.querySelectorAll('div'));
    for (const d of allDivs) {
      if (d.scrollHeight > d.clientHeight && d.clientHeight > 200) {
        d.scrollTop = d.scrollHeight;
      }
    }
  });
  await new Promise((r) => setTimeout(r, 1000));
}

// Eksekusi Kirim Tiket Baru ke Instagram
async function dispatchTicket(ticket) {
  console.log(`\n🚀 [KIRIM TIKET] Memulai pengiriman: "${ticket.name}" (ID: ${ticket.customer_id})...`);
  const messageText = buildFirstMessage(ticket);
  let browser = null;

  try {
    browser = await launchChrome(true);
    const page = (await browser.pages())[0] || (await browser.newPage());
    await openDirectThread(page);

    const messageInputSelector =
      'div[role="textbox"][contenteditable="true"], div[aria-label="Message"], div[aria-label="Pesan"]';
    const messageBox = await page.waitForSelector(messageInputSelector, { timeout: 15000 });

    if (!messageBox) {
      throw new Error('Kotak ketik pesan Instagram DM tidak ditemukan.');
    }

    await messageBox.click();
    await new Promise((r) => setTimeout(r, 500));

    console.log('   Mengetik teks keluhan...');
    for (const char of messageText) {
      if (char === '\n') {
        await page.keyboard.down('Shift');
        await page.keyboard.press('Enter');
        await page.keyboard.up('Shift');
      } else {
        await page.keyboard.sendCharacter(char);
      }
      const delay = Math.floor(Math.random() * (60 - 25 + 1)) + 25;
      await new Promise((r) => setTimeout(r, delay));
    }

    await new Promise((r) => setTimeout(r, 600));
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 3000));
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
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Cek Pesan Masuk, Ekstrak Nomor Tiket, & Jalankan AI Auto-Reply
async function syncActiveChat(activeTicket) {
  let browser = null;
  try {
    browser = await launchChrome(true);
    const page = (await browser.pages())[0] || (await browser.newPage());
    await openDirectThread(page);

    const messages = await page.evaluate(() => {
      // Abaikan sidebar navigasi, panel rincian/info di sebelah kanan, dan dialog
      const isInsideIgnoredContainer = (el) => {
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
          // Abaikan kartu kontak WhatsApp / link WA yang dibuat otomatis oleh Instagram
          if (
            ariaLabel?.includes('WhatsApp') ||
            p.querySelector('a[href*="whatsapp.com"], a[href*="wa.me"]')
          ) {
            return true;
          }
          p = p.parentElement;
        }
        return false;
      };

      const nodes = Array.from(document.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
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
      ]);

      return nodes
        .filter((n) => {
          if (isInsideIgnoredContainer(n)) return false;
          const text = n.innerText?.trim();
          if (!text) return false;
          const lower = text.toLowerCase();
          if (ignored.has(text) || ignored.has(lower)) return false;
          if (lower === 'seen' || lower.startsWith('seen ')) return false;
          if (lower === 'sent' || lower.startsWith('sent ')) return false;
          if (lower === 'delivered' || lower.startsWith('delivered ')) return false;
          if (lower === 'active now' || lower.startsWith('active ')) return false;
          return true;
        })
        .map((n) => n.innerText.trim());
    });

    if (messages.length === 0) return;

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
    ]);

    // Cari posisi kemunculan pesan pembuka untuk tiket aktif saat ini di thread chat Instagram
    let openingMsgIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const text = messages[i];
      if (text.includes(activeTicket.customer_id)) {
        openingMsgIndex = i;
        break;
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
    const outBodies = new Set((outMsgs || []).map((o) => o.body?.trim()));

    // Kumpulkan seluruh bubble pesan CS yang masuk SETELAH pesan pembuka tiket ini
    const csBubbles = [];
    const startIndex = openingMsgIndex === 0 && !messages[0]?.includes(activeTicket.customer_id) ? 0 : openingMsgIndex + 1;
    for (let i = startIndex; i < messages.length; i++) {
      const m = messages[i]?.trim();
      if (!m) continue;
      if (/^\d+$/.test(m)) continue;
      if (/^\d+[smhdwy]$/i.test(m)) continue;
      if (/^\d{1,2}[:.]\d{2}$/.test(m)) continue;
      if (ignoredChatKeywords.has(m)) continue;
      if (outBodies.has(m)) continue;
      if (m.includes('ID Pelanggan') || m.includes('Selamat Pagi/Siang Kak, izin melaporkan')) continue;
      if (m.includes(activeTicket.customer_id)) continue;
      if (activeTicket.pln_id && m.includes(activeTicket.pln_id)) continue;
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
        lowerM.includes('phone number') ||
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

    // 2.1 JIKA TIKET INI STATUSNYA 'needs_admin' NAMUN SUDAH MENDAPATKAN NOMOR TIKET RESMI CS
    const isActualTicketFound =
      (directOutcome && directOutcome.type === 'ticket') ||
      (activeTicket.ticket_number && /^[A-Z0-9]{8}$/.test(activeTicket.ticket_number));

    if (activeTicket.status === 'needs_admin' && isActualTicketFound) {
      const confirmedNumber = directOutcome?.value || activeTicket.ticket_number;
      console.log(`\n🎉 [TIKET RESMI DIDAPATKAN] Tiket "${activeTicket.name}" sudah mendapatkan nomor tiket ${confirmedNumber}. Menyelesaikan status tiket...`);
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
          const messageInputSelector =
            'div[role="textbox"][contenteditable="true"], div[aria-label="Message"], div[aria-label="Pesan"]';
          const messageBox = await page.waitForSelector(messageInputSelector, { timeout: 10000 });

          if (messageBox) {
            await messageBox.click();
            await new Promise((r) => setTimeout(r, 400));

            for (const char of aiReply.text) {
              if (char === '\n') {
                await page.keyboard.down('Shift');
                await page.keyboard.press('Enter');
                await page.keyboard.up('Shift');
              } else {
                await page.keyboard.sendCharacter(char);
              }
              const delay = Math.floor(Math.random() * (50 - 20 + 1)) + 20;
              await new Promise((r) => setTimeout(r, delay));
            }

            await new Promise((r) => setTimeout(r, 600));
            await page.keyboard.press('Enter');
            await new Promise((r) => setTimeout(r, 2500));

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
    }
  } catch (err) {
    console.error('   ⚠️ Error sync chat:', err.message);
  } finally {
    if (browser) {
      await browser.close();
    }
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

// Loop Utama Bot
async function startBotLoop() {
  console.log('=======================================================');
  console.log('   ICONNET AUTO-TICKET BOT RUNNER (LOCAL PUPPETEER)   ');
  console.log('=======================================================');
  console.log(`[INFO] Supabase URL: ${supabaseUrl}`);
  console.log(`[INFO] Profil Chrome: ${getProfileDir()}`);
  console.log('[INFO] Bot siap memantau antrean & balasan AI...\n');

  await ensureAuthenticated();

  let isChecking = false;

  const runCycle = async () => {
    if (isChecking) return;
    isChecking = true;

    try {
      const isAuthValid = await checkAndRefreshSession();
      if (!isAuthValid) {
        process.stdout.write(
          `\r[${new Date().toLocaleTimeString()}] ⚠️ [SESI EXPIRED] Sesi login Supabase habis. Tutup dan buka kembali jalankan_bot.bat untuk login! `
        );
        return;
      }

      // 1. Cek apakah ada tiket aktif (in_conversation / needs_admin)
      const { data: activeTicket } = await supabase
        .from('tickets')
        .select('*')
        .in('status', ['in_conversation', 'needs_admin'])
        .maybeSingle();

      if (activeTicket) {
        process.stdout.write(
          `\r[${new Date().toLocaleTimeString()}] ⏳ Tiket aktif: "${activeTicket.name}" | Memeriksa chat... `
        );
        await syncActiveChat(activeTicket);
      } else {
        // 2. Jika tidak ada tiket aktif, periksa apakah ada antrean
        const { data: queuedTickets } = await supabase
          .from('tickets')
          .select('*')
          .eq('status', 'queued')
          .order('queue_order', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(1);

        if (queuedTickets && queuedTickets.length > 0) {
          const nextTicket = queuedTickets[0];
          await dispatchTicket(nextTicket);
        } else {
          process.stdout.write(
            `\r[${new Date().toLocaleTimeString()}] 💤 Tidak ada antrean tiket aktif. Menunggu tiket baru... `
          );
        }
      }
    } catch (err) {
      console.error('\n⚠️ Error di loop utama:', err.message);
    } finally {
      isChecking = false;
    }
  };

  await runCycle();
  setInterval(runCycle, 12000);
}

startBotLoop().catch((err) => {
  console.error('Fatal bot error:', err);
  process.exit(1);
});
