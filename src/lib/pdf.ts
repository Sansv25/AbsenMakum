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
  authorId?: string;
  sourceName?: string;
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

// Convert HTMLImageElement to resized JPEG data URL via canvas to keep PDF compact and fast
function imageToDataUrl(img: HTMLImageElement, maxDim = 1100): string {
  const canvas = document.createElement('canvas');
  let w = img.naturalWidth || 800;
  let h = img.naturalHeight || 600;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.8);
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

interface CompactPhotoEntry {
  url: string;
  caption: string;
  subCaption?: string;
  isBuktiTf?: boolean;
}

interface OfficerPhotoGroup {
  no: string;
  name: string;
  kegiatan: string;
  photos: CompactPhotoEntry[];
}

function formatShortDateId(dateStr: string): string {
  const parts = (dateStr || '').split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

function collectPhotosFromAttendances(
  items: PdfAttendanceItem[],
  row?: NotaTableRow
): CompactPhotoEntry[] {
  const photos: CompactPhotoEntry[] = [];

  for (const item of items) {
    const jobText = item.job_type ? jobLabel(item.job_type) : 'Piket';
    const prefix = `${formatShortDateId(item.work_date)} S${shiftNumber(item.shift_type)} • ${jobText}`;

    if (item.mulaiUrl) {
      photos.push({ url: item.mulaiUrl, caption: 'Mulai Kerja', subCaption: prefix });
    }
    if (item.selesaiUrl) {
      photos.push({ url: item.selesaiUrl, caption: 'Selesai Kerja', subCaption: prefix });
    }
    if (item.aktivitasUrls && item.aktivitasUrls.length > 0) {
      item.aktivitasUrls.forEach((url, idx) => {
        photos.push({
          url,
          caption: `Aktivitas #${idx + 1}`,
          subCaption: prefix,
        });
      });
    }
    if (item.ticketUrls && item.ticketUrls.length > 0) {
      item.ticketUrls.forEach((url, idx) => {
        photos.push({
          url,
          caption: `Tiket #${idx + 1}`,
          subCaption: prefix,
        });
      });
    }
  }

  if (row?.buktiTfImageUrl) {
    const tfDetail = [
      row.namaBank?.trim(),
      row.nominal > 0 ? `Rp ${Math.round(row.nominal).toLocaleString('en-US')}` : '',
    ]
      .filter(Boolean)
      .join(' • ');
    photos.push({
      url: row.buktiTfImageUrl,
      caption: 'Bukti Transfer',
      subCaption: tfDetail || row.namaPenerima,
      isBuktiTf: true,
    });
  }

  return photos;
}

function buildSectionPhotoGroups(
  rows: NotaTableRow[],
  rowAttendanceMap: Map<string, PdfAttendanceItem[]>,
  unmatchedAttendances: PdfAttendanceItem[]
): OfficerPhotoGroup[] {
  const groups: OfficerPhotoGroup[] = [];

  for (const row of rows) {
    const items = rowAttendanceMap.get(row.id) ?? [];
    const photos = collectPhotosFromAttendances(items, row);
    if (photos.length > 0) {
      groups.push({
        no: row.no,
        name: row.namaPenerima?.trim() || 'Petugas Piket',
        kegiatan: row.kegiatan?.trim() || '',
        photos,
      });
    }
  }

  if (unmatchedAttendances.length > 0) {
    const byOfficer = new Map<string, PdfAttendanceItem[]>();
    for (const att of unmatchedAttendances) {
      const k = att.author_id || `name:${(att.author_name || 'Petugas Piket').trim().toLowerCase()}`;
      if (!byOfficer.has(k)) byOfficer.set(k, []);
      byOfficer.get(k)!.push(att);
    }
    for (const items of byOfficer.values()) {
      const photos = collectPhotosFromAttendances(items);
      if (photos.length > 0) {
        groups.push({
          no: '',
          name: items[0].author_name?.trim() || 'Petugas Piket',
          kegiatan: '',
          photos,
        });
      }
    }
  }

  return groups;
}

function drawCompactOfficerBar(
  doc: jsPDF,
  group: OfficerPhotoGroup,
  variant: 'magang' | 'freelance',
  y: number,
  isContinuation = false
): number {
  const isFreelance = variant === 'freelance';
  doc.setFillColor(isFreelance ? 240 : 239, isFreelance ? 253 : 246, isFreelance ? 250 : 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.rect(NOTA_MARGIN, y, 273, 6.2, 'FD');

  doc.setFillColor(isFreelance ? 13 : 37, isFreelance ? 148 : 99, isFreelance ? 136 : 235);
  doc.rect(NOTA_MARGIN, y, 1.8, 6.2, 'F');

  const prefixNo = group.no ? `${group.no}. ` : '';
  const suffix = isContinuation ? ' (lanjutan)' : '';
  const nameLabel = `${prefixNo}${group.name}${suffix}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(nameLabel, NOTA_MARGIN + 3.5, y + 4.3);

  const nameW = doc.getTextWidth(nameLabel);
  const infoParts = [group.kegiatan, `${group.photos.length} foto`].filter(Boolean).join(' • ');
  if (infoParts) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    const maxInfoW = 273 - nameW - 8;
    const clipped = doc.splitTextToSize(infoParts, Math.max(maxInfoW, 30))[0] || '';
    doc.text(clipped, NOTA_MARGIN + 5.5 + nameW, y + 4.3);
  }

  return y + 7.5;
}

async function drawCompactPhotoSection(
  doc: jsPDF,
  bannerTitle: string,
  groups: OfficerPhotoGroup[],
  startY: number,
  variant: 'magang' | 'freelance',
  onProgress: (msg: string) => void
): Promise<number> {
  if (groups.length === 0) return startY;

  const COLS = 4;
  const GAP = 3;
  const CARD_W = (273 - GAP * (COLS - 1)) / COLS; // 66 mm
  const HEADER_H = 7.2;
  const IMG_BOX_H = 43.5;
  const CARD_H = HEADER_H + IMG_BOX_H + 1.5; // 52.2 mm

  let y = startY;

  // Pastikan judul seksi + bar petugas pertama + 1 baris foto muat di halaman ini
  if (y + 8 + 7.5 + CARD_H > NOTA_MAX_Y) {
    doc.addPage('a4', 'landscape');
    y = 14;
  }

  // Section Banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(bannerTitle, NOTA_MARGIN, y + 4);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(NOTA_MARGIN, y + 5.8, NOTA_MARGIN + 273, y + 5.8);
  y += 8.5;

  for (const group of groups) {
    if (y + 7.5 + CARD_H > NOTA_MAX_Y) {
      doc.addPage('a4', 'landscape');
      y = 14;
    }

    y = drawCompactOfficerBar(doc, group, variant, y, false);

    for (let i = 0; i < group.photos.length; i += COLS) {
      const rowPhotos = group.photos.slice(i, i + COLS);

      if (i > 0 && y + CARD_H > NOTA_MAX_Y) {
        doc.addPage('a4', 'landscape');
        y = 14;
        y = drawCompactOfficerBar(doc, group, variant, y, true);
      }

      for (let col = 0; col < rowPhotos.length; col++) {
        const photo = rowPhotos[col];
        const cardX = NOTA_MARGIN + col * (CARD_W + GAP);

        onProgress(`Memproses ${photo.caption} (${group.name})...`);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(photo.isBuktiTf ? 59 : 203, photo.isBuktiTf ? 130 : 213, photo.isBuktiTf ? 246 : 225);
        doc.setLineWidth(photo.isBuktiTf ? 0.35 : 0.2);
        doc.rect(cardX, y, CARD_W, CARD_H, 'FD');

        // Header label inside photo card
        if (photo.isBuktiTf) {
          doc.setFillColor(239, 246, 255);
        } else {
          doc.setFillColor(248, 250, 252);
        }
        doc.rect(cardX, y, CARD_W, HEADER_H, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.line(cardX, y + HEADER_H, cardX + CARD_W, y + HEADER_H);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(photo.isBuktiTf ? 29 : 15, photo.isBuktiTf ? 78 : 23, photo.isBuktiTf ? 216 : 42);
        doc.text(photo.caption, cardX + 1.8, y + 3.1);

        if (photo.subCaption) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.8);
          doc.setTextColor(100, 116, 139);
          const subLine = doc.splitTextToSize(photo.subCaption, CARD_W - 3.6)[0] || '';
          doc.text(subLine, cardX + 1.8, y + 6);
        }

        try {
          const img = await loadImage(photo.url);
          const dataUrl = imageToDataUrl(img, 1100);
          const maxImgW = CARD_W - 2.4;
          const maxImgH = IMG_BOX_H - 1.2;
          const aspect = (img.naturalWidth || 1) / (img.naturalHeight || 1);
          let imgW = maxImgW;
          let imgH = imgW / aspect;
          if (imgH > maxImgH) {
            imgH = maxImgH;
            imgW = imgH * aspect;
          }
          const imgX = cardX + (CARD_W - imgW) / 2;
          const imgY = y + HEADER_H + 0.8 + (maxImgH - imgH) / 2;
          doc.addImage(dataUrl, 'JPEG', imgX, imgY, imgW, imgH);
        } catch (err) {
          console.error(`Gagal memuat gambar (${photo.caption}):`, err);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(6.5);
          doc.setTextColor(148, 163, 184);
          doc.text('Gambar tidak dapat dimuat', cardX + CARD_W / 2, y + HEADER_H + IMG_BOX_H / 2, {
            align: 'center',
          });
        }
      }

      y += CARD_H + 2.5;
    }

    y += 1.5;
  }

  return y;
}

function matchAttendanceToRow(att: PdfAttendanceItem, rows: NotaTableRow[]): NotaTableRow | undefined {
  const attName = att.author_name?.trim().toLowerCase() || '';
  return rows.find((row) => {
    if (row.authorId && att.author_id && row.authorId === att.author_id) {
      return true;
    }
    if (row.sourceName && attName && row.sourceName.trim().toLowerCase() === attName) {
      return true;
    }
    if (row.namaPenerima && attName && row.namaPenerima.trim().toLowerCase() === attName) {
      return true;
    }
    return false;
  });
}

async function generateNotaWithCompactDocs(
  doc: jsPDF,
  attendances: PdfAttendanceItem[],
  notaConfig: NotaPdfConfig,
  updateProgress: (msg: string) => void
): Promise<void> {
  const rowAttendanceMap = new Map<string, PdfAttendanceItem[]>();
  const unmatchedMagang: PdfAttendanceItem[] = [];
  const unmatchedFreelance: PdfAttendanceItem[] = [];

  for (const att of attendances) {
    const matchedFreelance = matchAttendanceToRow(att, notaConfig.freelanceRows);
    if (matchedFreelance) {
      if (!rowAttendanceMap.has(matchedFreelance.id)) rowAttendanceMap.set(matchedFreelance.id, []);
      rowAttendanceMap.get(matchedFreelance.id)!.push(att);
      continue;
    }

    const matchedMagang = matchAttendanceToRow(att, notaConfig.magangRows);
    if (matchedMagang) {
      if (!rowAttendanceMap.has(matchedMagang.id)) rowAttendanceMap.set(matchedMagang.id, []);
      rowAttendanceMap.get(matchedMagang.id)!.push(att);
      continue;
    }

    if (att.author_roles?.includes('freelance')) {
      unmatchedFreelance.push(att);
    } else {
      unmatchedMagang.push(att);
    }
  }

  const magangGroups = buildSectionPhotoGroups(
    notaConfig.magangRows,
    rowAttendanceMap,
    unmatchedMagang
  );
  const freelanceGroups = buildSectionPhotoGroups(
    notaConfig.freelanceRows,
    rowAttendanceMap,
    unmatchedFreelance
  );

  const includeEmpty = Boolean(notaConfig.includeEmptyTables);
  const hasMagangSection = notaConfig.magangRows.length > 0 || includeEmpty || magangGroups.length > 0;
  const hasFreelanceSection = notaConfig.freelanceRows.length > 0 || includeEmpty || freelanceGroups.length > 0;

  let y = 16;

  if (notaConfig.title && notaConfig.title.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    const titleLines = doc.splitTextToSize(notaConfig.title.trim(), 273);
    for (const line of titleLines) {
      doc.text(line, NOTA_PAGE_W / 2, y, { align: 'center' });
      y += 6.5;
    }
    y += 2;
  }

  // 1. BAGIAN MAGANG: Tabel Komisi Penjualan Magang -> Foto Dokumentasi & Bukti TF Magang
  if (hasMagangSection) {
    y = drawNotaTableSection(
      doc,
      notaConfig.magangTitle?.trim() || 'Komisi Penjualan Magang',
      notaConfig.magangRows,
      y
    );

    if (magangGroups.length > 0) {
      await drawCompactPhotoSection(
        doc,
        'DOKUMENTASI PIKET & BUKTI TRANSFER — MAGANG',
        magangGroups,
        y,
        'magang',
        updateProgress
      );
    }
  }

  // 2. BAGIAN FREELANCE: Halaman Baru -> Tabel Komisi Penjualan Freelance -> Foto Dokumentasi & Bukti TF Freelance
  if (hasFreelanceSection) {
    if (hasMagangSection) {
      doc.addPage('a4', 'landscape');
      y = 14;
    }

    y = drawNotaTableSection(
      doc,
      notaConfig.freelanceTitle?.trim() || 'Komisi Penjualan Freelance',
      notaConfig.freelanceRows,
      y
    );

    if (freelanceGroups.length > 0) {
      await drawCompactPhotoSection(
        doc,
        'DOKUMENTASI PIKET & BUKTI TRANSFER — FREELANCE',
        freelanceGroups,
        y,
        'freelance',
        updateProgress
      );
    }
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
    await generateNotaWithCompactDocs(doc, attendances, notaConfig, updateProgress);
  } else {
    let isFirstPage = true;

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
