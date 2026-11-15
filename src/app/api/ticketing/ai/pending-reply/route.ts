import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('ticketing_settings')
      .select('value')
      .eq('key', 'pending_ai_reply')
      .maybeSingle();

    if (data && data.value && typeof data.value === 'object') {
      const pending = data.value as { ticket_id?: string };
      
      // Jika ada ticket_id, verifikasi status tiketnya
      if (pending.ticket_id) {
        const { data: ticket } = await supabase
          .from('tickets')
          .select('status, ticket_number')
          .eq('id', pending.ticket_id)
          .maybeSingle();

        // Jika tiket sudah terbit nomornya, selesai, atau tidak ditemukan, bersihkan draf usang
        if (!ticket || ticket.status === 'ticket_issued' || ticket.status === 'closed' || ticket.ticket_number) {
          await supabase
            .from('ticketing_settings')
            .upsert({
              key: 'pending_ai_reply',
              value: null,
              updated_at: new Date().toISOString(),
            });
          return NextResponse.json({ pending: null });
        }
      }

      return NextResponse.json({ pending: data.value });
    }

    return NextResponse.json({ pending: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error checking pending reply';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ticketId, replyText } = body;

    const supabase = await createClient();

    if (action === 'approve') {
      if (!ticketId || !replyText) {
        return NextResponse.json(
          { error: 'Ticket ID dan teks balasan wajib diisi.' },
          { status: 400 }
        );
      }

      // 1. Simpan pesan keluar ke ticket_messages
      await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        direction: 'out',
        sender: 'admin',
        body: replyText,
      });

      // 2. Bersihkan pending reply di ticketing_settings
      await supabase
        .from('ticketing_settings')
        .upsert({
          key: 'pending_ai_reply',
          value: null,
          updated_at: new Date().toISOString(),
        });

      return NextResponse.json({
        success: true,
        message: 'Balasan telah disetujui dan dicatat!',
      });
    }

    if (action === 'reject') {
      // Bersihkan pending reply
      await supabase
        .from('ticketing_settings')
        .upsert({
          key: 'pending_ai_reply',
          value: null,
          updated_at: new Date().toISOString(),
        });

      return NextResponse.json({
        success: true,
        message: 'Draf balasan AI berhasil dibatalkan.',
      });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error processing pending reply';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
