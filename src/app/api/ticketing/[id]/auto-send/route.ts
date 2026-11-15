import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import fs from 'fs';

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

    // 1. Cek konflik tiket aktif
    const { data: activeTicket } = await supabase
      .from('tickets')
      .select('id, name, customer_id')
      .in('status', ['in_conversation', 'needs_admin'])
      .neq('id', ticketId)
      .maybeSingle();

    if (activeTicket) {
      return NextResponse.json(
        {
          error: `Tidak dapat memulai tiket ini. Masih ada tiket aktif: "${activeTicket.name}". Harap selesaikan tiket tersebut terlebih dahulu.`,
        },
        { status: 409 }
      );
    }

    // 2. Cek ketersediaan Chrome lokal untuk Puppeteer
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const isLocalChromeAvailable = fs.existsSync(chromePath);

    if (!isLocalChromeAvailable) {
      return NextResponse.json(
        {
          error:
            'Otomasi browser Chrome hanya dapat dijalankan saat aplikasi dibuka di PC lokal. Untuk server Vercel, silakan gunakan tombol "Salin Pesan" lalu kirim manual lewat DM Instagram HP dan klik "Sudah Kirim Manual".',
        },
        { status: 422 }
      );
    }

    // Panggil otomasi Puppeteer lokal untuk mengetik ke Instagram
    const { sendFirstMessageViaBrowser } = await import('@/lib/instagram/sendViaBrowser');
    const result = await sendFirstMessageViaBrowser(ticketId);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
