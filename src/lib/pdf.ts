import { jsPDF } from 'jspdf';
import { formatIndonesia } from './dates';
import { shiftNumber, jobLabel, type JobType } from './shifts';
import type { ShiftType } from './supabase/types';
import { ICONNET_LOGO_BASE64 } from './pdf-logo';

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
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 180 mm

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

// Gambar Header Utama / Kartu Eksekutif Laporan
function drawFullHeader(doc: jsPDF, item: PdfAttendanceItem): number {
  // 1. Top Decorative Brand Stripes across full page
  doc.setFillColor(2, 132, 199); // Sky-600 (ICONNET Blue)
  doc.rect(0, 0, PAGE_WIDTH, 3.2, 'F');
  doc.setFillColor(56, 189, 248); // Sky-400 accent
  doc.rect(0, 3.2, PAGE_WIDTH, 0.8, 'F');

  // 2. Executive Header Card Box
  const cardX = MARGIN;
  const cardY = 8.5;
  const cardW = CONTENT_WIDTH;
  const cardH = 34;

  // Background & border
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.35);
  doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, 'FD');

  // Left primary color bar
  doc.setFillColor(2, 132, 199);
  doc.roundedRect(cardX, cardY, 3.5, cardH, 1.5, 1.5, 'F');

  // Logo ICONNET
  try {
    doc.addImage(ICONNET_LOGO_BASE64, 'PNG', cardX + 6, cardY + 4, 30.5, 11);
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(2, 132, 199);
    doc.text('ICONNET', cardX + 6, cardY + 11);
  }

  // Document Title & Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('LAPORAN ABSENSI PIKET', cardX + 40, cardY + 8.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('DOKUMENTASI & BUKTI KEGIATAN OPERASIONAL', cardX + 40, cardY + 13);

  // Shift & Job Badges / Pills (Right Aligned)
  const shiftNum = shiftNumber(item.shift_type);
  const shiftName = item.shift_type === 'pagi' ? 'Pagi' : 'Malam';
  const shiftPillText = `SHIFT ${shiftNum} (${shiftName.toUpperCase()})`;
  const shiftPillW = 32;
  const shiftPillH = 6.5;
  const shiftPillX = cardX + cardW - shiftPillW - 6;
  const shiftPillY = cardY + 4.5;

  doc.setFillColor(238, 242, 255); // indigo-50
  doc.setDrawColor(199, 210, 254); // indigo-200
  doc.setLineWidth(0.25);
  doc.roundedRect(shiftPillX, shiftPillY, shiftPillW, shiftPillH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(67, 56, 202); // indigo-700
  doc.text(shiftPillText, shiftPillX + shiftPillW / 2, shiftPillY + 4.5, { align: 'center' });

  if (item.job_type) {
    const jobText = jobLabel(item.job_type).toUpperCase();
    const jobPillW = 24;
    const jobPillH = 6.5;
    const jobPillX = shiftPillX - jobPillW - 3;
    const jobPillY = shiftPillY;

    doc.setFillColor(240, 253, 250); // teal-50
    doc.setDrawColor(153, 246, 228); // teal-200
    doc.setLineWidth(0.25);
    doc.roundedRect(jobPillX, jobPillY, jobPillW, jobPillH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 118, 110); // teal-700
    doc.text(jobText, jobPillX + jobPillW / 2, jobPillY + 4.5, { align: 'center' });
  }

  // Divider inside Card
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.line(cardX + 6, cardY + 18, cardX + cardW - 6, cardY + 18);

  // 3-Column Metadata Row
  // Column 1: Tanggal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('TANGGAL PIKET', cardX + 6, cardY + 23);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(formatIndonesia(item.work_date), cardX + 6, cardY + 28.5);

  // Column 2: Petugas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('PETUGAS PENGISI', cardX + 75, cardY + 23);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(item.author_name?.trim() || 'Petugas Piket', cardX + 75, cardY + 28.5);

  // Column 3: Status Dokumen
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('STATUS DOKUMEN', cardX + 135, cardY + 23);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(16, 149, 110); // emerald-600
  doc.text('Terverifikasi Sistem', cardX + 135, cardY + 28.5);

  return cardY + cardH + 6; // y = 48.5 mm
}

// Gambar Header Mini pada Halaman Lanjutan (Overflow)
function drawContinuationHeader(doc: jsPDF, item: PdfAttendanceItem): number {
  doc.setFillColor(2, 132, 199);
  doc.rect(0, 0, PAGE_WIDTH, 3, 'F');
  doc.setFillColor(56, 189, 248);
  doc.rect(0, 3, PAGE_WIDTH, 0.6, 'F');

  const bannerY = 8;
  const bannerH = 10;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, bannerY, CONTENT_WIDTH, bannerH, 2, 2, 'FD');
  doc.setFillColor(2, 132, 199);
  doc.roundedRect(MARGIN, bannerY, 3, bannerH, 1, 1, 'F');

  try {
    doc.addImage(ICONNET_LOGO_BASE64, 'PNG', MARGIN + 5, bannerY + 2, 16.6, 6);
  } catch {
    // fallback
  }

  const shiftNum = shiftNumber(item.shift_type);
  const shiftName = item.shift_type === 'pagi' ? 'Pagi' : 'Malam';
  const jobText = item.job_type ? ` — ${jobLabel(item.job_type)}` : '';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Lanjutan Absensi Shift ${shiftName} (Shift ${shiftNum})${jobText} • ${formatIndonesia(item.work_date)}`,
    MARGIN + 25,
    bannerY + 6.3
  );

  return bannerY + bannerH + 6; // y = 24 mm
}

// Gambar Judul Sub-bagian Foto (Bukti Mulai, Selesai, Aktivitas, Tiket)
function drawSectionHeading(
  doc: jsPDF,
  label: string,
  badgeNum: number | string,
  y: number
): number {
  const badgeSize = 5.5;
  doc.setFillColor(2, 132, 199);
  doc.roundedRect(MARGIN, y, badgeSize, badgeSize, 1.2, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(String(badgeNum), MARGIN + badgeSize / 2, y + 4, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(label, MARGIN + badgeSize + 3, y + 4.2);

  const titleW = doc.getTextWidth(label);
  const lineStart = MARGIN + badgeSize + 5 + titleW;
  if (lineStart < PAGE_WIDTH - MARGIN) {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(lineStart, y + 2.8, PAGE_WIDTH - MARGIN, y + 2.8);
  }

  return y + badgeSize + 3.5;
}

// Gambar Kotak Catatan Piket
function drawNoteBox(doc: jsPDF, note: string, y: number): number {
  const lines = doc.splitTextToSize(note, CONTENT_WIDTH - 14);
  const boxH = Math.max(13, lines.length * 4.2 + 8);

  doc.setFillColor(254, 252, 232); // amber-50
  doc.setDrawColor(254, 240, 138); // amber-200
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, boxH, 2, 2, 'FD');

  doc.setFillColor(245, 158, 11); // amber-500
  doc.roundedRect(MARGIN, y, 2.5, boxH, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(180, 83, 9);
  doc.text('CATATAN PETUGAS', MARGIN + 5.5, y + 4.5);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(68, 64, 60);
  doc.text(lines, MARGIN + 5.5, y + 8.5);

  return y + boxH + 5;
}

// Terapkan Footer pada Seluruh Halaman Dokumen
function applyFooters(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_HEIGHT - 10, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Sistem Absensi Piket ICONNET • Dokumen Resmi', MARGIN, PAGE_HEIGHT - 6);
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

    let y = drawFullHeader(doc, item);

    // Optional Note
    if (item.note && item.note.trim().length > 0) {
      y = drawNoteBox(doc, item.note, y);
    }

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

  let y = drawFullHeader(doc, item);

  // Optional Note
  if (item.note && item.note.trim().length > 0) {
    y = drawNoteBox(doc, item.note, y);
  }

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
