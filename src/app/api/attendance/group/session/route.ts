import { NextRequest, NextResponse } from 'next/server';
import { createGroupAttendanceSession, getGroupSessionStatus } from '@/lib/data/group-attendance';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id wajib disertakan.' }, { status: 400 });
    }

    const result = await getGroupSessionStatus(sessionId);
    if (result.error || !result.session) {
      return NextResponse.json({ error: result.error || 'Sesi tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ session: result.session });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error getting session status';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { work_date, photo_storage_path, note, target_user_ids } = body;

    if (!work_date) {
      return NextResponse.json({ error: 'work_date wajib disertakan.' }, { status: 400 });
    }

    const result = await createGroupAttendanceSession({
      work_date,
      photo_storage_path,
      note,
      target_user_ids: Array.isArray(target_user_ids) ? target_user_ids : undefined,
    });

    if (result.error || !result.session) {
      return NextResponse.json({ error: result.error || 'Gagal membuat sesi' }, { status: 500 });
    }

    return NextResponse.json({ session: result.session });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error creating group session';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
