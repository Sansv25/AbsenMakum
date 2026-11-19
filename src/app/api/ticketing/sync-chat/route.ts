import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function extractTicketOutcome(text: string): { type: string; value: string } | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  const blacklist = new Set([
    'ICONNET', 'WHATSAPP', 'INSTAGRAM', 'INTERNET', 'MODEMNYA',
    'PELAPORAN', 'PELAPORANNYA', 'GANGGUAN', 'INFORMASI', 'PERANGKAT',
    'PERBAIKAN', 'KENDALANYA', 'NOMORNYA', 'TERDAFTAR', 'PENGECEKAN',
    'SEBELUMNYA', 'TERHUBUNG', 'TERPUTUS', 'MENUNGGU', 'BANTUAN'
  ]);

  // 1. Prioritas Utama: Cari nomor tiket yang didahului kata kunci penanda tiket
  const prefixRegex = /(?:id\s*tiket|nomor\s*tiket|no\.?\s*tiket|tiket\s*(?:pelaporan)?|nomor\s*pelaporan|no\.?\s*pelaporan|id\s*pelaporan|nomor\s*laporan|no\.?\s*laporan|id\s*laporan)\s*[:#]?\s*(?:dengan\s*(?:nomor|no)\s*[:#]?)?\s*([A-Za-z0-9]{6,12})\b/gi;
  for (const match of text.matchAll(prefixRegex)) {
    const candidate = match[1].toUpperCase();
    if (/\d/.test(candidate) && !blacklist.has(candidate)) {
      return { type: 'ticket', value: candidate };
    }
  }

  // 1b. Pola kedua: format alfanumerik khas tiket (6-10 karakter diawali huruf, wajib ada angka)
  const standaloneRegex = /\b([A-Za-z][A-Za-z0-9]{6,9})\b/g;
  for (const match of text.matchAll(standaloneRegex)) {
    const candidate = match[1].toUpperCase();
    if (/\d/.test(candidate) && !blacklist.has(candidate)) {
      return { type: 'ticket', value: candidate };
    }
  }

  // 2. Cek status tagihan / isolir pelanggan
  if (
    /\b(?:terisolir|isolir)\b/i.test(text) ||
    /(?:belum\s*(?:melakukan\s*)?pembayaran|tagihan\s*(?:belum\s*dibayar|tertunggak|menunggak))/i.test(text) ||
    /(?:ada\s*tagihan|menunggu\s*pembayaran)/i.test(text) ||
    /(?:melakukan\s*pembayaran|lakukan\s*pembayaran)/i.test(text)
  ) {
    return { type: 'billing', value: 'Belum Bayar / Tagihan Tertunggak' };
  }

  // 3. Cek hasil restart sistem / refresh port oleh CS ICONNET
  if (
    lower.includes('perbaikan melalui sistem') ||
    lower.includes('perbaikan sistem') ||
    lower.includes('restart dari sistem') ||
    lower.includes('dibantu restart') ||
    lower.includes('restart sistem') ||
    lower.includes('refresh sistem') ||
    lower.includes('5-10 menit') ||
    lower.includes('5 hingga 10 menit') ||
    lower.includes('menunggu 5') ||
    lower.includes('10 menit setelah itu bisa mencoba')
  ) {
    return { type: 'restart', value: 'Perbaikan Sistem (Tunggu 5-10 Menit)' };
  }

  // 4. Cek gangguan massal / pemeliharaan jaringan
  if (lower.includes('gangguan massal') || lower.includes('pemeliharaan jaringan') || lower.includes('maintenance')) {
    return { type: 'mass_outage', value: 'Gangguan Massal di Area' };
  }

  // 5. Cek penutupan sepihak oleh CS
  if (
    lower.includes('chat akan kami akhiri') ||
    lower.includes('percakapan kami akhiri') ||
    lower.includes('sesi kami akhiri') ||
    (lower.includes('terima kasih telah menghubungi') &&
      (lower.includes('selamat pagi') || lower.includes('selamat siang') || lower.includes('selamat sore') || lower.includes('selamat malam')))
  ) {
    return { type: 'closed_by_cs', value: 'Sesi Diakhiri oleh CS ICONNET' };
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    let targetTicketId: string | null = null;
    try {
      const body = await request.json();
      targetTicketId = body?.ticketId || null;
    } catch {}

    // 1. Cari tiket: gunakan targetTicketId jika diberikan, atau cari tiket aktif
    let activeTicket = null;
    if (targetTicketId) {
      const { data: t } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', targetTicketId)
        .maybeSingle();
      activeTicket = t;
    } else {
      const { data: t } = await supabase
        .from('tickets')
        .select('*')
        .in('status', ['in_conversation', 'needs_admin'])
        .maybeSingle();
      activeTicket = t;
    }

    if (!activeTicket) {
      return NextResponse.json({
        message: 'Tidak ada tiket aktif yang sedang menunggu balasan.',
      });
    }

    // 2. Periksa pesan masuk terbaru
    const { data: incomingMsgs } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', activeTicket.id)
      .eq('direction', 'in')
      .order('created_at', { ascending: false })
      .limit(10);

    const combinedIncoming = (incomingMsgs || [])
      .map((m) => m.body || '')
      .filter(Boolean)
      .reverse()
      .join('\n');

    const outcome = extractTicketOutcome(combinedIncoming);

    // 3. Jika outcome ditemukan dan berbeda dari yang tersimpan
    if (outcome && (!activeTicket.ticket_number || activeTicket.ticket_number !== outcome.value)) {
      const updateData: Record<string, unknown> = {
        ticket_number: outcome.value,
        updated_at: new Date().toISOString(),
      };

      if (outcome.type === 'ticket') {
        updateData.status = 'ticket_issued';
        updateData.ticket_issued_at = new Date().toISOString();
      } else {
        // Jika outcome adalah restart sistem, gangguan massal, tagihan, atau CS mengakhiri chat
        updateData.status = 'closed';
      }

      await supabase
        .from('tickets')
        .update(updateData)
        .eq('id', activeTicket.id);

      return NextResponse.json({
        success: true,
        ticket_number: outcome.value,
        message: `Output tiket berhasil dicatat: "${outcome.value}"`,
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
