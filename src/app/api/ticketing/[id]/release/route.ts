import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 });
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('tickets')
      .update({
        status: 'queued',
        runner_id: null,
        runner_ig_id: null,
        runner_label: null,
        pending_ai_reply: null,
        updated_at: now,
      })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Tiket dilepas dari bot sebelumnya dan dikembalikan ke antrean.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal melepas tiket';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
