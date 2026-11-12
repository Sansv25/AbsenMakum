'use client';

import { useRef, useState, useEffect } from 'react';
import { Camera, Upload, Trash2, Loader2, CheckCircle2, Lock, ZoomIn } from 'lucide-react';
import { CameraModal } from './camera-modal';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { compressImage } from '@/lib/image';
import { createClient } from '@/lib/supabase/client';
import { showAlert, showConfirm, showToast } from '@/lib/swal';
import { claimDeviceAction } from '@/app/(app)/absen/[date]/[shift]/actions';
import type { AttachmentWithUrl } from '@/lib/data/attendance';
import type { AttachmentKind, ShiftType } from '@/lib/supabase/types';

interface SingleUploadProps {
  title: string;
  kind: AttachmentKind; // 'mulai' | 'selesai'
  attendanceId: string;
  userId: string;
  userName?: string;
  workDate: string;
  shiftType: ShiftType;
  initialAttachment?: AttachmentWithUrl | null;
  onSaved: (attachment?: AttachmentWithUrl | null) => void;
  canEdit?: boolean;
  onOpenLightbox?: (url: string) => void;
}

export function SingleUpload({
  title,
  kind,
  attendanceId,
  userId,
  userName,
  workDate,
  shiftType,
  initialAttachment,
  onSaved,
  canEdit = true,
  onOpenLightbox,
}: SingleUploadProps) {
  const [attachment, setAttachment] = useState<AttachmentWithUrl | null>(
    initialAttachment ?? null
  );

  useEffect(() => {
    setAttachment(initialAttachment ?? null);
  }, [initialAttachment, attendanceId]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileProcess(file: File) {
    try {
      setUploading(true);
      setStatusMsg('Mengompres gambar...');

      // 1. Kompres gambar
      const compressed = await compressImage(file);

      setStatusMsg('Mengunggah...');
      const supabase = createClient();

      // 2. Jika sudah ada file lama, hapus dari storage dan db
      if (attachment) {
        await supabase.storage.from('evidence').remove([attachment.storage_path]);
        await supabase.from('attachments').delete().eq('id', attachment.id);
      }

      // 3. Upload file baru ke Storage
      const uuid = crypto.randomUUID();
      const storagePath = `${userId}/${workDate}/${shiftType}/${kind}-${uuid}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(storagePath, compressed, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      // 4. Simpan baris ke tabel attachments
      const { data: inserted, error: dbError } = await supabase
        .from('attachments')
        .insert({
          attendance_id: attendanceId,
          user_id: userId,
          kind,
          storage_path: storagePath,
          sort_order: 0,
        })
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);

      // 4.5 Pastikan attendance tercatat atas nama akun user yang mengunggah
      try {
        await claimDeviceAction(attendanceId);
      } catch {
        // non-blocking
      }

      // 5. Buat signed URL untuk pratinjau langsung
      const { data: signed } = await supabase.storage
        .from('evidence')
        .createSignedUrl(storagePath, 3600);

      const newAttachment = {
        ...inserted,
        signedUrl: signed?.signedUrl ?? null,
      };

      setAttachment(newAttachment);

      setStatusMsg('Tersimpan');
      showToast(`Foto ${title} berhasil disimpan`, 'success');
      setTimeout(() => setStatusMsg(null), 3000);
      onSaved(newAttachment);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunggah foto.';
      showAlert('Gagal Unggah', msg, 'error');
      setStatusMsg(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!attachment) return;
    const confirmed = await showConfirm(
      'Hapus Foto?',
      `Apakah Anda yakin ingin menghapus foto ${title}?`,
      'Ya, Hapus',
      true
    );
    if (!confirmed) return;

    // Optimistic UI update: langsung hilangkan foto dari tampilan agar responsif
    const prevAttachment = attachment;
    setAttachment(null);

    try {
      setDeleting(true);
      const supabase = createClient();

      // Hapus paralel dari Storage & DB
      await Promise.all([
        supabase.storage.from('evidence').remove([prevAttachment.storage_path]),
        supabase.from('attachments').delete().eq('id', prevAttachment.id),
      ]);

      showToast(`Foto ${title} berhasil dihapus`, 'info');
      onSaved(null);
    } catch {
      setAttachment(prevAttachment);
      showAlert('Gagal', 'Terjadi kesalahan saat menghapus foto.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2">
          {title}
          {attachment && (
            <span className="text-xs font-normal text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Ada foto
            </span>
          )}
        </h3>
        {statusMsg && (
          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            {statusMsg}
          </span>
        )}
      </div>

      {attachment?.signedUrl ? (
        <div className="space-y-3">
          <div
            onClick={() => {
              if (attachment?.signedUrl) {
                if (onOpenLightbox) {
                  onOpenLightbox(attachment.signedUrl);
                } else {
                  setLightboxOpen(true);
                }
              }
            }}
            className="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 bg-black/5 dark:bg-black/30 aspect-[4/3] flex items-center justify-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-all shadow-xs"
            title="Klik untuk memperbesar / Fullscreen (bisa di-zoom)"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.signedUrl}
              alt={title}
              className="w-full h-full object-contain group-hover:scale-[1.01] transition-transform duration-200"
            />
            {/* Zoom pill indicator */}
            <div className="absolute bottom-2.5 right-2.5 bg-black/65 hover:bg-black/85 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-md pointer-events-none transition-colors">
              <ZoomIn className="h-3.5 w-3.5" />
              <span>Perbesar / Fullscreen</span>
            </div>
          </div>

          {canEdit ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || deleting}
                className="flex-1 py-2 px-3 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-medium rounded-xl transition-colors min-h-[44px] flex items-center justify-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Ganti File
              </button>
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                disabled={uploading || deleting}
                className="flex-1 py-2 px-3 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-medium rounded-xl transition-colors min-h-[44px] flex items-center justify-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Ganti Kamera
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={uploading || deleting}
                className="p-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-800 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Hapus Foto"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            <div className="text-center py-1">
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-full border border-gray-100 dark:border-slate-700">
                <Lock className="h-3 w-3" /> Foto tersimpan (Mode Hanya-Lihat)
              </span>
            </div>
          )}
        </div>
      ) : canEdit ? (
        <div className="border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl p-6 text-center space-y-4 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50/40 dark:bg-slate-800/30 transition-colors">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Ambil foto selfie di meja kerja dengan kamera atau pilih dari galeri perangkat.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={uploading}
              className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-medium text-xs rounded-xl transition-colors min-h-[44px] flex items-center justify-center gap-2 shadow-sm"
            >
              <Camera className="h-4 w-4" />
              Ambil Foto (Kamera)
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="py-2.5 px-4 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:bg-gray-100 dark:disabled:bg-slate-800 text-gray-700 dark:text-slate-200 font-medium text-xs rounded-xl transition-colors min-h-[44px] flex items-center justify-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Pilih dari File
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-gray-200 dark:border-slate-700 rounded-2xl p-6 text-center space-y-1">
          <Lock className="h-5 w-5 mx-auto text-gray-300 dark:text-slate-600" />
          <p className="text-xs text-gray-400 dark:text-slate-400">Belum ada foto yang diunggah (Terkunci).</p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileProcess(file);
            e.target.value = '';
          }
        }}
      />

      <CameraModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => handleFileProcess(file)}
        userName={userName}
        initialFacingMode="user"
      />

      {!onOpenLightbox && (
        <ImageLightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={attachment?.signedUrl ? [{ src: attachment.signedUrl, title }] : []}
        />
      )}
    </div>
  );
}
