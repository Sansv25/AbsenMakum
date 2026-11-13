'use client';

import { useEffect, useState, useMemo } from 'react';
import Lightbox, { SlideImage, useLightboxState } from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Download from 'yet-another-react-lightbox/plugins/download';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import { HardDrive, Loader2 } from 'lucide-react';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/captions.css';
import 'yet-another-react-lightbox/plugins/counter.css';

export interface LightboxSlide extends SlideImage {
  title?: string;
  description?: string;
  fileSize?: number;
  fileSizeText?: string;
}

export interface ImageMeta {
  bytes?: number;
  sizeText?: string;
  dimensions?: string;
  width?: number;
  height?: number;
  loading?: boolean;
}

const metaCache = new Map<string, ImageMeta>();

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function fetchImageMeta(src: string): Promise<ImageMeta> {
  if (!src) return {};
  if (metaCache.has(src)) {
    const cached = metaCache.get(src)!;
    if (!cached.loading) return cached;
  }

  // Pre-flag loading to avoid multiple concurrent duplicate fetches
  metaCache.set(src, { loading: true });

  let bytes: number | undefined;
  let width: number | undefined;
  let height: number | undefined;

  // 1. Natural dimensions measurement via HTMLImageElement
  try {
    const img = new Image();
    img.src = src;
    if (img.complete && img.naturalWidth) {
      width = img.naturalWidth;
      height = img.naturalHeight;
    } else {
      await new Promise<void>((resolve) => {
        img.onload = () => {
          width = img.naturalWidth;
          height = img.naturalHeight;
          resolve();
        };
        img.onerror = () => resolve();
        setTimeout(resolve, 2000);
      });
    }
  } catch {
    // non-fatal
  }

  // 2. Data URL size calculation
  if (src.startsWith('data:')) {
    try {
      const parts = src.split(',');
      if (parts[1]) {
        bytes = Math.round((parts[1].length * 3) / 4);
      }
    } catch {
      // non-fatal
    }
  }

  // 3. Blob or Remote URL size: Try HEAD first
  if (!bytes && !src.startsWith('data:')) {
    try {
      const res = await fetch(src, { method: 'HEAD' });
      const cl = res.headers.get('content-length');
      if (cl) {
        const parsed = parseInt(cl, 10);
        if (!isNaN(parsed) && parsed > 0) {
          bytes = parsed;
        }
      }
    } catch {
      // HEAD may fail due to CORS
    }
  }

  // 4. Fallback to GET blob (utilizes browser cache directly without duplicate network load)
  if (!bytes) {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        bytes = blob.size;
      }
    } catch {
      // non-fatal
    }
  }

  const dimensions = width && height ? `${width} × ${height} px` : undefined;
  const sizeText = bytes ? formatFileSize(bytes) : undefined;

  const result: ImageMeta = {
    bytes,
    sizeText,
    dimensions,
    width,
    height,
    loading: false,
  };

  metaCache.set(src, result);
  return result;
}

function SizeOverlay({ metaMap }: { metaMap: Record<string, ImageMeta> }) {
  const { currentSlide } = useLightboxState();
  if (!currentSlide || !('src' in currentSlide) || !currentSlide.src) return null;

  const src = currentSlide.src;
  const slideMeta = currentSlide as LightboxSlide;
  const meta = metaMap[src];

  const sizeText =
    slideMeta.fileSizeText ||
    (slideMeta.fileSize ? formatFileSize(slideMeta.fileSize) : null) ||
    meta?.sizeText;

  const dimensions = meta?.dimensions;

  return (
    <div className="absolute top-16 sm:top-3.5 left-1/2 -translate-x-1/2 z-[1050] pointer-events-none select-none max-w-[90vw] transition-all duration-200">
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-white text-xs shadow-xl">
        <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
          <HardDrive className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          {sizeText ? (
            <span>
              Ukuran: <strong className="font-bold text-white ml-0.5">{sizeText}</strong>
            </span>
          ) : (
            <span className="text-slate-400 font-normal flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
              Menghitung ukuran...
            </span>
          )}
        </span>
        {dimensions && (
          <>
            <span className="text-slate-600 dark:text-slate-500">•</span>
            <span className="text-slate-300 font-medium text-[11px] truncate">
              {dimensions}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

interface ImageLightboxProps {
  open: boolean;
  close: () => void;
  slides: LightboxSlide[];
  index?: number;
}

export function ImageLightbox({ open, close, slides, index = 0 }: ImageLightboxProps) {
  const [metaMap, setMetaMap] = useState<Record<string, ImageMeta>>({});

  useEffect(() => {
    if (!open || slides.length === 0) return;

    let active = true;

    slides.forEach((slide) => {
      if (!slide.src) return;

      // Jika slide sudah memiliki fileSize langsung
      if (slide.fileSize) {
        setMetaMap((prev) => {
          if (prev[slide.src]?.sizeText) return prev;
          return {
            ...prev,
            [slide.src]: {
              ...prev[slide.src],
              bytes: slide.fileSize,
              sizeText: formatFileSize(slide.fileSize!),
            },
          };
        });
      }

      // Ambil metadata ukuran & dimensi gambar
      fetchImageMeta(slide.src).then((meta) => {
        if (!active) return;
        setMetaMap((prev) => ({
          ...prev,
          [slide.src]: {
            ...prev[slide.src],
            ...meta,
            // Jika slide punya fileSize eksplisit, dahulukan itu
            bytes: slide.fileSize ?? meta.bytes,
            sizeText: slide.fileSize ? formatFileSize(slide.fileSize) : meta.sizeText,
          },
        }));
      });
    });

    return () => {
      active = false;
    };
  }, [open, slides]);

  // Siapkan slides dengan deskripsi caption yang memuat ukuran gambar
  const enhancedSlides = useMemo(() => {
    return slides.map((slide) => {
      const meta = metaMap[slide.src];
      const sizeText =
        slide.fileSizeText ||
        (slide.fileSize ? formatFileSize(slide.fileSize) : null) ||
        meta?.sizeText;
      const dimensions = meta?.dimensions;

      let desc = slide.description;
      if (!desc && (sizeText || dimensions)) {
        const parts: string[] = [];
        if (sizeText) parts.push(`Ukuran File: ${sizeText}`);
        if (dimensions) parts.push(`Dimensi: ${dimensions}`);
        desc = parts.join(' • ');
      }

      return {
        ...slide,
        description: desc,
      };
    });
  }, [slides, metaMap]);

  if (!open || slides.length === 0) return null;

  return (
    <Lightbox
      open={open}
      close={close}
      index={index}
      slides={enhancedSlides}
      plugins={[Zoom, Fullscreen, Download, Captions, Counter]}
      render={{
        controls: () => <SizeOverlay metaMap={metaMap} />,
      }}
      zoom={{
        maxZoomPixelRatio: 6,
        zoomInMultiplier: 1.5,
        doubleTapDelay: 300,
        doubleClickDelay: 300,
        doubleClickMaxStops: 3,
        wheelZoomDistanceFactor: 100,
        pinchZoomDistanceFactor: 100,
        scrollToZoom: true,
      }}
      captions={{
        showToggle: false,
        descriptionTextAlign: 'center',
      }}
      animation={{ fade: 200, swipe: 250 }}
      controller={{ closeOnBackdropClick: true }}
      styles={{
        container: { backgroundColor: 'rgba(0, 0, 0, 0.94)' },
        captionsTitleContainer: {
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(10px)',
        },
        captionsDescriptionContainer: {
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(10px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        },
      }}
    />
  );
}

