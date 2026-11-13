import { jsPDF } from 'jspdf';
import type { Attendance, Attachment, Holiday } from '@/lib/supabase/types';

export interface RecapPdfOptions {
  periodTitle: string; // e.g. "Mingguan (03 Nov 2026 - 09 Nov 2026)"
  periodType: 'mingguan' | 'bulanan';
  startDate: string;
  endDate: string;
  attendances: Attendance[];
  attachments: Attachment[];
  profiles: { id: string; full_name?: string | null; email?: string | null }[];
  holidays: Holiday[];
}

export function generateServerRecapPdf(options: RecapPdfOptions): Buffer {
  const { periodTitle, startDate, endDate, attendances, attachments, profiles, holidays } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const PAGE_WIDTH = 210;
  const PAGE_HEIGHT = 297;
  const MARGIN = 14;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 182 mm

  const holidaySet = new Set(holidays.map((h) => h.holiday_date));
  const profileMap = new Map<string, string>();
  for (const p of profiles) {
    profileMap.set(p.id, p.full_name?.trim() || p.email || 'Petugas');
  }

  // Group attachments by attendance_id
  const attachMap = new Map<string, Attachment[]>();
  for (const att of attachments) {
    if (!attachMap.has(att.attendance_id)) {
      attachMap.set(att.attendance_id, []);
    }
    attachMap.get(att.attendance_id)!.push(att);
  }

  // Hitung statistik per petugas
  interface OfficerStat {
    id: string;
    name: string;
    weekdayShifts: number;
    holidayShifts: number;
    totalShifts: number;
  }

  const officerStatsMap = new Map<string, OfficerStat>();
  for (const p of profiles) {
    officerStatsMap.set(p.id, {
      id: p.id,
      name: p.full_name?.trim() || p.email || 'Petugas',
      weekdayShifts: 0,
      holidayShifts: 0,
      totalShifts: 0,
    });
  }

  const totalScheduled = attendances.length;
  let totalLengkap = 0;
  let totalSebagian = 0;

  for (const a of attendances) {
    const attList = attachMap.get(a.id) ?? [];
    const hasMulai = attList.some((att) => att.kind === 'mulai');
    const hasSelesai = attList.some((att) => att.kind === 'selesai');
    const hasAktivitas = attList.filter((att) => att.kind === 'aktivitas').length >= 2;

    const isLengkap = hasMulai && hasSelesai && hasAktivitas;
    const isSebagian = !isLengkap && (hasMulai || hasSelesai || attList.length > 0 || (a.note && a.note.trim().length > 0));

    if (isLengkap) totalLengkap++;
    else if (isSebagian) totalSebagian++;

    // Tentukan petugas pengisi sebenarnya
    const actualOfficerId = attList.length > 0
      ? (attList.find((att) => att.user_id)?.user_id || a.user_id)
      : (isSebagian ? a.user_id : null);

    if (actualOfficerId && (isLengkap || isSebagian)) {
      if (!officerStatsMap.has(actualOfficerId)) {
        officerStatsMap.set(actualOfficerId, {
          id: actualOfficerId,
          name: profileMap.get(actualOfficerId) || 'Petugas',
          weekdayShifts: 0,
          holidayShifts: 0,
          totalShifts: 0,
        });
      }
      const stat = officerStatsMap.get(actualOfficerId)!;
      stat.totalShifts++;
      if (holidaySet.has(a.work_date)) {
        stat.holidayShifts++;
      } else {
        stat.weekdayShifts++;
      }
    }
  }

  const sortedOfficerStats = Array.from(officerStatsMap.values())
    .sort((a, b) => b.totalShifts - a.totalShifts || a.name.localeCompare(b.name));

  // ===================== DRAW HEADER KOP =====================
  function drawKopHeader(yStart: number) {
    // Brand Top Bar
    doc.setFillColor(0, 59, 112); // Biru ICONNET
    doc.rect(MARGIN, yStart, CONTENT_WIDTH, 2.5, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('PT INDONESIA COMNETS PLUS (PLN ICON PLUS)', MARGIN, yStart + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text('SBU Regional Bali & Nusa Tenggara • Kantor Perwakilan Denpasar', MARGIN, yStart + 13);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 59, 112);
    doc.text('LAPORAN REKAPITULASI PIKET & KEHADIRAN', MARGIN, yStart + 21);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Periode: ${periodTitle} (${startDate} s/d ${endDate})`, MARGIN, yStart + 26);

    // Separator line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(MARGIN, yStart + 29, MARGIN + CONTENT_WIDTH, yStart + 29);

    return yStart + 34;
  }

  let curY = drawKopHeader(MARGIN);

  // ===================== SUMMARY STATS CARDS =====================
  const cardW = (CONTENT_WIDTH - 9) / 4;
  const cardH = 16;
  const cards = [
    { label: 'Total Shift', val: `${totalScheduled}`, color: [30, 41, 59] },
    { label: 'Shift Lengkap', val: `${totalLengkap}`, color: [16, 185, 129] },
    { label: 'Shift Sebagian', val: `${totalSebagian}`, color: [245, 158, 11] },
    { label: 'Total Foto Bukti', val: `${attachments.length}`, color: [59, 130, 246] },
  ];

  cards.forEach((c, idx) => {
    const cx = MARGIN + idx * (cardW + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, curY, cardW, cardH, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, cx + cardW / 2, curY + 5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.val, cx + cardW / 2, curY + 12, { align: 'center' });
  });

  curY += cardH + 7;

  // ===================== TABEL 1: REKAP PETUGAS =====================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('I. Rekapitulasi Jumlah Piket per Petugas', MARGIN, curY);
  curY += 3.5;

  // Table header
  const thY = curY;
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(MARGIN, thY, CONTENT_WIDTH, 6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('No', MARGIN + 4, thY + 4.2);
  doc.text('Nama Petugas', MARGIN + 18, thY + 4.2);
  doc.text('Hari Biasa', MARGIN + 95, thY + 4.2, { align: 'center' });
  doc.text('Hari Libur', MARGIN + 125, thY + 4.2, { align: 'center' });
  doc.text('Total Piket', MARGIN + 158, thY + 4.2, { align: 'center' });
  curY += 6;

  // Table rows
  sortedOfficerStats.forEach((stat, idx) => {
    // Check if new page needed
    if (curY > PAGE_HEIGHT - 25) {
      doc.addPage();
      curY = drawKopHeader(MARGIN);
    }

    const rowH = 5.5;
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN, curY, CONTENT_WIDTH, rowH, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);

    doc.text(`${idx + 1}`, MARGIN + 4, curY + 3.8);
    doc.text(stat.name, MARGIN + 18, curY + 3.8);
    doc.text(`${stat.weekdayShifts}`, MARGIN + 95, curY + 3.8, { align: 'center' });
    doc.text(`${stat.holidayShifts}`, MARGIN + 125, curY + 3.8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(stat.totalShifts > 0 ? 16 : 100, stat.totalShifts > 0 ? 185 : 116, stat.totalShifts > 0 ? 129 : 139);
    doc.text(`${stat.totalShifts}`, MARGIN + 158, curY + 3.8, { align: 'center' });

    curY += rowH;
  });

  curY += 6;

  // ===================== TABEL 2: LOG RINCIAN ABSENSI =====================
  if (curY > PAGE_HEIGHT - 40) {
    doc.addPage();
    curY = drawKopHeader(MARGIN);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('II. Rincian Pelaksanaan Shift & Bukti Foto', MARGIN, curY);
  curY += 3.5;

  // Table header
  const th2Y = curY;
  doc.setFillColor(241, 245, 249);
  doc.rect(MARGIN, th2Y, CONTENT_WIDTH, 6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Tanggal', MARGIN + 4, th2Y + 4.2);
  doc.text('Shift', MARGIN + 30, th2Y + 4.2);
  doc.text('Posisi', MARGIN + 52, th2Y + 4.2);
  doc.text('Petugas Pengisi', MARGIN + 85, th2Y + 4.2);
  doc.text('Bukti Foto', MARGIN + 140, th2Y + 4.2);
  doc.text('Status', MARGIN + 168, th2Y + 4.2);
  curY += 6;

  attendances.forEach((a, idx) => {
    if (curY > PAGE_HEIGHT - 20) {
      doc.addPage();
      curY = drawKopHeader(MARGIN);
    }

    const attList = attachMap.get(a.id) ?? [];
    const hasMulai = attList.some((att) => att.kind === 'mulai');
    const hasSelesai = attList.some((att) => att.kind === 'selesai');
    const hasAktivitas = attList.filter((att) => att.kind === 'aktivitas').length >= 2;

    const isLengkap = hasMulai && hasSelesai && hasAktivitas;
    const isSebagian = !isLengkap && (hasMulai || hasSelesai || attList.length > 0 || (a.note && a.note.trim().length > 0));

    const statusText = isLengkap ? 'Lengkap' : isSebagian ? 'Sebagian' : 'Kosong';

    const actualOfficerId = attList.length > 0
      ? (attList.find((att) => att.user_id)?.user_id || a.user_id)
      : (isSebagian ? a.user_id : null);
    const officerName = actualOfficerId ? (profileMap.get(actualOfficerId) || 'Petugas') : '- Belum diisi -';

    const rowH = 5.2;
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN, curY, CONTENT_WIDTH, rowH, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);

    doc.text(a.work_date, MARGIN + 4, curY + 3.6);
    doc.text(a.shift_type.toUpperCase(), MARGIN + 30, curY + 3.6);
    doc.text(a.job_type ? a.job_type.toUpperCase() : 'MARKETER', MARGIN + 52, curY + 3.6);
    doc.text(officerName.length > 24 ? `${officerName.slice(0, 23)}..` : officerName, MARGIN + 85, curY + 3.6);
    doc.text(`${attList.length} Foto`, MARGIN + 140, curY + 3.6);

    doc.setFont('helvetica', 'bold');
    if (statusText === 'Lengkap') {
      doc.setTextColor(16, 185, 129);
    } else if (statusText === 'Sebagian') {
      doc.setTextColor(245, 158, 11);
    } else {
      doc.setTextColor(148, 163, 184);
    }
    doc.text(statusText, MARGIN + 168, curY + 3.6);

    curY += rowH;
  });

  // ===================== FOOTER ON ALL PAGES =====================
  const totalPages = doc.getNumberOfPages();
  const printTimeStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // slate-400

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_HEIGHT - 10, MARGIN + CONTENT_WIDTH, PAGE_HEIGHT - 10);

    doc.text(
      `Dicetak Otomatis Sistem Absensi Piket ICONNET • ${printTimeStr} WITA`,
      MARGIN,
      PAGE_HEIGHT - 6.5
    );
    doc.text(`Halaman ${i} dari ${totalPages}`, MARGIN + CONTENT_WIDTH, PAGE_HEIGHT - 6.5, { align: 'right' });
  }

  const arrayBuf = doc.output('arraybuffer');
  return Buffer.from(arrayBuf);
}

