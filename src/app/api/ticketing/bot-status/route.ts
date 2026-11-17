import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('ticketing_settings')
      .select('value, updated_at')
      .eq('key', 'bot_runner_heartbeat')
      .maybeSingle();

    if (!data?.value) {
      return NextResponse.json({
        online: false,
        message: 'Bot belum pernah dijalankan',
      });
    }

    const hb = data.value;
    const lastTimestamp = new Date(hb.timestamp || data.updated_at).getTime();
    const diffMs = Date.now() - lastTimestamp;
    // Jika heartbeat terkirim dalam 30 detik terakhir dan status online === true
    const isOnline = Boolean(hb.online) && diffMs < 30000;

    return NextResponse.json({
      online: isOnline,
      user_email: hb.user_email || null,
      hostname: hb.hostname || null,
      last_seen: hb.timestamp || data.updated_at,
      seconds_ago: Math.max(0, Math.floor(diffMs / 1000)),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching bot status';
    return NextResponse.json({ error: message, online: false }, { status: 500 });
  }
}
