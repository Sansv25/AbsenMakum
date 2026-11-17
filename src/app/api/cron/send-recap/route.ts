import { NextResponse } from 'next/server';
import { getEmailRecapSettings, sendRecapEmailNow, sendDailyRecapEmailNow } from '@/lib/data/email-recap';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forceType = searchParams.get('force') as 'mingguan' | 'bulanan' | 'harian' | null;

    // Proteksi Cron Secret (opsional di env Vercel)
    const authHeader = req.headers.get('authorization');
    const secret = searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && secret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized cron request.' }, { status: 401 });
    }

    const settings = await getEmailRecapSettings();

    // Waktu WITA (UTC+8)
    const now = new Date();
    const nowUtc = now.getTime() + now.getTimezoneOffset() * 60000;
    const wita = new Date(nowUtc + 8 * 3600000);
    const dayOfWeek = wita.getDay() === 0 ? 7 : wita.getDay(); // 1 = Senin, 7 = Minggu
    const dayOfMonth = wita.getDate();
    const currentHour = wita.getHours();

    let triggerWeekly = false;
    let triggerMonthly = false;
    let triggerDaily = false;

    if (forceType === 'harian') {
      triggerDaily = true;
    } else if (forceType === 'mingguan') {
      triggerWeekly = true;
    } else if (forceType === 'bulanan') {
      triggerMonthly = true;
    } else {
      // 1. Cek Rekapan Harian (Jika jam >= jam kirim yang disetting dan aktif)
      if (settings.dailyIsActive) {
        const [targetHour] = (settings.dailySendTime || '18:00').split(':').map(Number);
        if (currentHour === targetHour) {
          triggerDaily = true;
        }
      }

      // 2. Cek jadwal mingguan
      if (
        settings.isActive &&
        (settings.frequency === 'mingguan' || settings.frequency === 'keduanya') &&
        dayOfWeek === settings.sendDayWeekly
      ) {
        triggerWeekly = true;
      }

      // 3. Cek jadwal bulanan (setiap tanggal 1)
      if (
        settings.isActive &&
        (settings.frequency === 'bulanan' || settings.frequency === 'keduanya') &&
        dayOfMonth === 1
      ) {
        triggerMonthly = true;
      }
    }

    const results = [];

    if (triggerDaily) {
      const res = await sendDailyRecapEmailNow();
      results.push({ type: 'harian', ...res });
    }

    if (triggerWeekly) {
      const res = await sendRecapEmailNow('mingguan');
      results.push({ type: 'mingguan', ...res });
    }

    if (triggerMonthly) {
      const res = await sendRecapEmailNow('bulanan');
      results.push({ type: 'bulanan', ...res });
    }

    if (!triggerDaily && !triggerWeekly && !triggerMonthly) {
      return NextResponse.json({
        message: 'No recap scheduled for right now.',
        dayOfWeek,
        dayOfMonth,
        currentHour,
        settings: {
          dailyIsActive: settings.dailyIsActive,
          dailySendTime: settings.dailySendTime,
          piketIsActive: settings.isActive,
          frequency: settings.frequency,
        },
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Cron execution failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

