import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await context.params;
    if (!ticketId) {
      return NextResponse.json({ error: 'ID tiket wajib disertakan.' }, { status: 400 });
    }

    const body = await request.json();
    const supabase = await createClient();

    const allowedFields = [
      'customer_id',
      'pln_id',
      'phone',
      'alt_phone',
      'name',
      'address',
      'email',
      'regional',
      'office',
      'complaint',
      'status',
      'mode',
      'ticket_number',
    ];

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const key of allowedFields) {
      if (key in body) {
        updatePayload[key] = body[key] === '' ? null : body[key];
      }
    }

    // Tangani otomatis timestamp jika status diubah
    if (updatePayload.status === 'ticket_issued') {
      updatePayload.ticket_issued_at = new Date().toISOString();
    }

    let { data: updatedTicket, error: updateError } = await supabase
      .from('tickets')
      .update(updatePayload)
      .eq('id', ticketId)
      .select('*')
      .single();

    // Fallback jika database Supabase belum memiliki kolom alt_phone
    if (updateError && updateError.message?.includes('alt_phone')) {
      const fallbackPayload: Record<string, unknown> = { ...updatePayload };
      delete fallbackPayload.alt_phone;

      // Jika ada isi alt_phone dan complaint juga diedit, selipkan ke complaint jika belum ada
      if (updatePayload.alt_phone && typeof updatePayload.complaint === 'string') {
        const altStr = String(updatePayload.alt_phone).trim();
        if (altStr && !updatePayload.complaint.includes(altStr)) {
          fallbackPayload.complaint = `${updatePayload.complaint}\n\nCP Alt: ${altStr}`;
        }
      }

      const retry = await supabase
        .from('tickets')
        .update(fallbackPayload)
        .eq('id', ticketId)
        .select('*')
        .single();

      updatedTicket = retry.data;
      updateError = retry.error;
    }

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Data tiket berhasil diperbarui!',
      ticket: updatedTicket,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memperbarui tiket';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await context.params;
    if (!ticketId) {
      return NextResponse.json({ error: 'ID tiket wajib disertakan.' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Hapus tiket (cascade akan menghapus ticket_messages dan ticket_images)
    const { error: deleteError } = await supabase
      .from('tickets')
      .delete()
      .eq('id', ticketId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // 2. Bersihkan ID tiket dari queue_order di ticketing_settings jika ada
    try {
      const { data: queueSetting } = await supabase
        .from('ticketing_settings')
        .select('value')
        .eq('key', 'queue_order')
        .maybeSingle();

      if (queueSetting && Array.isArray(queueSetting.value)) {
        const newQueue = queueSetting.value.filter((tid: string) => tid !== ticketId);
        await supabase
          .from('ticketing_settings')
          .upsert({
            key: 'queue_order',
            value: newQueue,
            updated_at: new Date().toISOString(),
          });
      }
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Tiket berhasil dihapus secara permanen.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus tiket';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
