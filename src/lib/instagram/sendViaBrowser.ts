import puppeteer, { Browser, Page } from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { createClient } from '@/lib/supabase/server';
import { buildFirstMessage } from '@/lib/ticketing/buildFirstMessage';
import type { Ticket, TicketImage } from '@/lib/ticketing/types';
import { withBrowserLock } from './browserLock';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function getProfileDir(): string {
  const existingDir = 'D:\\otomasi\\Auto tiket\\.chrome_instagram_profile';
  if (fs.existsSync(existingDir)) {
    return existingDir;
  }
  return path.resolve(process.cwd(), '..', '.chrome_instagram_profile');
}

const DIRECT_THREAD_URL = 'https://www.instagram.com/direct/t/17848314279030884/';

export async function sendFirstMessageViaBrowser(
  ticketId: string
): Promise<{ success: boolean; message: string }> {
  return withBrowserLock(`Kirim Pesan Tiket (${ticketId})`, async () => {
    const supabase = await createClient();

    // 1. Fetch ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*, ticket_images(*)')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error('Tiket tidak ditemukan di database.');
    }

    // 2. Build message text
    const messageText = buildFirstMessage(ticket as Ticket);

    const userDataDir = getProfileDir();

    // 3. Launch Chrome with persistent profile in background
    let browser: Browser | null = null;
    try {
      browser = await puppeteer.launch({
        executablePath: chromePath,
        userDataDir: userDataDir,
        headless: true, // background operation
        defaultViewport: { width: 1280, height: 800 },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-notifications',
        ],
      });

      const page: Page = (await browser.pages())[0] || (await browser.newPage());

      // 4. Navigate directly to @iconnet.here thread
      await page.goto(DIRECT_THREAD_URL, {
        waitUntil: 'networkidle2',
        timeout: 35000,
      });

      // 5. Verify not redirected to login
      const currentUrl = page.url();
      if (currentUrl.includes('/accounts/login')) {
        throw new Error(
          'Sesi login Instagram belum tersimpan. Silakan jalankan "login_instagram.bat" untuk login ke akun Instagram Anda.'
        );
      }

      // 6. Dismiss any modals (Not Now / Lain Kali / Batal)
      try {
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const text = await page.evaluate((el) => el.textContent, btn);
          if (text && (text.includes('Not Now') || text.includes('Lain Kali') || text.includes('Batal'))) {
            await btn.click();
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      } catch {}

      // Fallback: If not on thread URL, click "Iconnet Here" from inbox
      if (!page.url().includes('/direct/t/')) {
        const clicked = await page.evaluate(() => {
          const spans = Array.from(document.querySelectorAll('span'));
          for (const span of spans) {
            if (span.innerText && span.innerText.trim() === 'Iconnet Here') {
              let cur: HTMLElement | null = span;
              for (let i = 0; i < 5; i++) {
                if (cur?.parentElement) cur = cur.parentElement;
              }
              cur?.click();
              return true;
            }
          }
          return false;
        });
        if (clicked) {
          await new Promise((r) => setTimeout(r, 2500));
        }
      }

      // 7. Find message input box
      const messageInputSelector =
        'div[role="textbox"][contenteditable="true"], div[aria-label="Message"], div[aria-label="Pesan"]';
      const messageBox = await page.waitForSelector(messageInputSelector, { timeout: 15000 });

      if (!messageBox) {
        throw new Error('Tidak dapat menemukan kotak ketik pesan Instagram DM @iconnet.here.');
      }

      await messageBox.click();
      await new Promise((r) => setTimeout(r, 500));

      // 8. Human-like typing simulation
      for (const char of messageText) {
        if (char === '\n') {
          await page.keyboard.down('Shift');
          await page.keyboard.press('Enter');
          await page.keyboard.up('Shift');
        } else {
          await page.keyboard.sendCharacter(char);
        }
        const delay = Math.floor(Math.random() * (75 - 30 + 1)) + 30;
        await new Promise((r) => setTimeout(r, delay));
      }

      await new Promise((r) => setTimeout(r, 800));

      // 9. Press Enter to send text message
      await page.keyboard.press('Enter');
      await new Promise((r) => setTimeout(r, 3000));

      // 10. Handle optional photo attachment if available
      const images: TicketImage[] = (ticket.ticket_images as TicketImage[]) || [];
      if (images.length > 0) {
        const tempPaths: string[] = [];
        try {
          for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('ticket-images')
              .download(img.storage_path);

            if (!downloadError && fileData) {
              const ext = img.storage_path.endsWith('.png') ? '.png' : '.jpg';
              const tempPath = path.resolve(process.cwd(), `temp_upload_${Date.now()}_${i}${ext}`);
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
                  const text = ((b as HTMLElement).innerText || b.getAttribute('aria-label') || '').trim();
                  if (text === 'Send' || text === 'Kirim') {
                    (b as HTMLElement).click();
                    return true;
                  }
                }
                return false;
              });

              if (!sendClicked) {
                await page.keyboard.press('Enter');
              }
              await new Promise((r) => setTimeout(r, 4500));
            }
          }
        } catch (imgErr) {
          console.warn('Gagal melampirkan foto secara otomatis:', imgErr);
        } finally {
          for (const p of tempPaths) {
            try {
              fs.unlinkSync(p);
            } catch {}
          }
        }
      }

      // 11. Update ticket status in Supabase
      const now = new Date().toISOString();
      await supabase
        .from('tickets')
        .update({
          status: 'in_conversation',
          started_at: now,
          updated_at: now,
        })
        .eq('id', ticketId);

      // 12. Insert message into ticket_messages table
      await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        direction: 'out',
        sender: 'admin',
        body: messageText,
      });

      return {
        success: true,
        message: 'Pesan pertama berhasil diketik dan dikirim otomatis ke @iconnet.here!',
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });
}
