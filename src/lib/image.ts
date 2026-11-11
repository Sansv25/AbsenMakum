import imageCompression from 'browser-image-compression';

const MAX_SIZE_MB = 10;
const MAX_WIDTH_OR_HEIGHT = 1600;
const JPEG_QUALITY = 0.8;

export class ImageTooLargeError extends Error {
  constructor() {
    super(`Ukuran file melebihi batas ${MAX_SIZE_MB} MB sebelum kompresi.`);
    this.name = 'ImageTooLargeError';
  }
}

export class InvalidFileTypeError extends Error {
  constructor() {
    super('File harus berupa gambar (image/*).');
    this.name = 'InvalidFileTypeError';
  }
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new InvalidFileTypeError();
  if (file.size > MAX_SIZE_MB * 1024 * 1024) throw new ImageTooLargeError();

  const compressed = await imageCompression(file, {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
    fileType: 'image/jpeg',
    initialQuality: JPEG_QUALITY,
    useWebWorker: true,
  });

  return new File([compressed], file.name.replace(/\.[^.]+$/, '.jpg'), {
    type: 'image/jpeg',
  });
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
