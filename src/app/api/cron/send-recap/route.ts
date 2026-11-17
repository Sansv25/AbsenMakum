import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEmailRecapSettings, sendRecapEmailNow, sendDailyRecapEmailNow } from '@/lib/data/email-recap';
import { cleanupOldChatMessages } from '@/lib/data/attendance-feed';

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

    const yyyy = wita.getFullYear();
    const mm = String(wita.getMonth() + 1).padStart(2, '0');
    const dd = String(wita.getDate()).padStart(2, '0');
    const todayWitaStr = `${yyyy}-${mm}-${dd}`;

    const supabase = await createClient();

    // Cek apakah hari ini terdaftar di setting hari libur (tabel holidays)
    const { data: holidayData } = await supabase
      .from('holidays')
      .select('id, name')
      .eq('holiday_date', todayWitaStr)
      .maybeSingle();

    const isHoliday = Boolean(holidayData);
    const isWeekend = dayOfWeek === 6 || dayOfWeek === 7;
    const isDayOff = isHoliday || isWeekend;

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
      // JANGAN KIRIM jika hari ini adalah hari libur (dari setting libur) atau akhir pekan
      if (settings.dailyIsActive) {
        const [targetHour] = (settings.dailySendTime || '18:00').split(':').map(Number);
        if (currentHour === targetHour) {
          if (!isDayOff) {
            triggerDaily = true;
          } else {
            console.log(
              `Cron: Lewati pengiriman rekapan harian karena hari ini libur (${holidayData?.name ? `Tanggal Merah: ${holidayData.name}` : 'Akhir Pekan'}).`
            );
          }
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
      const res = await sendDailyRecapEmailNow(todayWitaStr, undefined, forceType === 'harian');
      results.push({ type: 'harian', ...res });
    } else if (settings.dailyIsActive && isDayOff) {
      const [targetHour] = (settings.dailySendTime || '18:00').split(':').map(Number);
      if (currentHour === targetHour) {
        results.push({
          type: 'harian_skipped',
          holidayName: holidayData?.name || (isWeekend ? 'Akhir Pekan' : 'Hari Libur'),
          reason: `Pengiriman rekapan absen harian dilewati karena hari ini adalah hari libur (${holidayData?.name ? `Tanggal Merah: ${holidayData.name}` : 'Akhir Pekan'}).`,
        });
      }
    }

    if (triggerWeekly) {
      const res = await sendRecapEmailNow('mingguan');
      results.push({ type: 'mingguan', ...res });
    }

    if (triggerMonthly) {
      const res = await sendRecapEmailNow('bulanan');
      results.push({ type: 'bulanan', ...res });
    }

    // Pembersihan otomatis pesan obrolan (feed_type = 'chat') yang lebih lama dari 168 jam (7 hari)
    const cleanupResult = await cleanupOldChatMessages(168);
    results.push({ type: 'cleanup_chat_168h', ...cleanupResult });

    if (!triggerDaily && !triggerWeekly && !triggerMonthly) {
      return NextResponse.json({
        message: 'No recap email scheduled for right now. Old chat cleanup completed.',
        dayOfWeek,
        dayOfMonth,
        currentHour,
        todayWitaStr,
        isDayOff,
        holidayName: holidayData?.name || null,
        cleanupResult,
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
