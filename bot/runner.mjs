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
  parts.push(`Nama Pelanggan: ${ticket.name || '-'}`);
  if (ticket.address) parts.push(`Alamat: ${ticket.address}`);
  if (ticket.email) parts.push(`Email: ${ticket.email}`);
  if (ticket.regional) parts.push(`Regional: ${ticket.regional}`);
  if (ticket.office) parts.push(`Kantor Perwakilan: ${ticket.office}`);
  parts.push('');
  parts.push(`Keluhan: ${ticket.complaint || '-'}`);
  parts.push('');
  parts.push('Mohon bantuannya untuk diterbitkan tiket gangguan. Terima kasih.');
  return parts.join('\n');
}

// Ekstraksi Nomor Tiket & Hasil Resolusi
function extractTicketOutcome(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  // 1. Cek nomor tiket resmi 8 karakter alfanumerik (wajib ada angka)
  const ticketRegex = /(?:id\s*tiket|nomor\s*tiket|no\.?\s*tiket|tiket|nomor\s*pelaporan|no\.?\s*pelaporan)\s*[:#]?\s*([A-Z0-9]{8})\b/i;
  const match = text.match(ticketRegex);
  if (match && match[1] && /\d/.test(match[1])) {
    return { type: 'ticket', value: match[1].toUpperCase() };
  }

  // Standalone 8-char kode tiket (mis. IN123456, R2J92BW3)
  const standaloneMatch = text.match(/\b([A-Z][A-Z0-9]{7})\b/);
  if (standaloneMatch && standaloneMatch[1] && /\d/.test(standaloneMatch[1])) {
    return { type: 'ticket', value: standaloneMatch[1].toUpperCase() };
  }

  // 2. Cek tagihan belum bayar / isolir
  if (lower.includes('bayar') || lower.includes('pembayaran') || lower.includes('tagihan') || lower.includes('isolir')) {
    return { type: 'billing', value: 'Belum Bayar / Disuruh Bayar' };
  }

  // 3. Cek restart sistem
  if (lower.includes('restart dari sistem') || lower.includes('dibantu restart') || lower.includes('5 hingga 10 menit')) {
    return { type: 'restart', value: 'Restart Sistem (Tunggu 5-10 mnt)' };
  }

  return null;
}

// Otak AI: Menjawab Pertanyaan CS ICONNET Sesuai Data Tiket
async function generateAIReply(ticket, incomingMessage) {
  const isLoss = (ticket.complaint || '').toLowerCase().includes('loss') || (ticket.complaint || '').toLowerCase().includes('los');
  const statusIndikatorText = isLoss ? 'lampu indikator merah' : 'tidak ada indikator merah';
  const indikatorSentence = `Untuk kendalanya ${statusIndikatorText} Kak`;

  const prompt = `Kamu adalah asisten pelapor layanan pelanggan yang berkomunikasi dengan CS ICONNET lewat Instagram DM.
PENTING: POSISIMU ADALAH PELAPOR (PELANGGAN / PEMOHON LAYANAN), BUKAN CUSTOMER SERVICE!
Jangan pernah menawarkan bantuan seperti "Ada yang bisa dibantu?". Kamu yang meminta bantuan penanganan layanan ICONNET!

DATA TIKET PELANGGAN (Satu-satunya sumber fakta):
- Nama: ${ticket.name}
- ID Pelanggan: ${ticket.customer_id}
- No Telepon / WA: ${ticket.phone || '-'}
- Keluhan: ${ticket.complaint}
- Kondisi Indikator Modem: ${statusIndikatorText.toUpperCase()}

ATURAN PALING PENTING:
1. JAWAB HANYA HAL YANG SPESIFIK DITANYAKAN CS (MAKSIMAL 1-2 KALIMAT PENDEK):
   - Jawab secara singkat, sopan, to-the-point, dan natural seperti manusia.
   - Jika CS meminta foto modem/SN: jawab bahwa foto saat ini belum dapat dilampirkan ("Untuk foto saat ini belum dapat kami lampirkan Kak. Mohon bantuannya Kak.").
   - Jika CS meminta nomor WhatsApp / alternatif: jawab bahwa nomor WhatsApp aktif di ${ticket.phone || '-'} dan tidak ada nomor alternatif ("Untuk nomor WhatsApp aktif sama seperti di data: ${ticket.phone || '-'} Kak, tidak ada nomor alternatif lain. Mohon bantuannya Kak.").
   - Jika CS menanyakan kondisi lampu indikator: jawab "${indikatorSentence}. Mohon bantuannya Kak."
   - Jika CS menanyakan foto DAN nomor telepon sekaligus: jawab ringkas keduanya dalam satu pesan ("${indikatorSentence}, untuk foto saat ini belum dapat kami lampirkan, dan untuk nomor WhatsApp aktif di ${ticket.phone || '-'} (tidak ada nomor alternatif). Mohon bantuannya Kak.").

2. KELUARAN HANYA JSON VALID TANPA MARKDOWN:
{"action":"reply","text":"..."}`;

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
      parsed = { action: 'reply', text: cleaned };
    }
    return parsed;
  } catch (err) {
    console.error('[AI Error]:', err.message);
    return {
      action: 'reply',
      text: `${indikatorSentence}, untuk foto saat ini belum dapat kami lampirkan, dan untuk nomor WhatsApp aktif di ${ticket.phone || '-'} (tidak ada nomor alternatif). Mohon bantuannya Kak.`,
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
      const nav = document.querySelector('nav');
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
      ]);
      return nodes
        .filter((n) => {
          if (nav && nav.contains(n)) return false;
          const text = n.innerText?.trim();
          return text && !ignored.has(text);
        })
        .map((n) => n.innerText.trim());
    });

    if (messages.length === 0) return;

    // 1. Prioritas 1: Cari apakah ada nomor tiket resmi di pesan-pesan terbaru
    let ticketNumFound = null;
    for (let i = messages.length - 1; i >= Math.max(0, messages.length - 15); i--) {
      const text = messages[i];
      const outcome = extractTicketOutcome(text);

      if (outcome && outcome.type === 'ticket') {
        ticketNumFound = outcome.value;
        if (activeTicket.ticket_number !== ticketNumFound) {
          console.log(`\n🎉 [NOMOR TIKET TERBIT] Ditemukan Nomor Tiket Resmi: ${ticketNumFound}!`);

          const now = new Date().toISOString();
          await supabase
            .from('tickets')
            .update({
              ticket_number: ticketNumFound,
              status: 'ticket_issued',
              ticket_issued_at: now,
              updated_at: now,
            })
            .eq('id', activeTicket.id);

          await supabase.from('ticket_messages').insert({
            ticket_id: activeTicket.id,
            direction: 'in',
            sender: 'iconnet',
            body: text,
          });

          console.log(`   ✓ Status tiket ${activeTicket.name} diperbarui ke: TIKET TERBIT\n`);
          return;
        }
      }
    }

    // 2. Prioritas 2: Jika nomor tiket belum keluar, periksa apakah CS mengajukan pertanyaan yang butuh dijawab AI
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
    ]);

    let lastCsMessage = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]?.trim();
      if (!m) continue;
      if (/^\d+$/.test(m)) continue;
      if (/^\d+[smhdwy]$/i.test(m)) continue;
      if (/^\d{1,2}[:.]\d{2}$/.test(m)) continue;
      if (ignoredChatKeywords.has(m)) continue;
      if (m.includes('ID Pelanggan') || m.includes('Selamat Pagi/Siang Kak, izin melaporkan')) continue;
      if (m.includes(activeTicket.customer_id)) continue;
      if (activeTicket.pln_id && m.includes(activeTicket.pln_id)) continue;

      lastCsMessage = m;
      break;
    }

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

        if (isMonitoring) {
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
            console.log(`✅ [AI TERKIRIM] Berhasil membalas ke CS ICONNET!\n`);
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
