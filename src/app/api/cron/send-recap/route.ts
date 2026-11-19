import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createDirectClient, type SupabaseClient } from '@supabase/supabase-js';
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

    // Ekstraksi Bearer Token atau ?token= (jika dipanggil oleh Bot Runner / Admin)
    const tokenParam = searchParams.get('token');
    let bearerToken: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    } else if (tokenParam) {
      bearerToken = tokenParam.trim();
    }

    // Jika bearerToken sama dengan cronSecret, jangan gunakan sebagai token Supabase
    if (bearerToken && cronSecret && bearerToken === cronSecret) {
      bearerToken = null;
    }

    // Inisialisasi Supabase client:
    // 1. SUPABASE_SERVICE_ROLE_KEY jika diset di server/Vercel (bypass RLS penuh)
    // 2. bearerToken jika pemanggil menyertakan token autentikasi (misal Bot Runner akun Master)
    // 3. Fallback ke createServerClient (cookies)
    let supabase: SupabaseClient;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      supabase = createDirectClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    } else if (bearerToken) {
      supabase = createDirectClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${bearerToken}` } },
        }
      );
    } else {
      supabase = await createServerClient();
    }

    const settings = await getEmailRecapSettings(supabase);

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
      // 1. Cek Rekapan Harian Anak Magang
      // Cek apakah rekapan harian hari ini sudah pernah berhasil dikirim sebelumnya (anti-dobel kirim)
      const isAlreadySentToday = Boolean(
        settings.dailyLastSentAt &&
          new Date(settings.dailyLastSentAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' }) === todayWitaStr
      );

      if (settings.dailyIsActive && !isAlreadySentToday) {
        const [targetHour, targetMin] = (settings.dailySendTime || '18:00').split(':').map(Number);
        const targetMinutes = targetHour * 60 + (targetMin || 0);
        const currentMinutes = currentHour * 60 + wita.getMinutes();

        // Kirim jika waktu saat ini sudah mencapai atau melewati jam target (misal >= 18:00 WITA)
        if (currentMinutes >= targetMinutes) {
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
      const res = await sendDailyRecapEmailNow(todayWitaStr, undefined, forceType === 'harian', true, supabase);
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
      const res = await sendRecapEmailNow('mingguan', undefined, supabase);
      results.push({ type: 'mingguan', ...res });
    }

    if (triggerMonthly) {
      const res = await sendRecapEmailNow('bulanan', undefined, supabase);
      results.push({ type: 'bulanan', ...res });
    }

    // Pembersihan otomatis pesan obrolan (feed_type = 'chat') yang lebih lama dari 168 jam (7 hari)
    const cleanupResult = await cleanupOldChatMessages(168, supabase);
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
