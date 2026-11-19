import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
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

    const body = await request.json().catch(() => ({}));
    const clearMessages = body?.clearMessages !== false; // default true untuk reset chat

    const now = new Date().toISOString();

    // 1. Reset status tiket kembali ke 'queued'
    const { error: ticketError } = await supabase
      .from('tickets')
      .update({
        status: 'queued',
        runner_id: null,
        runner_ig_id: null,
        runner_label: null,
        ticket_number: null,
        ticket_issued_at: null,
        started_at: null,
        ai_turns: 0,
        pending_ai_reply: null,
        updated_at: now,
      })
      .eq('id', id);

    if (ticketError) {
      return NextResponse.json({ error: ticketError.message }, { status: 500 });
    }

    // 2. Bersihkan riwayat chat tiket jika clearMessages = true agar bot mengirim ulang dari pesan pembuka
    if (clearMessages) {
      await supabase.from('ticket_messages').delete().eq('ticket_id', id);
    }

    // 3. Lepas dari bot_workers jika sebelumnya sedang dipegang oleh bot
    await supabase
      .from('bot_workers')
      .update({ active_ticket_id: null })
      .eq('active_ticket_id', id);

    return NextResponse.json({
      success: true,
      message: 'Tiket berhasil dimasukkan kembali ke antrean dan siap dikirim ulang oleh bot.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal mengantrekan ulang tiket';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
