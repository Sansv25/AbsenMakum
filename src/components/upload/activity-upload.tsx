'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clipboard,
  ZoomIn,
  Eye,
} from 'lucide-react';
import { CameraModal } from './camera-modal';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { compressImage, isImageFile } from '@/lib/image';
import { createClient } from '@/lib/supabase/client';
import { showAlert, showConfirm, showToast } from '@/lib/swal';
import { claimDeviceAction } from '@/app/(app)/absen/[date]/[shift]/actions';
import type { AttachmentWithUrl } from '@/lib/data/attendance';
import type { ShiftType } from '@/lib/supabase/types';

interface ActivityUploadProps {
  attendanceId: string;
  userId: string;
  userName?: string;
  workDate: string;
  shiftType: ShiftType;
  initialAttachments: AttachmentWithUrl[];
  onSaved: (items?: AttachmentWithUrl[]) => void;
  canEdit?: boolean;
  onOpenLightbox?: (url: string) => void;
  isPhotoRestricted?: boolean;
}

export function ActivityUpload({
  attendanceId,
  userId,
  userName,
  workDate,
  shiftType,
  initialAttachments,
  onSaved,
  canEdit = true,
  onOpenLightbox,
  isPhotoRestricted = false,
}: ActivityUploadProps) {
  const [items, setItems] = useState<AttachmentWithUrl[]>(
    initialAttachments.filter((a) => a.kind === 'aktivitas')
  );

  useEffect(() => {
    setItems(initialAttachments.filter((a) => a.kind === 'aktivitas'));
  }, [initialAttachments]);

  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const count = items.length;
  const isFulfilled = count >= 2;

  async function handleFileProcess(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(isImageFile);

    if (validFiles.length === 0) {
      showAlert('Format Tidak Didukung', 'Harap pilih file gambar yang valid (JPG, PNG, WebP, HEIC).', 'warning');
      return;
    }

    try {
      setUploading(true);
      const supabase = createClient();
      let currentOrder = items.length;

      const newItems: AttachmentWithUrl[] = [];

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];

        setStatusMsg(`Mengompres foto ${i + 1} dari ${validFiles.length} (~2MB)...`);
        const compressed = await compressImage(file);

        setStatusMsg(`Mengunggah foto ${i + 1} dari ${validFiles.length}...`);
        const uuid = crypto.randomUUID();
        const storagePath = `${userId}/${workDate}/${shiftType}/aktivitas-${uuid}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('evidence')
          .upload(storagePath, compressed, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw new Error(uploadError.message);

        const { data: inserted, error: dbError } = await supabase
          .from('attachments')
          .insert({
            attendance_id: attendanceId,
            user_id: userId,
            kind: 'aktivitas',
            storage_path: storagePath,
            sort_order: currentOrder++,
          })
          .select()
          .single();

        if (dbError) throw new Error(dbError.message);

        const { data: signed } = await supabase.storage
          .from('evidence')
          .createSignedUrl(storagePath, 3600);

        newItems.push({
          ...inserted,
          signedUrl: signed?.signedUrl ?? null,
          fileSize: compressed.size,
        });

        // Pastikan attendance tercatat atas nama akun user yang mengunggah
        try {
          await claimDeviceAction(attendanceId, workDate, shiftType);
        } catch {
          // ignore
        }
      }

      showToast('Foto aktivitas berhasil diunggah!', 'success');
      const allCurrent = [...items, ...newItems];
      setItems(allCurrent);
      onSaved(allCurrent);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunggah foto.';
      showAlert('Gagal Unggah', msg, 'error');
    } finally {
      setUploading(false);
      setStatusMsg(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Listen for Ctrl+V (paste) on window
  useEffect(() => {
    if (!canEdit) return;

    function handleWindowPaste(e: ClipboardEvent) {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'TEXTAREA' ||
          (activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).type === 'text'))
      ) {
        return;
      }

      const files: File[] = [];
      if (e.clipboardData?.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
      } else if (e.clipboardData?.files) {
        for (let i = 0; i < e.clipboardData.files.length; i++) {
          const file = e.clipboardData.files[i];
          if (file.type.startsWith('image/')) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        showToast('Screenshot terdeteksi dari clipboard!', 'info');
        handleFileProcess(files);
      }
    }

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [canEdit, items.length, attendanceId]);

  async function handlePasteClipboard() {
    if (!canEdit || uploading) return;
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        showAlert(
          'Paste Screenshot',
          'Silakan gunakan pintasan keyboard Ctrl + V untuk menempelkan screenshot secara langsung.',
          'info'
        );
        return;
      }

      setStatusMsg('Membaca clipboard...');
      const clipboardItems = await navigator.clipboard.read();
      const imageFiles: File[] = [];

      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const ext = type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
            const file = new File([blob], `screenshot-${Date.now()}.${ext}`, { type });
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length === 0) {
        showAlert(
          'Tidak Ada Gambar di Clipboard',
          'Clipboard belum berisi gambar. Silakan salin gambar atau ambil screenshot (Windows: Win + Shift + S atau PrtScn), lalu klik tombol ini lagi atau tekan Ctrl + V.',
          'info'
        );
        setStatusMsg(null);
        return;
      }

      await handleFileProcess(imageFiles);
    } catch (err: unknown) {
      console.warn('Clipboard read error:', err);
      showAlert(
        'Akses Clipboard',
        'Tidak dapat membaca clipboard secara otomatis dari tombol browser. Anda dapat langsung menekan Ctrl + V pada keyboard.',
        'info'
      );
      setStatusMsg(null);
    }
  }

  async function handleDelete(item: AttachmentWithUrl) {
    if (!canEdit) return;

    const confirmed = await showConfirm(
      'Hapus Foto Aktivitas Ini?',
      'Foto yang dihapus tidak dapat dipulihkan.',
      'Ya, Hapus'
    );
    if (!confirmed) return;

    // Optimistic UI update: hapus seketika dari tampilan agar sangat responsif
    const previousItems = items;
    setItems((prev) => prev.filter((x) => x.id !== item.id));

    try {
      setDeletingId(item.id);
      const supabase = createClient();

      // Hapus Storage dan DB secara paralel
      await Promise.all([
        supabase.storage.from('evidence').remove([item.storage_path]),
        supabase.from('attachments').delete().eq('id', item.id),
      ]);

      const remaining = previousItems.filter((x) => x.id !== item.id);
      showToast('Foto aktivitas berhasil dihapus.', 'info');
      onSaved(remaining);
    } catch (err: unknown) {
      // Rollback jika terjadi kesalahan jaringan
      setItems(previousItems);
      const msg = err instanceof Error ? err.message : 'Gagal menghapus foto.';
      showAlert('Gagal', msg, 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm sm:text-base">
              3. Bukti Aktivitas Piket
            </h3>
            {isFulfilled ? (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 font-semibold border border-green-200 dark:border-green-800 inline-flex items-center gap-1 whitespace-nowrap">
                <CheckCircle2 className="h-3 w-3" /> {count} Foto (Lengkap)
              </span>
            ) : count === 1 ? (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 font-semibold border border-amber-300 dark:border-amber-800 inline-flex items-center gap-1 whitespace-nowrap">
                <AlertCircle className="h-3 w-3" /> 1 / 2 Foto (Kurang 1 Foto)
              </span>
            ) : (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 font-semibold border border-red-200 dark:border-red-800 inline-flex items-center gap-1 whitespace-nowrap">
                <AlertCircle className="h-3 w-3" /> Wajib Minimal 2 Foto
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Unggah foto dokumentasi kegiatan piket yang sedang berjalan (minimal 2 foto berbeda).
          </p>
        </div>

        {/* Action Buttons if canEdit */}
        {canEdit && (
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <button
              type="button"
              onClick={handlePasteClipboard}
              disabled={uploading}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 min-h-[38px] shadow-2xs"
              title="Paste screenshot langsung dari clipboard (atau tekan Ctrl + V)"
            >
              <Clipboard className="h-4 w-4" />
              <span>Paste Screenshot</span>
            </button>

            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={uploading}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm min-h-[38px]"
              title="Ambil foto menggunakan kamera"
            >
              <Camera className="h-4 w-4" />
              <span>Kamera</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 min-h-[38px]"
              title="Pilih file foto dari galeri"
            >
              <Upload className="h-4 w-4" />
              <span>Galeri</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  handleFileProcess(e.target.files);
                  e.target.value = '';
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {uploading && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-700 dark:text-blue-400 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
          <span>{statusMsg || 'Sedang memproses foto aktivitas...'}</span>
        </div>
      )}

      {/* Grid Foto Aktivitas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Render uploaded photos */}
        {items.map((item, idx) => (
          <div
            key={item.id}
            onClick={() => {
              if (isPhotoRestricted) return;
              if (item.signedUrl) {
                if (onOpenLightbox) {
                  onOpenLightbox(item.signedUrl);
                } else {
                  setLightboxIndex(idx);
                  setLightboxOpen(true);
                }
              }
            }}
            className={`group relative aspect-video sm:aspect-square bg-gray-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 shadow-xs transition-all ${
              isPhotoRestricted
                ? 'cursor-not-allowed select-none'
                : 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500'
            }`}
            title={
              isPhotoRestricted
                ? 'Petugas hanya bisa lihat absensi di hari itu'
                : 'Klik untuk perbesar / Fullscreen (bisa di-zoom)'
            }
          >
            {item.signedUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.signedUrl}
                alt={`Aktivitas ${idx + 1}`}
                style={isPhotoRestricted ? { filter: 'blur(14px)' } : undefined}
                className={`w-full h-full object-cover ${
                  isPhotoRestricted
                    ? 'scale-110 pointer-events-none'
                    : 'group-hover:scale-[1.02] transition-transform duration-200'
                }`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                Memuat foto...
              </div>
            )}

            {isPhotoRestricted ? (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-center text-white select-none z-10">
                <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center mb-1 text-white shadow-sm ring-1 ring-white/30">
                  <Eye className="h-4 w-4" />
                </div>
                <p className="text-[10px] sm:text-[11px] font-semibold text-white drop-shadow leading-tight max-w-[90%]">
                  Petugas hanya bisa lihat absensi di hari itu
                </p>
              </div>
            ) : (
              <>
                {/* Badge urutan foto */}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-semibold z-10">
                  Aktivitas #{idx + 1}
                </span>

                {/* Quick action buttons */}
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  {item.signedUrl && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenLightbox) {
                          onOpenLightbox(item.signedUrl!);
                        } else {
                          setLightboxIndex(idx);
                          setLightboxOpen(true);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white transition-colors"
                      title="Perbesar / Fullscreen"
                      aria-label="Perbesar / Fullscreen"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {canEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item);
                  }}
                  disabled={deletingId === item.id}
                  className="p-1.5 rounded-lg bg-red-600/90 hover:bg-red-700 active:scale-95 text-white transition-all shadow-xs"
                  title="Hapus foto ini"
                  aria-label="Hapus foto ini"
                >
                  {deletingId === item.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>

            {/* Hover overlay hint */}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <span className="text-[11px] text-white/95 bg-black/65 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-md">
                <ZoomIn className="h-3.5 w-3.5" />
                <span>Klik untuk Zoom</span>
              </span>
            </div>
          </>
        )}
      </div>
        ))}

        {/* Placeholders for unfilled required slots (Slot 1 & Slot 2) */}
        {count === 0 && (
          <>
            <div
              onClick={() => canEdit && setCameraOpen(true)}
              className={`aspect-video sm:aspect-square rounded-2xl border-2 border-dashed border-red-300 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 p-3 sm:p-4 flex flex-col items-center justify-center text-center gap-1.5 transition-all ${
                canEdit ? 'hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer active:scale-[0.98]' : ''
              }`}
              title={canEdit ? 'Klik untuk mengambil Foto Aktivitas #1 via Kamera' : undefined}
            >
              <div className="h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shadow-2xs">
                <Camera className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-red-700 dark:text-red-400">
                Foto Aktivitas #1
              </span>
              <span className="text-[10px] text-red-500 font-medium">
                Wajib Diisi {canEdit ? '• Ketuk Kamera' : ''}
              </span>
            </div>

            <div
              onClick={() => canEdit && setCameraOpen(true)}
              className={`aspect-video sm:aspect-square rounded-2xl border-2 border-dashed border-red-300 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 p-3 sm:p-4 flex flex-col items-center justify-center text-center gap-1.5 transition-all ${
                canEdit ? 'hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer active:scale-[0.98]' : ''
              }`}
              title={canEdit ? 'Klik untuk mengambil Foto Aktivitas #2 via Kamera' : undefined}
            >
              <div className="h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shadow-2xs">
                <Camera className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-red-700 dark:text-red-400">
                Foto Aktivitas #2
              </span>
              <span className="text-[10px] text-red-500 font-medium">
                Wajib Diisi {canEdit ? '• Ketuk Kamera' : ''}
              </span>
            </div>
          </>
        )}

        {count === 1 && (
          <div
            onClick={() => canEdit && setCameraOpen(true)}
            className={`aspect-video sm:aspect-square rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-3 sm:p-4 flex flex-col items-center justify-center text-center gap-1.5 transition-all ${
              canEdit ? 'hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer active:scale-[0.98]' : ''
            }`}
            title={canEdit ? 'Klik untuk mengambil Foto Aktivitas #2 via Kamera' : undefined}
          >
            <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shadow-2xs">
              <Camera className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-amber-800 dark:text-amber-400">
              Foto Aktivitas #2
            </span>
            <span className="text-[10px] text-amber-600 font-medium">
              Wajib (Kurang 1 Foto) {canEdit ? '• Ketuk Kamera' : ''}
            </span>
          </div>
        )}

        {/* Slot tambah foto tambahan jika sudah memenuhi minimal 2 */}
        {count >= 2 && canEdit && (
          <div
            onClick={() => setCameraOpen(true)}
            className="aspect-video sm:aspect-square rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 bg-gray-50/50 dark:bg-slate-800/40 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 p-3 sm:p-4 flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
            title="Klik untuk menambah foto via Kamera"
          >
            <div className="h-9 w-9 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-2xs">
              <Camera className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
              Tambah Foto
            </span>
            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">
              (Opsional) • Ketuk Kamera
            </span>
          </div>
        )}
      </div>

      {/* Modal Kamera */}
      <CameraModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => {
          setCameraOpen(false);
          handleFileProcess([file]);
        }}
        userName={userName}
        initialFacingMode="environment"
      />

      {/* Lightbox fallback jika tidak menggunakan shared lightbox */}
      {!onOpenLightbox && (
        <ImageLightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          index={lightboxIndex}
          slides={items
            .filter((x) => !!x.signedUrl)
            .map((x, i) => ({
              src: x.signedUrl!,
              title: `Foto Aktivitas #${i + 1}`,
              fileSize: x.fileSize ?? undefined,
            }))}
        />
      )}
    </div>
  );
}

