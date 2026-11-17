import { NextRequest, NextResponse } from 'next/server';
import { getAttendanceFeedMessages, createAttendanceFeedMessage } from '@/lib/data/attendance-feed';
import type { ShiftType } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const work_date = searchParams.get('work_date');
    const shift_type = searchParams.get('shift_type') as ShiftType;

    if (!work_date || !shift_type) {
      return NextResponse.json(
        { error: 'work_date dan shift_type wajib disertakan.' },
        { status: 400 }
      );
    }

    const result = await getAttendanceFeedMessages(work_date, shift_type);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ messages: result.messages });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching feed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { work_date, shift_type, feed_type, message, media_paths, group_session_id } = body;

    if (!work_date || !shift_type || !feed_type) {
      return NextResponse.json(
        { error: 'work_date, shift_type, dan feed_type wajib diisi.' },
        { status: 400 }
      );
    }

    const result = await createAttendanceFeedMessage({
      work_date,
      shift_type,
      feed_type,
      message,
      media_paths,
      group_session_id,
    });

    if (result.error || !result.message) {
      return NextResponse.json({ error: result.error || 'Gagal mengirim pesan' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating feed message';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
