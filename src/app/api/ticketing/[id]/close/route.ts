import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await context.params;

    if (!ticketId) {
      return NextResponse.json({ error: 'ID tiket wajib disertakan.' }, { status: 400 });
    }

    const supabase = await createClient();

    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        status: 'closed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Tiket berhasil diselesaikan / ditutup.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menutup tiket';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
