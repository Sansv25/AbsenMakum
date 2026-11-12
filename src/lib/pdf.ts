import { jsPDF } from 'jspdf';
import { formatIndonesia } from './dates';
import { shiftNumber, jobLabel, type JobType } from './shifts';
import type { ShiftType } from './supabase/types';
import { PLN_LOGO_BASE64 } from './pdf-logo';

export interface PdfAttendanceItem {
  work_date: string;
  shift_type: ShiftType;
  job_type?: JobType;
  author_name?: string;
  note: string | null;
  mulaiUrl: string | null;
  selesaiUrl: string | null;
  aktivitasUrls?: string[];
  ticketUrls: string[];
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
  doc.text('Kantor Perwakilan Denpasar • Jl. Macan Kumbang, Denpasar', MARGIN + 32, kopTop + 10.8);

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
  doc.text(item.author_name?.trim() || 'Petugas Piket', MARGIN + c1W + c2W + c3W + 3, tblY + 14);

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

// Terapkan Footer pada Seluruh Halaman Dokumen
function applyFooters(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_HEIGHT - 10, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Dokumen Resmi Operasional • PT PLN Indonesia Comnets Plus (PLN Icon Plus)', MARGIN, PAGE_HEIGHT - 6);
    doc.text(`Halaman ${p} dari ${totalPages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 6, {
      align: 'right',
    });
  }
}

export async function generateAttendancePdf(
  attendances: PdfAttendanceItem[],
  startDate: string,
  endDate: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
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
  totalOps = Math.max(totalOps, 1);
  let currentOp = 0;

  function updateProgress(msg: string) {
    currentOp++;
    if (onProgress) {
      onProgress(Math.min(currentOp, totalOps), totalOps, msg);
    }
  }

  let isFirstPage = true;

  for (let i = 0; i < attendances.length; i++) {
    const item = attendances[i];

    if (!isFirstPage) {
      doc.addPage();
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

  // Terapkan nomor halaman resmi di seluruh halaman
  applyFooters(doc);

  const filename = `absensi-piket_${startDate}_sd_${endDate}.pdf`;
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
