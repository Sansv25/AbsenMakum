import imageCompression, { type Options } from 'browser-image-compression';

/** Target ukuran maksimal hasil kompresi (dalam MB): 2.0 MB */
export const TARGET_MAX_SIZE_MB = 2.0;

/** Batas maksimal ukuran file input sebelum kompresi: 50 MB */
export const MAX_INPUT_SIZE_MB = 50;

/** Resolusi maksimal sisi terpanjang (Full HD / 2K) agar teks & detail tetap tajam */
export const MAX_WIDTH_OR_HEIGHT = 2048;

/** Kualitas awal JPEG sebelum dilakukan iterasi kompresi */
export const INITIAL_JPEG_QUALITY = 0.85;

export class ImageTooLargeError extends Error {
  constructor(sizeMB: number) {
    super(`Ukuran file (${sizeMB.toFixed(1)} MB) melebihi batas maksimal ${MAX_INPUT_SIZE_MB} MB.`);
    this.name = 'ImageTooLargeError';
  }
}

export class InvalidFileTypeError extends Error {
  constructor() {
    super('File harus berupa gambar yang valid (JPEG, PNG, WebP, HEIC).');
    this.name = 'InvalidFileTypeError';
  }
}

/** Periksa apakah file merupakan format gambar yang didukung */
export function isImageFile(file: File): boolean {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(file.name || '');
}

/** Format ukuran bytes ke string yang mudah dibaca (e.g. 1.85 MB) */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Fallback kompresi gambar menggunakan HTML5 Canvas native
 * Digunakan jika WebWorker atau library browser-image-compression mengalami kendala di browser tertentu.
 */
async function compressWithCanvasFallback(
  file: File,
  targetSizeMB: number,
  maxDimension: number
): Promise<Blob> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(width, 1);
      canvas.height = Math.max(height, 1);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      let quality = INITIAL_JPEG_QUALITY;
      const targetBytes = targetSizeMB * 1024 * 1024;

      const tryExport = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            if (blob.size > targetBytes && quality > 0.45) {
              quality -= 0.12;
              tryExport();
            } else {
              resolve(blob);
            }
          },
          'image/jpeg',
          quality
        );
      };

      tryExport();
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Kompresi gambar cerdas dengan target ukuran maksimal ~2MB
 * - Menggunakan WebWorker non-blocking
 * - Multi-tier fallback (WebWorker -> Main Thread -> Native Canvas)
 * - Menjaga orientasi EXIF & mengonversi output ke standar JPEG
 */
export async function compressImage(
  file: File,
  onProgress?: (percent: number) => void
): Promise<File> {
  if (!isImageFile(file)) {
    throw new InvalidFileTypeError();
  }

  const sizeInMB = file.size / (1024 * 1024);
  if (sizeInMB > MAX_INPUT_SIZE_MB) {
    throw new ImageTooLargeError(sizeInMB);
  }

  const options: Options = {
    maxSizeMB: TARGET_MAX_SIZE_MB,
    maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
    fileType: 'image/jpeg',
    initialQuality: INITIAL_JPEG_QUALITY,
    useWebWorker: true,
    alwaysKeepResolution: false,
    preserveExif: false,
    onProgress,
  };

  let compressedBlob: Blob | File;

  try {
    // Tingkat 1: Kompresi via Web Worker (Cepat & Non-blocking)
    compressedBlob = await imageCompression(file, options);
  } catch (workerErr) {
    console.warn(
      '[compressImage] WebWorker gagal, mencoba kompresi di main-thread:',
      workerErr
    );
    try {
      // Tingkat 2: Kompresi di Main Thread (Jika WebWorker dibatasi sandbox/CSP)
      compressedBlob = await imageCompression(file, {
        ...options,
        useWebWorker: false,
      });
    } catch (mainThreadErr) {
      console.warn(
        '[compressImage] Main-thread library gagal, menggunakan fallback HTML5 Canvas:',
        mainThreadErr
      );
      // Tingkat 3: Fallback native HTML5 Canvas
      compressedBlob = await compressWithCanvasFallback(
        file,
        TARGET_MAX_SIZE_MB,
        MAX_WIDTH_OR_HEIGHT
      );
    }
  }

  const cleanBaseName = (file.name || 'foto').replace(/\.[^.]+$/, '');
  const resultFile = new File([compressedBlob], `${cleanBaseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });

  if (process.env.NODE_ENV !== 'production' || typeof window !== 'undefined') {
    console.info(
      `[Kompresi Foto] ${file.name}: ${formatFileSize(file.size)} -> ${formatFileSize(
        resultFile.size
      )} (Target: <= ${TARGET_MAX_SIZE_MB}MB)`
    );
  }

  return resultFile;
}

/** Baca File sebagai base64 data URL */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
