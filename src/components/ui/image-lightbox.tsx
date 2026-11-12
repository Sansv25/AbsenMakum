'use client';

import Lightbox, { SlideImage } from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Download from 'yet-another-react-lightbox/plugins/download';
import 'yet-another-react-lightbox/styles.css';

export interface LightboxSlide extends SlideImage {
  title?: string;
  description?: string;
}

interface ImageLightboxProps {
  open: boolean;
  close: () => void;
  slides: LightboxSlide[];
  index?: number;
}

export function ImageLightbox({ open, close, slides, index = 0 }: ImageLightboxProps) {
  if (!open || slides.length === 0) return null;

  return (
    <Lightbox
      open={open}
      close={close}
      index={index}
      slides={slides}
      plugins={[Zoom, Fullscreen, Download]}
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
      animation={{ fade: 200, swipe: 250 }}
      controller={{ closeOnBackdropClick: true }}
      styles={{
        container: { backgroundColor: 'rgba(0, 0, 0, 0.92)' },
      }}
    />
  );
}
