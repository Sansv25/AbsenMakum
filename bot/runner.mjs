/**
 * ICONNET TICKET RUNNER BOT (LOCAL PUPPETEER)
 * Memantau antrean tiket Supabase dan mengeksekusi pengetikan serta sinkronisasi
 * ke DM Instagram @iconnet.here secara otomatis di PC/Laptop lokal.
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

// Baca Env Supabase
function loadEnv() {
  const envPaths = [
    path.resolve(__dirname, '.env'),
    path.resolve(__dirname, '..', 'app', '.env.local'),
    path.resolve(__dirname, '..', '.env.local'),
  ];

  let supabaseUrl = 'https://osaliefiqfydqibwfafl.supabase.co';
  let supabaseAnonKey = '';
  let serviceRoleKey = '';

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
      }
    }
  }

  return { supabaseUrl, supabaseAnonKey, serviceRoleKey };
}

const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = loadEnv();
const activeKey = serviceRoleKey || supabaseAnonKey;

const supabase = createClient(supabaseUrl, activeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Format Pesan Standar Sesuai PRD
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

// Pastikan User Terautentikasi (Jika Belum Pakai Service Role)
async function ensureAuthenticated() {
  if (serviceRoleKey) {
    console.log('[AUTH] Menggunakan SUPABASE_SERVICE_ROLE_KEY.');
    return;
  }

  const sessionFile = path.resolve(__dirname, '.session.json');

  // Coba restore session tersimpan
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

  // Jika belum ada sesi, minta email dan password
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

  // Cek apakah ter-redirect ke login
  if (page.url().includes('/accounts/login')) {
    throw new Error(
      'Sesi login Instagram belum tersimpan. Silakan jalankan "login_instagram.bat" terlebih dahulu.'
    );
  }

  // Tutup popup / modal "Not Now" jika ada
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

  // Scroll percakapan ke paling bawah
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

    // Cari kotak pesan
    const messageInputSelector =
      'div[role="textbox"][contenteditable="true"], div[aria-label="Message"], div[aria-label="Pesan"]';
    const messageBox = await page.waitForSelector(messageInputSelector, { timeout: 15000 });

    if (!messageBox) {
      throw new Error('Kotak ketik pesan Instagram DM tidak ditemukan.');
    }

    await messageBox.click();
    await new Promise((r) => setTimeout(r, 500));

    // Simulasi ketikan manusia
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

    // Update status tiket di Supabase
    const now = new Date().toISOString();
    await supabase
      .from('tickets')
      .update({
        status: 'in_conversation',
        started_at: now,
        updated_at: now,
      })
      .eq('id', ticket.id);

    // Rekam pesan ke tabel ticket_messages
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

// Cek Pesan Masuk & Nomor Tiket
async function syncActiveChat(activeTicket) {
  let browser = null;
  try {
    browser = await launchChrome(true);
    const page = (await browser.pages())[0] || (await browser.newPage());
    await openDirectThread(page);

    // Ambil semua elemen teks chat
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

    // Cari apakah ada nomor tiket di pesan-pesan terakhir
    for (let i = messages.length - 1; i >= Math.max(0, messages.length - 15); i--) {
      const text = messages[i];
      const outcome = extractTicketOutcome(text);

      if (outcome && outcome.type === 'ticket') {
        const ticketNum = outcome.value;
        if (activeTicket.ticket_number !== ticketNum) {
          console.log(`\n🎉 [NOMOR TIKET TERBIT] Ditemukan Nomor Tiket Resmi: ${ticketNum}!`);

          const now = new Date().toISOString();
          await supabase
            .from('tickets')
            .update({
              ticket_number: ticketNum,
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
          break;
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
  console.log('[INFO] Bot siap memantau antrean tiket...\n');

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
        process.stdout.write(`\r[${new Date().toLocaleTimeString()}] ⏳ Tiket aktif: "${activeTicket.name}" | Memeriksa balasan... `);
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
          process.stdout.write(`\r[${new Date().toLocaleTimeString()}] 💤 Tidak ada antrean tiket aktif. Menunggu tiket baru... `);
        }
      }
    } catch (err) {
      console.error('\n⚠️ Error di loop utama:', err.message);
    } finally {
      isChecking = false;
    }
  };

  // Jalankan siklus pertama langsung, lalu ulangi setiap 12 detik
  await runCycle();
  setInterval(runCycle, 12000);
}

startBotLoop().catch((err) => {
  console.error('Fatal bot error:', err);
  process.exit(1);
});
