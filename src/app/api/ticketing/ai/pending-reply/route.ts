import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { PendingAiReplyDraft } from '@/lib/ticketing/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const ticketIdFilter = searchParams.get('ticketId');

    const pendingList: PendingAiReplyDraft[] = [];

    // 1. Utamakan kolom per-tiket tickets.pending_ai_reply (Multi-Bot Paralel)
    const { data: ticketRows, error: ticketErr } = await supabase
      .from('tickets')
      .select('id, name, status, ticket_number, runner_label, pending_ai_reply')
      .in('status', ['in_conversation', 'needs_admin'])
      .not('pending_ai_reply', 'is', null)
      .order('updated_at', { ascending: false });

    if (!ticketErr && Array.isArray(ticketRows)) {
      for (const t of ticketRows) {
        if (t.ticket_number) {
          // Bersihkan draf usang jika nomor tiket sudah terbit
          await supabase.from('tickets').update({ pending_ai_reply: null }).eq('id', t.id);
          continue;
        }
        const raw = t.pending_ai_reply as Partial<PendingAiReplyDraft> | null;
        if (raw && raw.reply_text) {
          pendingList.push({
            ticket_id: t.id,
            customer_name: raw.customer_name || t.name,
            reply_text: raw.reply_text,
            incoming_text: raw.incoming_text || '',
            created_at: raw.created_at || new Date().toISOString(),
            runner_label: raw.runner_label || t.runner_label || null,
          });
        }
      }
    }

    // 2. Fallback kompatibilitas: cek key lama ticketing_settings.pending_ai_reply
    const { data: legacyData } = await supabase
      .from('ticketing_settings')
      .select('value')
      .eq('key', 'pending_ai_reply')
      .maybeSingle();

    if (legacyData?.value && typeof legacyData.value === 'object') {
      const legacy = legacyData.value as PendingAiReplyDraft;
      if (legacy.ticket_id && !pendingList.some((p) => p.ticket_id === legacy.ticket_id)) {
        const { data: ticket } = await supabase
          .from('tickets')
          .select('status, ticket_number')
          .eq('id', legacy.ticket_id)
          .maybeSingle();

        if (!ticket || ticket.status === 'ticket_issued' || ticket.status === 'closed' || ticket.ticket_number) {
          await supabase.from('ticketing_settings').delete().eq('key', 'pending_ai_reply');
        } else {
          pendingList.push(legacy);
        }
      }
    }

    if (ticketIdFilter) {
      const matched = pendingList.find((p) => p.ticket_id === ticketIdFilter) || null;
      return NextResponse.json({
        pending: matched,
        pendingList: matched ? [matched] : [],
      });
    }

    return NextResponse.json({
      pending: pendingList[0] || null,
      pendingList,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error checking pending reply';
    return NextResponse.json({ error: message, pending: null, pendingList: [] }, { status: 500 });
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

      // 1. Simpan pesan keluar ke ticket_messages (ditandai pending unik agar diketikkan bot pemilik tiket ke Instagram DM)
      await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        direction: 'out',
        sender: 'admin',
        body: replyText,
        ig_mid: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      });

      // 2. Kembalikan status tiket ke in_conversation dan bersihkan draf per-tiket
      const now = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('tickets')
        .update({ status: 'in_conversation', pending_ai_reply: null, updated_at: now })
        .eq('id', ticketId);

      // Fallback jika kolom pending_ai_reply belum dimigrasi
      if (updateErr) {
        await supabase
          .from('tickets')
          .update({ status: 'in_conversation', updated_at: now })
          .eq('id', ticketId);
      }

      // 3. Bersihkan juga key legacy jika cocok dengan ticketId ini
      const { data: legacyData } = await supabase
        .from('ticketing_settings')
        .select('value')
        .eq('key', 'pending_ai_reply')
        .maybeSingle();
      const legacyVal = legacyData?.value as { ticket_id?: string } | null;
      if (legacyVal?.ticket_id === ticketId) {
        await supabase.from('ticketing_settings').delete().eq('key', 'pending_ai_reply');
      }

      return NextResponse.json({
        success: true,
        message: 'Balasan telah disetujui dan diteruskan ke bot Instagram!',
      });
    }

    if (action === 'reject') {
      if (ticketId) {
        const now = new Date().toISOString();
        const { error: updateErr } = await supabase
          .from('tickets')
          .update({ status: 'in_conversation', pending_ai_reply: null, updated_at: now })
          .eq('id', ticketId);

        if (updateErr) {
          await supabase
            .from('tickets')
            .update({ status: 'in_conversation', updated_at: now })
            .eq('id', ticketId);
        }

        const { data: legacyData } = await supabase
          .from('ticketing_settings')
          .select('value')
          .eq('key', 'pending_ai_reply')
          .maybeSingle();
        const legacyVal = legacyData?.value as { ticket_id?: string } | null;
        if (legacyVal?.ticket_id === ticketId) {
          await supabase.from('ticketing_settings').delete().eq('key', 'pending_ai_reply');
        }
      }

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
