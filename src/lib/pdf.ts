import { jsPDF } from 'jspdf';
import { formatIndonesia } from './dates';
import { shiftNumber, jobLabel, type JobType } from './shifts';
import type { ShiftType, AppRole } from './supabase/types';
import { PLN_LOGO_BASE64 } from './pdf-logo';

export interface PdfAttendanceItem {
  work_date: string;
  shift_type: ShiftType;
  job_type?: JobType;
  author_id?: string;
  author_name?: string;
  author_roles?: AppRole[];
  note: string | null;
  mulaiUrl: string | null;
  selesaiUrl: string | null;
  aktivitasUrls?: string[];
  ticketUrls: string[];
}

export interface NotaTableRow {
  id: string;
  no: string;
  tglProses: string;
  namaPenerima: string;
  kegiatan: string;
  noRek: string;
  namaBank: string;
  buktiTf: string;
  buktiTfImageUrl?: string | null;
  nominal: number;
}

export interface NotaPdfConfig {
  title: string;
  magangTitle?: string;
  freelanceTitle?: string;
  magangRows: NotaTableRow[];
  freelanceRows: NotaTableRow[];
  includeEmptyTables?: boolean;
}

export interface ProgressCallback {
  (current: number, total: number, message: string): void;
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 182 mm

// Convert image URL to HTMLImageElement and measure its dimensions
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Gagal memuat gambar: ${url}`));
    img.src = url;
  });
}

// Convert HTMLImageElement to base64 JPEG data URL via canvas
function imageToDataUrl(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || 800;
  canvas.height = img.naturalHeight || 600;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85);
}

// Gambar Header Utama / Kop Surat Resmi Laporan Absensi
function drawFullHeader(doc: jsPDF, item: PdfAttendanceItem): number {
  // 1. KOP SURAT RESMI PT PLN INDONESIA COMNETS PLUS
  const kopTop = 10;

  // Logo PLN Icon Plus (Background 100% transparan dengan teks navy resmi)
  try {
    doc.addImage(PLN_LOGO_BASE64, 'PNG', MARGIN, kopTop, 29, 10.5);
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 59, 112);
    doc.text('PLN ICON PLUS', MARGIN, kopTop + 7);
  }

  // Nama Institusi / Badan Usaha
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 59, 112); // #003B70 (PLN Corporate Navy)
  doc.text('PT PLN INDONESIA COMNETS PLUS', MARGIN + 32, kopTop + 3.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('SBU REGIONAL BALI & NUSA TENGGARA', MARGIN + 32, kopTop + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('Kantor Perwakilan Denpasar', MARGIN + 32, kopTop + 10.8);

  // Metadata Kop Kanan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('DOKUMEN OPERASIONAL', PAGE_WIDTH - MARGIN, kopTop + 3.8, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 59, 112);
  doc.text('ICONNET BALI', PAGE_WIDTH - MARGIN, kopTop + 7.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Sistem Absensi Piket Terpadu', PAGE_WIDTH - MARGIN, kopTop + 10.8, { align: 'right' });

  // Garis Ganda Kop Surat Resmi BUMN
  const lineY = kopTop + 13.5;
  doc.setLineWidth(0.6);
  doc.setDrawColor(15, 23, 42); // slate-900
  doc.line(MARGIN, lineY, PAGE_WIDTH - MARGIN, lineY);

  doc.setLineWidth(0.18);
  doc.line(MARGIN, lineY + 0.8, PAGE_WIDTH - MARGIN, lineY + 0.8);

  // 2. JUDUL DOKUMEN LAPORAN
  const titleY = lineY + 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('LAPORAN ABSENSI & DOKUMENTASI PIKET', PAGE_WIDTH / 2, titleY, { align: 'center' });

  const shiftNum = shiftNumber(item.shift_type);
  const shiftName = item.shift_type === 'pagi' ? 'Pagi' : 'Malam';
  const jobText = item.job_type ? ` — ${jobLabel(item.job_type).toUpperCase()}` : '';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Shift ${shiftNum} (${shiftName})${jobText} • ${formatIndonesia(item.work_date)}`,
    PAGE_WIDTH / 2,
    titleY + 4.2,
    { align: 'center' }
  );

  // 3. TABEL INFORMASI / METADATA PIKET
  const tblY = titleY + 7.5;
  const tblW = CONTENT_WIDTH;
  const tblH = 17; // 2 baris metadata formal

  // Table outline
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.25);
  doc.rect(MARGIN, tblY, tblW, tblH);

  // Row 1 divider
  doc.line(MARGIN, tblY + 8.5, MARGIN + tblW, tblY + 8.5);

  // Column widths (4 columns: label1, val1, label2, val2)
  const c1W = 28;
  const c2W = 63;
  const c3W = 28;

  // Vertical dividers for rows 1 & 2
  doc.line(MARGIN + c1W, tblY, MARGIN + c1W, tblY + tblH);
  doc.line(MARGIN + c1W + c2W, tblY, MARGIN + c1W + c2W, tblY + tblH);
  doc.line(MARGIN + c1W + c2W + c3W, tblY, MARGIN + c1W + c2W + c3W, tblY + tblH);

  // Background for label cells
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(MARGIN, tblY, c1W, 8.5, 'F');
  doc.rect(MARGIN, tblY + 8.5, c1W, 8.5, 'F');
  doc.rect(MARGIN + c1W + c2W, tblY, c3W, 8.5, 'F');
  doc.rect(MARGIN + c1W + c2W, tblY + 8.5, c3W, 8.5, 'F');

  // Labels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('TANGGAL', MARGIN + 2.5, tblY + 5.5);
  doc.text('PEKERJAAN', MARGIN + 2.5, tblY + 14);
  doc.text('SHIFT', MARGIN + c1W + c2W + 2.5, tblY + 5.5);
  doc.text('PETUGAS', MARGIN + c1W + c2W + 2.5, tblY + 14);

  // Values
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(formatIndonesia(item.work_date), MARGIN + c1W + 3, tblY + 5.5);
  doc.text(item.job_type ? jobLabel(item.job_type) : 'Operasional', MARGIN + c1W + 3, tblY + 14);
  doc.text(`Shift ${shiftNum} (${shiftName})`, MARGIN + c1W + c2W + c3W + 3, tblY + 5.5);

  const authorTextRaw = item.author_name?.trim() || 'Petugas Piket';
  const maxAuthorW = doc.internal.pageSize.getWidth() - MARGIN * 2 - c1W - c2W - c3W - 5.5;
  let authorFontSize = 8;
  doc.setFontSize(authorFontSize);
  while (authorFontSize > 6 && doc.getTextWidth(authorTextRaw) > maxAuthorW) {
    authorFontSize -= 0.5;
    doc.setFontSize(authorFontSize);
  }
  let authorText = authorTextRaw;
  if (doc.getTextWidth(authorText) > maxAuthorW) {
    while (authorText.length > 1 && doc.getTextWidth(`${authorText}...`) > maxAuthorW) {
      authorText = authorText.slice(0, -1).trimEnd();
    }
    authorText = `${authorText}...`;
  }
  doc.text(authorText, MARGIN + c1W + c2W + c3W + 3, tblY + 14);
  doc.setFontSize(8);

  return tblY + tblH + 6.5;
}

// Gambar Header Mini pada Halaman Lanjutan (Running Header Formal)
function drawContinuationHeader(doc: jsPDF, item: PdfAttendanceItem): number {
  const topY = 10;

  // Left: Company & Report
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('PT PLN INDONESIA COMNETS PLUS — LAPORAN ABSENSI PIKET', MARGIN, topY + 4);

  // Right: Date & Shift
  const shiftNum = shiftNumber(item.shift_type);
  const shiftName = item.shift_type === 'pagi' ? 'Pagi' : 'Malam';
  const jobText = item.job_type ? ` [${jobLabel(item.job_type)}]` : '';
  const rightText = `${formatIndonesia(item.work_date)} • Shift ${shiftNum} (${shiftName})${jobText}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(rightText, PAGE_WIDTH - MARGIN, topY + 4, { align: 'right' });

  // Running rule divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, topY + 6.5, PAGE_WIDTH - MARGIN, topY + 6.5);

  return topY + 11;
}

// Gambar Judul Sub-bagian Foto (Bukti Mulai, Selesai, Aktivitas, Tiket)
function drawSectionHeading(
  doc: jsPDF,
  label: string,
  sectionCode: string,
  y: number
): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42); // slate-900
  const fullText = `${sectionCode}. ${label.toUpperCase()}`;
  doc.text(fullText, MARGIN, y + 4);

  // Subtle clean rule below heading
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y + 6, PAGE_WIDTH - MARGIN, y + 6);

  return y + 9.5;
}

// Terapkan Footer pada Seluruh Halaman Dokumen (Portrait & Landscape)
function applyFooters(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, pageH - 10, pageW - MARGIN, pageH - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Dokumen Resmi Operasional • PT PLN Indonesia Comnets Plus (PLN Icon Plus)', MARGIN, pageH - 6);
    doc.text(`Halaman ${p} dari ${totalPages}`, pageW - MARGIN, pageH - 6, {
      align: 'right',
    });
  }
}

const NOTA_MARGIN = 12;
const NOTA_PAGE_W = 297;
const NOTA_PAGE_H = 210;
const NOTA_MAX_Y = NOTA_PAGE_H - 16;

const NOTA_COLS = [
  { key: 'no', label: 'NO', w: 10, align: 'center' as const },
  { key: 'tglProses', label: 'TGL PROSES', w: 24, align: 'center' as const },
  { key: 'namaPenerima', label: 'NAMA PENERIMA', w: 38, align: 'left' as const },
  { key: 'kegiatan', label: 'KEGIATAN', w: 72, align: 'left' as const },
  { key: 'noRek', label: 'NO REK / E-WALLET', w: 38, align: 'left' as const },
  { key: 'namaBank', label: 'NAMA BANK / E-WALLET', w: 36, align: 'left' as const },
  { key: 'buktiTf', label: 'BUKTI TF', w: 19, align: 'center' as const },
  { key: 'nominal', label: 'NOMINAL', w: 36, align: 'right' as const },
]; // Total = 273 mm

function drawNotaTableHeader(doc: jsPDF, bannerTitle: string, startY: number): number {
  const totalW = 273;
  let y = startY;

  // Blue Banner Header
  doc.setFillColor(68, 114, 196);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.rect(NOTA_MARGIN, y, totalW, 6.8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(bannerTitle, NOTA_PAGE_W / 2, y + 4.7, { align: 'center' });
  y += 6.8;

  // Yellow Column Header Row
  const colHdrH = 7;
  let x = NOTA_MARGIN;
  doc.setFillColor(255, 255, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  for (const col of NOTA_COLS) {
    doc.rect(x, y, col.w, colHdrH, 'FD');
    x += col.w;
  }

  x = NOTA_MARGIN;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  for (const col of NOTA_COLS) {
    doc.text(col.label, x + col.w / 2, y + 4.7, { align: 'center' });
    x += col.w;
  }

  return y + colHdrH;
}

function drawNotaTableSection(
  doc: jsPDF,
  bannerTitle: string,
  rows: NotaTableRow[],
  startY: number
): number {
  let y = startY;

  // Pastikan banner + header + minimal 1 baris cukup ruang
  if (y + 22 > NOTA_MAX_Y) {
    doc.addPage('a4', 'landscape');
    y = 14;
  }

  y = drawNotaTableHeader(doc, bannerTitle, y);

  if (rows.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(NOTA_MARGIN, y, 273, 7, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Belum ada data pada tabel ini.', NOTA_PAGE_W / 2, y + 4.8, { align: 'center' });
    y += 7;
  } else {
    for (const row of rows) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      const cellLines: Record<string, string[]> = {
        no: [row.no || ''],
        tglProses: [row.tglProses || ''],
        namaPenerima: doc.splitTextToSize(row.namaPenerima || '-', NOTA_COLS[2].w - 3),
        kegiatan: doc.splitTextToSize(row.kegiatan || '-', NOTA_COLS[3].w - 3),
        noRek: doc.splitTextToSize(row.noRek || '', NOTA_COLS[4].w - 3),
        namaBank: doc.splitTextToSize(row.namaBank || '', NOTA_COLS[5].w - 3),
        buktiTf: [row.buktiTf || ''],
        nominal: [],
      };

      const maxLines = Math.max(
        1,
        cellLines.namaPenerima.length,
        cellLines.kegiatan.length,
        cellLines.noRek.length,
        cellLines.namaBank.length
      );
      const rowH = Math.max(6.2, maxLines * 3.8 + 2.4);

      if (y + rowH > NOTA_MAX_Y) {
        doc.addPage('a4', 'landscape');
        y = drawNotaTableHeader(doc, bannerTitle, 14);
      }

      let x = NOTA_MARGIN;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      for (const col of NOTA_COLS) {
        doc.rect(x, y, col.w, rowH, 'FD');
        x += col.w;
      }

      x = NOTA_MARGIN;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);

      for (const col of NOTA_COLS) {
        if (col.key === 'nominal') {
          const valNum = Math.round(Number.isFinite(row.nominal) ? row.nominal : 0);
          if (valNum > 0 || row.nominal === 0) {
            const centerY = y + rowH / 2 + 1.2;
            doc.text('Rp', x + 2, centerY);
            doc.text(valNum.toLocaleString('en-US'), x + col.w - 2, centerY, { align: 'right' });
          }
        } else {
          const lines = cellLines[col.key] || [''];
          const blockH = lines.length * 3.8;
          const startTextY = y + (rowH - blockH) / 2 + 2.9;

          for (let li = 0; li < lines.length; li++) {
            const lineText = lines[li];
            const textY = startTextY + li * 3.8;
            if (col.align === 'center') {
              doc.text(lineText, x + col.w / 2, textY, { align: 'center' });
            } else {
              doc.text(lineText, x + 1.8, textY);
            }
          }
        }
        x += col.w;
      }

      y += rowH;
    }
  }

  // Yellow TOTAL Row
  const totalNominal = rows.reduce((sum, r) => sum + (Number.isFinite(r.nominal) ? r.nominal : 0), 0);
  const totalH = 6.8;
  if (y + totalH > NOTA_MAX_Y) {
    doc.addPage('a4', 'landscape');
    y = 14;
  }

  const leftSpanW = 273 - NOTA_COLS[7].w;
  doc.setFillColor(255, 255, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.rect(NOTA_MARGIN, y, leftSpanW, totalH, 'FD');
  doc.rect(NOTA_MARGIN + leftSpanW, y, NOTA_COLS[7].w, totalH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.text('TOTAL', NOTA_MARGIN + leftSpanW / 2, y + 4.7, { align: 'center' });
  doc.text('Rp', NOTA_MARGIN + leftSpanW + 2, y + 4.7);
  doc.text(Math.round(totalNominal).toLocaleString('en-US'), NOTA_MARGIN + 273 - 2, y + 4.7, {
    align: 'right',
  });

  return y + totalH + 8;
}

function drawNotaCoverPages(doc: jsPDF, notaConfig: NotaPdfConfig): void {
  let y = 18;

  if (notaConfig.title && notaConfig.title.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    const titleLines = doc.splitTextToSize(notaConfig.title.trim(), 273);
    for (const line of titleLines) {
      doc.text(line, NOTA_PAGE_W / 2, y, { align: 'center' });
      y += 6.5;
    }
    y += 3;
  }

  const includeEmpty = Boolean(notaConfig.includeEmptyTables);
  const hasMagang = notaConfig.magangRows.length > 0 || includeEmpty;
  const hasFreelance = notaConfig.freelanceRows.length > 0 || includeEmpty;

  if (hasMagang) {
    y = drawNotaTableSection(
      doc,
      notaConfig.magangTitle?.trim() || 'Komisi Penjualan Magang',
      notaConfig.magangRows,
      y
    );
  }

  if (hasFreelance) {
    drawNotaTableSection(
      doc,
      notaConfig.freelanceTitle?.trim() || 'Komisi Penjualan Freelance',
      notaConfig.freelanceRows,
      y
    );
  }
}

async function drawBuktiTfPages(
  doc: jsPDF,
  notaConfig: NotaPdfConfig,
  onTick?: (msg: string) => void
): Promise<void> {
  const items: { category: string; row: NotaTableRow }[] = [
    ...notaConfig.magangRows
      .filter((r) => !!r.buktiTfImageUrl)
      .map((r) => ({ category: 'Magang', row: r })),
    ...notaConfig.freelanceRows
      .filter((r) => !!r.buktiTfImageUrl)
      .map((r) => ({ category: 'Freelance', row: r })),
  ];

  if (items.length === 0) return;

  doc.addPage('a4', 'portrait');
  let y = 14;

  const drawBuktiHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('LAMPIRAN BUKTI TRANSFER KOMISI', MARGIN, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    if (notaConfig.title?.trim()) {
      doc.text(notaConfig.title.trim(), PAGE_WIDTH - MARGIN, y + 4, { align: 'right' });
    }
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y + 6.5, PAGE_WIDTH - MARGIN, y + 6.5);
    y += 12;
  };

  drawBuktiHeader();

  const gap = 8;
  const cardW = (CONTENT_WIDTH - gap) / 2;
  const maxImgH = 104;

  for (let i = 0; i < items.length; i += 2) {
    const pair = items.slice(i, i + 2);

    // Hitung tinggi kartu di baris ini dulu
    const prepared: {
      category: string;
      row: NotaTableRow;
      dataUrl: string;
      imgW: number;
      imgH: number;
    }[] = [];

    for (const entry of pair) {
      if (!entry.row.buktiTfImageUrl) continue;
      if (onTick) onTick(`Memproses Bukti TF (${entry.row.namaPenerima})...`);
      try {
        const img = await loadImage(entry.row.buktiTfImageUrl);
        const dataUrl = imageToDataUrl(img);
        const aspect = (img.naturalWidth || 1) / (img.naturalHeight || 1);
        let imgW = cardW - 6;
        let imgH = imgW / aspect;
        if (imgH > maxImgH) {
          imgH = maxImgH;
          imgW = imgH * aspect;
        }
        prepared.push({
          category: entry.category,
          row: entry.row,
          dataUrl,
          imgW,
          imgH,
        });
      } catch (err) {
        console.error('Gagal memuat gambar bukti TF:', err);
      }
    }

    if (prepared.length === 0) continue;

    const maxCardImgH = Math.max(...prepared.map((p) => p.imgH));
    const cardTotalH = maxCardImgH + 22;

    if (y + cardTotalH > PAGE_HEIGHT - 16) {
      doc.addPage('a4', 'portrait');
      y = 14;
      drawBuktiHeader();
    }

    for (let colIdx = 0; colIdx < prepared.length; colIdx++) {
      const p = prepared[colIdx];
      const cardX = MARGIN + colIdx * (cardW + gap);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      doc.roundedRect(cardX, y, cardW, cardTotalH, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${p.row.no ? `${p.row.no}. ` : ''}${p.row.namaPenerima} (${p.category})`, cardX + 3, y + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(71, 85, 105);
      const bankLine = [p.row.namaBank, p.row.noRek].filter(Boolean).join(' • ');
      const nominalLine = p.row.nominal > 0 ? `Rp ${Math.round(p.row.nominal).toLocaleString('en-US')}` : '';
      const subText = [bankLine, nominalLine].filter(Boolean).join(' — ');
      if (subText) {
        doc.text(subText, cardX + 3, y + 10);
      }

      const imgX = cardX + (cardW - p.imgW) / 2;
      const imgY = y + 13;
      doc.addImage(p.dataUrl, 'JPEG', imgX, imgY, p.imgW, p.imgH);
      doc.setDrawColor(226, 232, 240);
      doc.rect(imgX, imgY, p.imgW, p.imgH);
    }

    y += cardTotalH + 7;
  }
}

export async function generateAttendancePdf(
  attendances: PdfAttendanceItem[],
  startDate: string,
  endDate: string,
  onProgress?: ProgressCallback,
  notaConfig?: NotaPdfConfig
): Promise<void> {
  const hasNota = Boolean(notaConfig);
  const doc = new jsPDF({
    orientation: hasNota ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Count total operations for progress bar
  let totalOps = 0;
  for (const a of attendances) {
    if (a.mulaiUrl) totalOps++;
    if (a.selesaiUrl) totalOps++;
    if (a.aktivitasUrls) totalOps += a.aktivitasUrls.length;
    if (a.ticketUrls) totalOps += a.ticketUrls.length;
  }
  if (notaConfig) {
    totalOps += notaConfig.magangRows.filter((r) => !!r.buktiTfImageUrl).length;
    totalOps += notaConfig.freelanceRows.filter((r) => !!r.buktiTfImageUrl).length;
  }
  totalOps = Math.max(totalOps, 1);
  let currentOp = 0;

  function updateProgress(msg: string) {
    currentOp++;
    if (onProgress) {
      onProgress(Math.min(currentOp, totalOps), totalOps, msg);
    }
  }

  if (notaConfig) {
    drawNotaCoverPages(doc, notaConfig);
  }

  let isFirstPage = !hasNota;

  for (let i = 0; i < attendances.length; i++) {
    const item = attendances[i];

    if (!isFirstPage) {
      doc.addPage('a4', 'portrait');
    }
    isFirstPage = false;

    // Header Kop Surat Resmi & Tabel Metadata (termasuk Catatan Petugas)
    let y = drawFullHeader(doc, item);

    // 1. Mulai Kerja
    if (item.mulaiUrl) {
      try {
        updateProgress(`Memproses foto Mulai Kerja (${item.work_date})...`);
        const img = await loadImage(item.mulaiUrl);
        const dataUrl = imageToDataUrl(img);

        const maxImgHeight = 92;
        const aspect = img.naturalWidth / img.naturalHeight;
        let imgW = CONTENT_WIDTH;
        let imgH = imgW / aspect;
        if (imgH > maxImgHeight) {
          imgH = maxImgHeight;
          imgW = imgH * aspect;
        }

        if (y + imgH + 18 > PAGE_HEIGHT - MARGIN) {
          doc.addPage();
          y = drawContinuationHeader(doc, item);
        }

        y = drawSectionHeading(doc, 'Bukti Piket — Mulai Kerja', '1', y);
        const imgX = MARGIN + (CONTENT_WIDTH - imgW) / 2;
        doc.addImage(dataUrl, 'JPEG', imgX, y, imgW, imgH);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.rect(imgX, y, imgW, imgH);
        y += imgH + 7;
      } catch (err) {
        console.error('Gagal menyertakan foto mulai:', err);
      }
    }

    // 2. Selesai Kerja
    if (item.selesaiUrl) {
      try {
        updateProgress(`Memproses foto Selesai Kerja (${item.work_date})...`);
        const img = await loadImage(item.selesaiUrl);
        const dataUrl = imageToDataUrl(img);

        const maxImgHeight = 92;
        const aspect = img.naturalWidth / img.naturalHeight;
        let imgW = CONTENT_WIDTH;
        let imgH = imgW / aspect;
        if (imgH > maxImgHeight) {
          imgH = maxImgHeight;
          imgW = imgH * aspect;
        }

        if (y + imgH + 18 > PAGE_HEIGHT - MARGIN) {
          doc.addPage();
          y = drawContinuationHeader(doc, item);
        }

        y = drawSectionHeading(doc, 'Bukti Piket — Selesai Kerja', '2', y);
        const imgX = MARGIN + (CONTENT_WIDTH - imgW) / 2;
        doc.addImage(dataUrl, 'JPEG', imgX, y, imgW, imgH);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.rect(imgX, y, imgW, imgH);
        y += imgH + 7;
      } catch (err) {
        console.error('Gagal menyertakan foto selesai:', err);
      }
    }

    // 3. Bukti Aktivitas Piket
    if (item.aktivitasUrls && item.aktivitasUrls.length > 0) {
      for (let aIdx = 0; aIdx < item.aktivitasUrls.length; aIdx++) {
        const aktUrl = item.aktivitasUrls[aIdx];
        try {
          updateProgress(`Memproses foto Aktivitas #${aIdx + 1} (${item.work_date})...`);
          const img = await loadImage(aktUrl);
          const dataUrl = imageToDataUrl(img);

          const maxImgHeight = 88;
          const aspect = img.naturalWidth / img.naturalHeight;
          let imgW = CONTENT_WIDTH;
          let imgH = imgW / aspect;
          if (imgH > maxImgHeight) {
            imgH = maxImgHeight;
            imgW = imgH * aspect;
          }

          if (y + imgH + 18 > PAGE_HEIGHT - MARGIN) {
            doc.addPage();
            y = drawContinuationHeader(doc, item);
          }

          y = drawSectionHeading(doc, `Bukti Aktivitas Piket #${aIdx + 1}`, `3.${aIdx + 1}`, y);
          const imgX = MARGIN + (CONTENT_WIDTH - imgW) / 2;
          doc.addImage(dataUrl, 'JPEG', imgX, y, imgW, imgH);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.rect(imgX, y, imgW, imgH);
          y += imgH + 7;
        } catch (err) {
          console.error(`Gagal menyertakan foto aktivitas #${aIdx + 1}:`, err);
        }
      }
    }

    // 4. Picket Ticket
    if (item.ticketUrls && item.ticketUrls.length > 0) {
      for (let t = 0; t < item.ticketUrls.length; t++) {
        const ticketUrl = item.ticketUrls[t];
        try {
          updateProgress(`Memproses tiket #${t + 1} (${item.work_date})...`);
          const img = await loadImage(ticketUrl);
          const dataUrl = imageToDataUrl(img);

          const maxImgHeight = 110;
          const aspect = img.naturalWidth / img.naturalHeight;
          let imgW = CONTENT_WIDTH;
          let imgH = imgW / aspect;
          if (imgH > maxImgHeight) {
            imgH = maxImgHeight;
            imgW = imgH * aspect;
          }

          if (y + imgH + 18 > PAGE_HEIGHT - MARGIN) {
            doc.addPage();
            y = drawContinuationHeader(doc, item);
          }

          y = drawSectionHeading(doc, `Picket Ticket #${t + 1}`, `4.${t + 1}`, y);
          const imgX = MARGIN + (CONTENT_WIDTH - imgW) / 2;
          doc.addImage(dataUrl, 'JPEG', imgX, y, imgW, imgH);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.rect(imgX, y, imgW, imgH);
          y += imgH + 7;
        } catch (err) {
          console.error(`Gagal menyertakan tiket #${t + 1}:`, err);
        }
      }
    }
  }

  if (notaConfig) {
    await drawBuktiTfPages(doc, notaConfig, (msg) => updateProgress(msg));
  }

  // Terapkan nomor halaman resmi di seluruh halaman
  applyFooters(doc);

  const safeTitle = notaConfig?.title
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const filename = `${safeTitle || 'absensi-piket'}_${startDate}_sd_${endDate}.pdf`;
  doc.save(filename);
}

export async function generateSingleFormPdf(
  item: PdfAttendanceItem,
  onProgress?: ProgressCallback
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let totalOps = 0;
  if (item.mulaiUrl) totalOps++;
  if (item.selesaiUrl) totalOps++;
  if (item.aktivitasUrls) totalOps += item.aktivitasUrls.length;
  if (item.ticketUrls) totalOps += item.ticketUrls.length;
  totalOps = Math.max(totalOps, 1);
  let currentOp = 0;

  function updateProgress(msg: string) {
    currentOp++;
    if (onProgress) {
      onProgress(Math.min(currentOp, totalOps), totalOps, msg);
    }
  }

  // Header Kop Surat Resmi & Tabel Metadata (termasuk Catatan Petugas)
  let y = drawFullHeader(doc, item);

  // 1. Mulai Kerja
  if (item.mulaiUrl) {
    try {
      updateProgress('Memproses foto Mulai Kerja...');
      const img = await loadImage(item.mulaiUrl);
      const dataUrl = imageToDataUrl(img);

      const maxImgHeight = 92;
      const aspect = img.naturalWidth / img.naturalHeight;
      let imgW = CONTENT_WIDTH;
      let imgH = imgW / aspect;
      if (imgH > maxImgHeight) {
        imgH = maxImgHeight;
        imgW = imgH * aspect;
      }

      if (y + imgH + 18 > PAGE_HEIGHT - MARGIN) {
        doc.addPage();
        y = drawContinuationHeader(doc, item);
      }

      y = drawSectionHeading(doc, 'Bukti Piket — Mulai Kerja', '1', y);
      const imgX = MARGIN + (CONTENT_WIDTH - imgW) / 2;
      doc.addImage(dataUrl, 'JPEG', imgX, y, imgW, imgH);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.rect(imgX, y, imgW, imgH);
      y += imgH + 7;
    } catch (err) {
      console.error('Gagal menyertakan foto mulai:', err);
    }
  }

  // 2. Selesai Kerja
  if (item.selesaiUrl) {
    try {
      updateProgress('Memproses foto Selesai Kerja...');
      const img = await loadImage(item.selesaiUrl);
      const dataUrl = imageToDataUrl(img);

      const maxImgHeight = 92;
      const aspect = img.naturalWidth / img.naturalHeight;
      let imgW = CONTENT_WIDTH;
      let imgH = imgW / aspect;
      if (imgH > maxImgHeight) {
        imgH = maxImgHeight;
        imgW = imgH * aspect;
      }

      if (y + imgH + 18 > PAGE_HEIGHT - MARGIN) {
        doc.addPage();
        y = drawContinuationHeader(doc, item);
      }

      y = drawSectionHeading(doc, 'Bukti Piket — Selesai Kerja', '2', y);
      const imgX = MARGIN + (CONTENT_WIDTH - imgW) / 2;
      doc.addImage(dataUrl, 'JPEG', imgX, y, imgW, imgH);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.rect(imgX, y, imgW, imgH);
      y += imgH + 7;
    } catch (err) {
      console.error('Gagal menyertakan foto selesai:', err);
    }
  }

  // 3. Aktivitas Piket
  if (item.aktivitasUrls && item.aktivitasUrls.length > 0) {
    for (let aIdx = 0; aIdx < item.aktivitasUrls.length; aIdx++) {
      const aktUrl = item.aktivitasUrls[aIdx];
      try {
        updateProgress(`Memproses foto Aktivitas #${aIdx + 1}...`);
        const img = await loadImage(aktUrl);
        const dataUrl = imageToDataUrl(img);

        const maxImgHeight = 88;
        const aspect = img.naturalWidth / img.naturalHeight;
        let imgW = CONTENT_WIDTH;
        let imgH = imgW / aspect;
        if (imgH > maxImgHeight) {
          imgH = maxImgHeight;
          imgW = imgH * aspect;
        }

        if (y + imgH + 18 > PAGE_HEIGHT - MARGIN) {
          doc.addPage();
          y = drawContinuationHeader(doc, item);
        }

        y = drawSectionHeading(doc, `Bukti Aktivitas Piket #${aIdx + 1}`, `3.${aIdx + 1}`, y);
        const imgX = MARGIN + (CONTENT_WIDTH - imgW) / 2;
        doc.addImage(dataUrl, 'JPEG', imgX, y, imgW, imgH);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.rect(imgX, y, imgW, imgH);
        y += imgH + 7;
      } catch (err) {
        console.error(`Gagal menyertakan foto aktivitas #${aIdx + 1}:`, err);
      }
    }
  }

  // 4. Ticket Piket
  if (item.ticketUrls && item.ticketUrls.length > 0) {
    for (let t = 0; t < item.ticketUrls.length; t++) {
      const ticketUrl = item.ticketUrls[t];
      try {
        updateProgress(`Memproses tiket #${t + 1}...`);
        const img = await loadImage(ticketUrl);
        const dataUrl = imageToDataUrl(img);

        const maxImgHeight = 110;
        const aspect = img.naturalWidth / img.naturalHeight;
        let imgW = CONTENT_WIDTH;
        let imgH = imgW / aspect;
        if (imgH > maxImgHeight) {
          imgH = maxImgHeight;
          imgW = imgH * aspect;
        }

        if (y + imgH + 18 > PAGE_HEIGHT - MARGIN) {
          doc.addPage();
          y = drawContinuationHeader(doc, item);
        }

        y = drawSectionHeading(doc, `Picket Ticket #${t + 1}`, `4.${t + 1}`, y);
        const imgX = MARGIN + (CONTENT_WIDTH - imgW) / 2;
        doc.addImage(dataUrl, 'JPEG', imgX, y, imgW, imgH);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.rect(imgX, y, imgW, imgH);
        y += imgH + 7;
      } catch (err) {
        console.error(`Gagal menyertakan tiket #${t + 1}:`, err);
      }
    }
  }

  // Terapkan nomor halaman resmi di seluruh halaman
  applyFooters(doc);

  const jobSuffix = item.job_type ? `_${item.job_type}` : '';
  const filename = `absen-piket_${item.work_date}_shift-${item.shift_type}${jobSuffix}.pdf`;
  doc.save(filename);
}
