import { NextRequest, NextResponse } from 'next/server';
import { finalizeGroupAttendanceSession } from '@/lib/data/group-attendance';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id } = body;

    if (!session_id || typeof session_id !== 'string') {
      return NextResponse.json({ error: 'session_id wajib disertakan.' }, { status: 400 });
    }

    const result = await finalizeGroupAttendanceSession(session_id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Gagal memfinalisasi sesi' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Absen bersama berhasil difinalisasi dan diterbitkan ke feed!',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error finalizing group attendance';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
