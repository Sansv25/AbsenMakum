import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();

    // 1. Cari tiket aktif
    const { data: activeTicket } = await supabase
      .from('tickets')
      .select('*')
      .in('status', ['in_conversation', 'needs_admin'])
      .maybeSingle();

    if (!activeTicket) {
      return NextResponse.json({
        message: 'Tidak ada tiket aktif yang sedang menunggu balasan.',
      });
    }

    // 2. Periksa apakah pesan masuk terbaru mengandung nomor tiket
    const { data: incomingMsgs } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', activeTicket.id)
      .eq('direction', 'in')
      .order('created_at', { ascending: false })
      .limit(5);

    const ticketRegex = /(?:nomor\s*tiket|no\s*tiket|id\s*tiket|tiket\s*keluhan)[\s:]*([A-Z0-9]{8})\b/i;
    let foundNumber: string | null = null;

    if (incomingMsgs) {
      for (const msg of incomingMsgs) {
        if (!msg.body) continue;
        const match = msg.body.match(ticketRegex);
        if (match && match[1]) {
          foundNumber = match[1].toUpperCase();
          break;
        }
      }
    }

    // 3. Jika nomor tiket ditemukan dan belum tercatat di tiket
    if (foundNumber && (!activeTicket.ticket_number || activeTicket.ticket_number !== foundNumber)) {
      const updateData: Record<string, unknown> = {
        ticket_number: foundNumber,
        updated_at: new Date().toISOString(),
      };

      // Jika tiket dikelola manual, langsung tandai tiket terbit.
      // Jika mode AI, biarkan bot runner mengirim salam penutup sebelum mengubah status ke ticket_issued.
      if (activeTicket.mode !== 'ai') {
        updateData.status = 'ticket_issued';
        updateData.ticket_issued_at = new Date().toISOString();
      }

      await supabase
        .from('tickets')
        .update(updateData)
        .eq('id', activeTicket.id);

      return NextResponse.json({
        success: true,
        ticket_number: foundNumber,
        message: `Nomor tiket ${foundNumber} berhasil dicatat!`,
      });
    }

    return NextResponse.json({
      success: true,
      ticket_number: activeTicket.ticket_number || null,
      message: 'Pemeriksaan chat selesai. Menunggu balasan dari ICONNET.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error syncing chat';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
