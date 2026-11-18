import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const nowMs = Date.now();
    const thresholdIso = new Date(nowMs - 45000).toISOString();

    // 1. Utamakan tabel multi-bot public.bot_workers
    const { data: workerRows, error: workersErr } = await supabase
      .from('bot_workers')
      .select('bot_id, ig_user_id, ig_username, user_email, hostname, active_ticket_id, status, last_heartbeat')
      .eq('status', 'online')
      .gte('last_heartbeat', thresholdIso)
      .order('last_heartbeat', { ascending: false });

    if (!workersErr && Array.isArray(workerRows)) {
      const activeWorkers = workerRows.map((w) => {
        const diffMs = nowMs - new Date(w.last_heartbeat).getTime();
        return {
          ...w,
          seconds_ago: Math.max(0, Math.floor(diffMs / 1000)),
        };
      });

      if (activeWorkers.length > 0) {
        return NextResponse.json({
          online: true,
          online_count: activeWorkers.length,
          workers: activeWorkers,
          user_email: activeWorkers[0].user_email,
          hostname: activeWorkers[0].hostname,
          last_seen: activeWorkers[0].last_heartbeat,
          seconds_ago: activeWorkers[0].seconds_ago,
        });
      }
    }

    // 2. Fallback ke heartbeat lama jika tabel bot_workers belum dimigrasi atau masih kosong
    const { data } = await supabase
      .from('ticketing_settings')
      .select('value, updated_at')
      .eq('key', 'bot_runner_heartbeat')
      .maybeSingle();

    if (!data?.value) {
      return NextResponse.json({
        online: false,
        online_count: 0,
        workers: [],
        message: 'Belum ada bot piket yang online',
      });
    }

    const hb = data.value as {
      online?: boolean;
      user_email?: string;
      hostname?: string;
      timestamp?: string;
      ig_username?: string;
    };
    const lastTimestamp = new Date(hb.timestamp || data.updated_at).getTime();
    const diffMs = nowMs - lastTimestamp;
    const isOnline = Boolean(hb.online) && diffMs < 45000;

    return NextResponse.json({
      online: isOnline,
      online_count: isOnline ? 1 : 0,
      workers: isOnline
        ? [
            {
              bot_id: 'legacy',
              ig_user_id: '',
              ig_username: hb.ig_username || null,
              user_email: hb.user_email || 'Petugas Piket',
              hostname: hb.hostname || 'PC Lokal',
              active_ticket_id: null,
              status: 'online',
              last_heartbeat: hb.timestamp || data.updated_at,
              seconds_ago: Math.max(0, Math.floor(diffMs / 1000)),
            },
          ]
        : [],
      user_email: hb.user_email || null,
      hostname: hb.hostname || null,
      last_seen: hb.timestamp || data.updated_at,
      seconds_ago: Math.max(0, Math.floor(diffMs / 1000)),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching bot status';
    return NextResponse.json({ error: message, online: false, online_count: 0, workers: [] }, { status: 500 });
  }
}
