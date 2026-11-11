import { jsPDF } from 'jspdf';
import { formatIndonesia } from './dates';
import { shiftNumber } from './shifts';
import type { ShiftType } from './supabase/types';

export interface PdfAttendanceItem {
  work_date: string;
  shift_type: ShiftType;
  note: string | null;
  mulaiUrl: string | null;
  selesaiUrl: string | null;
  ticketUrls: string[];
}

export interface ProgressCallback {
  (current: number, total: number, message: string): void;
}

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

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2; // 180 mm

  // Count total operations for progress
  let totalOps = 0;
  for (const a of attendances) {
    if (a.mulaiUrl) totalOps++;
    if (a.selesaiUrl) totalOps++;
    totalOps += a.ticketUrls.length;
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
    const shiftNum = shiftNumber(item.shift_type);
    const shiftName = item.shift_type === 'pagi' ? 'Pagi' : 'Malam';
    const titleText = `${formatIndonesia(item.work_date)} — Shift ${shiftName} (Shift ${shiftNum})`;

    // New page for each attendance
    if (!isFirstPage) {
      doc.addPage();
    }
    isFirstPage = false;

    let y = margin;

    // Attendance Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text(titleText, margin, y + 5);
    y += 12;

    // Optional Note
    if (item.note) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      const splitNote = doc.splitTextToSize(`Catatan: ${item.note}`, contentWidth);
      doc.text(splitNote, margin, y);
      y += splitNote.length * 4.5 + 4;
    }

    // 1. Mulai Kerja
    if (item.mulaiUrl) {
      try {
        updateProgress(`Memproses foto Mulai Kerja (${item.work_date})...`);
        const img = await loadImage(item.mulaiUrl);
        const dataUrl = imageToDataUrl(img);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
        doc.text('Mulai Kerja', margin, y + 4);
        y += 7;

        const maxImgHeight = 100;
        const aspect = img.naturalWidth / img.naturalHeight;
        let imgW = contentWidth;
        let imgH = imgW / aspect;

        if (imgH > maxImgHeight) {
          imgH = maxImgHeight;
          imgW = imgH * aspect;
        }

        // Check page overflow
        if (y + imgH > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }

        doc.addImage(dataUrl, 'JPEG', margin, y, imgW, imgH);
        y += imgH + 8;
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

        const maxImgHeight = 100;
        const aspect = img.naturalWidth / img.naturalHeight;
        let imgW = contentWidth;
        let imgH = imgW / aspect;

        if (imgH > maxImgHeight) {
          imgH = maxImgHeight;
          imgW = imgH * aspect;
        }

        // If not enough room for title + image, add page
        if (y + imgH + 10 > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
        doc.text('Selesai kerja', margin, y + 4);
        y += 7;

        doc.addImage(dataUrl, 'JPEG', margin, y, imgW, imgH);
        y += imgH + 8;
      } catch (err) {
        console.error('Gagal menyertakan foto selesai:', err);
      }
    }

    // 3. Picket Ticket (on separate page)
    if (item.ticketUrls.length > 0) {
      doc.addPage();
      let ticketY = margin;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.text(`Picket ticket shift ${shiftNum}`, margin, ticketY + 5);
      ticketY += 12;

      for (let t = 0; t < item.ticketUrls.length; t++) {
        const ticketUrl = item.ticketUrls[t];
        try {
          updateProgress(`Memproses ticket #${t + 1} (${item.work_date})...`);
          const img = await loadImage(ticketUrl);
          const dataUrl = imageToDataUrl(img);

          const maxTicketH = 140;
          const aspect = img.naturalWidth / img.naturalHeight;
          let imgW = contentWidth;
          let imgH = imgW / aspect;

          if (imgH > maxTicketH) {
            imgH = maxTicketH;
            imgW = imgH * aspect;
          }

          if (ticketY + imgH > pageHeight - margin) {
            doc.addPage();
            ticketY = margin;
          }

          doc.addImage(dataUrl, 'JPEG', margin, ticketY, imgW, imgH);
          ticketY += imgH + 6;
        } catch (err) {
          console.error(`Gagal menyertakan tiket #${t + 1}:`, err);
        }
      }
    }
  }

  // Save the PDF file
  const filename = `absensi-piket_${startDate}_sd_${endDate}.pdf`;
  doc.save(filename);
}
