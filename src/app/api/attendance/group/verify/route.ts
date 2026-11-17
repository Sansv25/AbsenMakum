import { NextRequest, NextResponse } from 'next/server';
import { joinGroupAttendanceByToken } from '@/lib/data/group-attendance';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token QR wajib disertakan.' }, { status: 400 });
    }

    const result = await joinGroupAttendanceByToken(token.trim());

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message, error: result.error },
        { status: result.error === 'unauthenticated' ? 401 : 400 }
      );
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error verifying group attendance';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
