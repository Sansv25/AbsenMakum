'use client';

import { useState } from 'react';
import { UploadCloud, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { compressImage, CompressedImageResult, formatFileSize } from '@/lib/ticketing/compressImage';

interface TicketImageUploaderProps {
  images: CompressedImageResult[];
  onChange: (images: CompressedImageResult[]) => void;
  maxFiles?: number;
}

export function TicketImageUploader({
  images,
  onChange,
  maxFiles = 6,
}: TicketImageUploaderProps) {
  const [compressing, setCompressing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);
    setCompressing(true);

    try {
      const remainingSlots = maxFiles - images.length;
      if (files.length > remainingSlots) {
        setUploadError(`Maksimal ${maxFiles} foto diperbolehkan.`);
      }

      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      const newCompressed: CompressedImageResult[] = [];

      for (const file of filesToProcess) {
        try {
          const res = await compressImage(file);
          newCompressed.push(res);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Gagal memproses gambar.';
          setUploadError(msg);
        }
      }

      onChange([...images, ...newCompressed]);
    } finally {
      setCompressing(false);
      e.target.value = '';
    }
  };

  const handleRemove = (index: number) => {
    const updated = [...images];
    const removed = updated.splice(index, 1)[0];
    if (removed?.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl);
    }
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
          <ImageIcon className="h-4 w-4 text-sky-500" />
          <span>Foto Bukti Keluhan / Lampu LOS / Serial Number</span>
          <span className="text-[11px] font-normal text-gray-400">
            ({images.length}/{maxFiles})
          </span>
        </label>
        <span className="text-[11px] text-gray-400 dark:text-slate-500">
          Otomatis dikompres &le; 1600px
        </span>
      </div>

      {/* Dropzone */}
      {images.length < maxFiles && (
        <label className="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all bg-gray-50/50 dark:bg-slate-800/30 hover:bg-blue-50/20">
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/jpg,image/webp"
            disabled={compressing}
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="p-3 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            {compressing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <UploadCloud className="h-6 w-6" />
            )}
          </div>
          <div className="text-center">
            <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
              {compressing ? 'Sedang mengompres gambar...' : 'Klik atau seret foto ke sini'}
            </span>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
              Maksimal 10 MB per foto (JPEG, PNG, WebP)
            </p>
          </div>
        </label>
      )}

      {uploadError && (
        <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60">
          {uploadError}
        </p>
      )}

      {/* Grid Thumbnail Preview */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <div
              key={idx}
              className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs"
            >
              <div className="aspect-square w-full bg-gray-100 dark:bg-slate-900 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.previewUrl}
                  alt={`Preview ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="p-2 flex items-center justify-between text-[10px] text-gray-500 dark:text-slate-400">
                <span className="truncate">Foto #{idx + 1}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatFileSize(img.compressedSize)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-red-600 text-white transition opacity-90 group-hover:opacity-100"
                title="Hapus foto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
