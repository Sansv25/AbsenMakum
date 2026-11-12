'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, Check } from 'lucide-react';
import { nowDateTimeWITA } from '@/lib/dates';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [locationStr, setLocationStr] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Request GPS
  useEffect(() => {
    if (!isOpen) return;
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(5);
          const lng = pos.coords.longitude.toFixed(5);
          setLocationStr(`${lat}, ${lng}`);
        },
        () => {
          // GPS denied or unavailable - optional, ignore
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [isOpen]);

  // Start Camera
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedPreview(null);
      setCapturedBlob(null);
      setCameraError(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  async function startCamera() {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      try {
        // Fallback without constraints
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setCameraError('Gagal mengakses kamera. Periksa izin browser Anda.');
      }
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function takePhoto() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Overlay text (WITA timestamp & GPS)
    const timestamp = nowDateTimeWITA();
    const overlayLines = [timestamp];
    if (locationStr) overlayLines.push(locationStr);

    ctx.font = 'bold 24px sans-serif';
    const padding = 16;
    const lineHeight = 32;
    const boxHeight = overlayLines.length * lineHeight + padding * 2;

    // Measure max line width
    let maxLineWidth = 0;
    for (const line of overlayLines) {
      const w = ctx.measureText(line).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }
    const boxWidth = maxLineWidth + padding * 2;

    const boxX = canvas.width - boxWidth - 20;
    const boxY = canvas.height - boxHeight - 20;

    // Background pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 10);
    ctx.fill();

    // Text lines
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    overlayLines.forEach((line, i) => {
      ctx.fillText(line, boxX + padding, boxY + padding + i * lineHeight);
    });

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        setCapturedPreview(canvas.toDataURL('image/jpeg', 0.9));
        stopCamera();
      },
      'image/jpeg',
      0.9
    );
  }

  function handleRetake() {
    setCapturedPreview(null);
    setCapturedBlob(null);
    startCamera();
  }

  function handleConfirm() {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `camera-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });
    onCapture(file);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden max-w-lg w-full flex flex-col shadow-2xl max-h-[90vh]">
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2">
            <Camera className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Ambil Foto dengan Timestamp
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative bg-black flex-1 flex items-center justify-center min-h-[300px]">
          {cameraError ? (
            <div className="p-6 text-center text-white">
              <p className="text-sm text-red-400 mb-4">{cameraError}</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-medium"
              >
                Coba Lagi
              </button>
            </div>
          ) : capturedPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capturedPreview}
              alt="Pratinjau Foto"
              className="max-h-[60vh] w-auto object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-h-[60vh] w-auto object-contain"
            />
          )}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-slate-900 flex items-center justify-between gap-3 border-t border-gray-100 dark:border-slate-800">
          {capturedPreview ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-2.5 px-4 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 font-medium rounded-xl text-sm flex items-center justify-center gap-2 min-h-[44px]"
              >
                <RefreshCw className="h-4 w-4" />
                Ulangi
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Check className="h-4 w-4" />
                Gunakan Foto
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={takePhoto}
              disabled={!!cameraError}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-slate-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 min-h-[44px]"
            >
              <Camera className="h-5 w-5" />
              Ambil Foto
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
