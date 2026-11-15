import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();

    // 1. Cek apakah ada tiket aktif
    const { data: activeTicket } = await supabase
      .from('tickets')
      .select('id, name')
      .in('status', ['in_conversation', 'needs_admin'])
      .maybeSingle();

    if (activeTicket) {
      return NextResponse.json({
        status: 'blocked',
        reason: `Tiket "${activeTicket.name}" sedang aktif.`,
      });
    }

    // 2. Ambil urutan antrean kustom
    const { data: queueOrderData } = await supabase
      .from('ticketing_settings')
      .select('value')
      .eq('key', 'queue_order')
      .maybeSingle();

    const queueOrder: string[] = Array.isArray(queueOrderData?.value) ? queueOrderData.value : [];

    // 3. Ambil seluruh tiket antrean
    const { data: queuedTickets, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    if (!queuedTickets || queuedTickets.length === 0) {
      return NextResponse.json({ status: 'empty', reason: 'Tidak ada tiket dalam antrean.' });
    }

    // Urutkan berdasarkan queueOrder
    queuedTickets.sort((a, b) => {
      const idxA = queueOrder.indexOf(a.id);
      const idxB = queueOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const nextTicket = queuedTickets[0];

    return NextResponse.json({
      status: 'ready',
      ticket: nextTicket,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error in queue dispatcher';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
