import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildFirstMessage } from '@/lib/ticketing/buildFirstMessage';

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

    // 1. Cek apakah ada tiket lain yang sedang aktif
    const { data: activeTicket } = await supabase
      .from('tickets')
      .select('id, name, customer_id')
      .in('status', ['in_conversation', 'needs_admin'])
      .neq('id', ticketId)
      .maybeSingle();

    if (activeTicket) {
      return NextResponse.json(
        {
          error: `Tidak dapat memulai tiket ini. Masih ada tiket lain yang aktif: "${activeTicket.name}" (ID: ${activeTicket.customer_id}). Harap selesaikan tiket tersebut terlebih dahulu.`,
        },
        { status: 409 }
      );
    }

    // 2. Ambil data tiket saat ini
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Tiket tidak ditemukan.' }, { status: 404 });
    }

    // 3. Update status menjadi in_conversation
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        status: 'in_conversation',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // 4. Catat pesan pertama ke ticket_messages jika belum ada
    const firstMsgText = buildFirstMessage(ticket);
    const { data: existingMsgs } = await supabase
      .from('ticket_messages')
      .select('id')
      .eq('ticket_id', ticketId)
      .limit(1);

    if (!existingMsgs || existingMsgs.length === 0) {
      await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        direction: 'out',
        sender: 'admin',
        body: firstMsgText,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Tiket berhasil dimulai! Status kini Sedang Berjalan.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memulai tiket';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
