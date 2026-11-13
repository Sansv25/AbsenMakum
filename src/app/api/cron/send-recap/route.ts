import { NextResponse } from 'next/server';
import { getEmailRecapSettings, sendRecapEmailNow } from '@/lib/data/email-recap';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forceType = searchParams.get('force') as 'mingguan' | 'bulanan' | null;

    // Proteksi Cron Secret (opsional di env Vercel)
    const authHeader = req.headers.get('authorization');
    const secret = searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && secret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized cron request.' }, { status: 401 });
    }

    const settings = await getEmailRecapSettings();

    // Jika pengiriman dinonaktifkan dan bukan force
    if (!settings.isActive && !forceType) {
      return NextResponse.json({ message: 'Email recap is disabled in settings.' });
    }

    if (settings.recipients.length === 0) {
      return NextResponse.json({ message: 'No recipients configured.' });
    }

    // Waktu WITA (UTC+8)
    const now = new Date();
    const nowUtc = now.getTime() + now.getTimezoneOffset() * 60000;
    const wita = new Date(nowUtc + 8 * 3600000);
    const dayOfWeek = wita.getDay() === 0 ? 7 : wita.getDay(); // 1 = Senin, 7 = Minggu
    const dayOfMonth = wita.getDate();

    let triggerWeekly = false;
    let triggerMonthly = false;

    if (forceType === 'mingguan') {
      triggerWeekly = true;
    } else if (forceType === 'bulanan') {
      triggerMonthly = true;
    } else {
      // Cek jadwal mingguan
      if (
        (settings.frequency === 'mingguan' || settings.frequency === 'keduanya') &&
        dayOfWeek === settings.sendDayWeekly
      ) {
        triggerWeekly = true;
      }

      // Cek jadwal bulanan (setiap tanggal 1)
      if (
        (settings.frequency === 'bulanan' || settings.frequency === 'keduanya') &&
        dayOfMonth === 1
      ) {
        triggerMonthly = true;
      }
    }

    const results = [];

    if (triggerWeekly) {
      const res = await sendRecapEmailNow('mingguan');
      results.push({ type: 'mingguan', ...res });
    }

    if (triggerMonthly) {
      const res = await sendRecapEmailNow('bulanan');
      results.push({ type: 'bulanan', ...res });
    }

    if (!triggerWeekly && !triggerMonthly) {
      return NextResponse.json({
        message: 'No recap scheduled for today.',
        dayOfWeek,
        dayOfMonth,
        frequency: settings.frequency,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Cron execution failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

