'use client';

import { useRef, useState } from 'react';
import { Camera, Upload, Trash2, Loader2, CheckCircle2, Lock } from 'lucide-react';
import { CameraModal } from './camera-modal';
import { compressImage } from '@/lib/image';
import { createClient } from '@/lib/supabase/client';
import { showAlert, showConfirm, showToast } from '@/lib/swal';
import type { AttachmentWithUrl } from '@/lib/data/attendance';
import type { AttachmentKind, ShiftType } from '@/lib/supabase/types';

interface SingleUploadProps {
  title: string;
  kind: AttachmentKind; // 'mulai' | 'selesai'
  attendanceId: string;
  userId: string;
  workDate: string;
  shiftType: ShiftType;
  initialAttachment?: AttachmentWithUrl | null;
  onSaved: () => void;
  canEdit?: boolean;
}

export function SingleUpload({
  title,
  kind,
  attendanceId,
  userId,
  workDate,
  shiftType,
  initialAttachment,
  onSaved,
  canEdit = true,
}: SingleUploadProps) {
  const [attachment, setAttachment] = useState<AttachmentWithUrl | null>(
    initialAttachment ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
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

      // 5. Buat signed URL untuk pratinjau langsung
      const { data: signed } = await supabase.storage
        .from('evidence')
        .createSignedUrl(storagePath, 3600);

      setAttachment({
        ...inserted,
        signedUrl: signed?.signedUrl ?? null,
      });

      setStatusMsg('Tersimpan');
      showToast(`Foto ${title} berhasil disimpan`, 'success');
      setTimeout(() => setStatusMsg(null), 3000);
      onSaved();
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

    try {
      setDeleting(true);
      const supabase = createClient();

      // Hapus dari Storage
      await supabase.storage.from('evidence').remove([attachment.storage_path]);

      // Hapus dari DB
      await supabase.from('attachments').delete().eq('id', attachment.id);

      setAttachment(null);
      setStatusMsg('Foto terhapus');
      showToast(`Foto ${title} berhasil dihapus`, 'info');
      setTimeout(() => setStatusMsg(null), 3000);
      onSaved();
    } catch {
      showAlert('Gagal', 'Terjadi kesalahan saat menghapus foto.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          {title}
          {attachment && (
            <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Ada foto
            </span>
          )}
        </h3>
        {statusMsg && (
          <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            {statusMsg}
          </span>
        )}
      </div>

      {attachment?.signedUrl ? (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-black/5 aspect-[4/3] flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.signedUrl}
              alt={title}
              className="w-full h-full object-contain"
            />
          </div>

          {canEdit ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || deleting}
                className="flex-1 py-2 px-3 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-xl transition-colors min-h-[44px] flex items-center justify-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Ganti File
              </button>
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                disabled={uploading || deleting}
                className="flex-1 py-2 px-3 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-xl transition-colors min-h-[44px] flex items-center justify-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Ganti Kamera
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={uploading || deleting}
                className="p-2.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Hapus Foto"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            <div className="text-center py-1">
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                <Lock className="h-3 w-3" /> Foto tersimpan (Mode Hanya-Lihat)
              </span>
            </div>
          )}
        </div>
      ) : canEdit ? (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center space-y-4 hover:border-blue-400 transition-colors">
          <p className="text-xs text-gray-500">
            Ambil foto selfie di meja kerja dengan kamera atau pilih dari galeri perangkat.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={uploading}
              className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium text-xs rounded-xl transition-colors min-h-[44px] flex items-center justify-center gap-2 shadow-sm"
            >
              <Camera className="h-4 w-4" />
              Ambil Foto (Kamera)
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="py-2.5 px-4 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 font-medium text-xs rounded-xl transition-colors min-h-[44px] flex items-center justify-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Pilih dari File
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center space-y-1">
          <Lock className="h-5 w-5 mx-auto text-gray-300" />
          <p className="text-xs text-gray-400">Belum ada foto yang diunggah (Terkunci).</p>
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
      />
    </div>
  );
}
