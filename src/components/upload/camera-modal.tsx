'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Camera, X, RefreshCw, Check, SwitchCamera, FlipHorizontal } from 'lucide-react';
import { formatCameraTimestamp } from '@/lib/dates';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  userName?: string;
  initialFacingMode?: 'user' | 'environment';
}

export function CameraModal({
  isOpen,
  onClose,
  onCapture,
  userName,
  initialFacingMode = 'user',
}: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(initialFacingMode);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // GPS, Address & Compass States
  const [coordsStr, setCoordsStr] = useState<string | null>(null);
  const [addressLines, setAddressLines] = useState<string[]>([
    'Denpasar Barat',
    'Kota Denpasar',
    'Bali',
  ]);
  const [compassHeading, setCompassHeading] = useState<number>(160);
  const [compassDir, setCompassDir] = useState<string>('S');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  const cleanUserName = useMemo(() => {
    return (userName || 'Petugas').trim();
  }, [userName]);

  // Live timer every 1 second
  useEffect(() => {
    if (!isOpen) return;
    setCurrentTimeStr(formatCameraTimestamp());
    const interval = setInterval(() => {
      setCurrentTimeStr(formatCameraTimestamp());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Preload logo
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/images/logo.svg';
    img.onload = () => {
      logoRef.current = img;
    };
  }, []);

  // Request GPS & Reverse Geocode
  useEffect(() => {
    if (!isOpen) return;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const formattedCoords = `${lat.toFixed(8)} ${lng.toFixed(7)}`;
          setCoordsStr(formattedCoords);

          // Fetch reverse geocode address
          try {
            const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
            if (res.ok) {
              const data = await res.json();
              if (data.lines && Array.isArray(data.lines) && data.lines.length > 0) {
                setAddressLines(data.lines);
              }
            }
          } catch (err) {
            console.warn('Geocoding error:', err);
          }
        },
        (err) => {
          console.warn('GPS unavailable:', err);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, [isOpen]);

  // Request Compass Orientation
  useEffect(() => {
    if (!isOpen) return;

    function handleOrientation(e: DeviceOrientationEvent) {
      let heading: number | null = null;
      if ('webkitCompassHeading' in e && typeof (e as unknown as { webkitCompassHeading: unknown }).webkitCompassHeading === 'number') {
        heading = (e as unknown as { webkitCompassHeading: number }).webkitCompassHeading;
      } else if (e.alpha !== null && typeof e.alpha === 'number') {
        heading = (360 - e.alpha) % 360;
      }

      if (heading !== null && !isNaN(heading)) {
        const rounded = Math.round(heading);
        setCompassHeading(rounded);
        setCompassDir(getCompassDirection(rounded));
      }
    }

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [isOpen]);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);

  // Start Camera
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedPreview(null);
      setCapturedBlob(null);
      setCameraError(null);
      setIsMirrored(false);
      return;
    }

    const startMode = initialFacingMode || 'user';
    setFacingMode(startMode);
    startCamera(startMode);

    return () => {
      stopCamera();
    };
  }, [isOpen, initialFacingMode]);

  async function startCamera(mode: 'user' | 'environment' = facingMode) {
    try {
      setIsSwitching(true);
      setCameraError(null);
      stopCamera();

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError('Browser ini tidak mendukung akses kamera langsung.');
        return;
      }

      let stream: MediaStream | null = null;

      // 1. Coba dengan resolusi ideal dan facingMode terpilih
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        // 2. Coba constraint facingMode langsung tanpa constraint ukuran tinggi
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode },
            audio: false,
          });
        } catch {
          // 3. Fallback kamera dasar apa pun yang tersedia
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (stream) {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch {
      setCameraError('Gagal mengakses kamera. Periksa izin kamera pada browser Anda.');
    } finally {
      setIsSwitching(false);
    }
  }

  async function handleSwitchCamera() {
    if (isSwitching || !isOpen || capturedPreview) return;
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    await startCamera(nextMode);
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

    // 1. Draw video frame (support mirror effect)
    if (isMirrored) {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const baseDim = Math.min(canvas.width, canvas.height);
    const scale = baseDim / 720;
    const margin = Math.round(24 * scale);

    // 2. KANAN ATAS: Logo ICONNET
    const logoSize = Math.round(72 * scale);
    const logoX = canvas.width - logoSize - margin;
    const logoY = margin;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10 * scale;
    if (logoRef.current && logoRef.current.complete) {
      ctx.drawImage(logoRef.current, logoX, logoY, logoSize, logoSize);
    } else {
      drawIconnetSymbol(ctx, logoX, logoY, logoSize);
    }
    ctx.restore();

    // 3. KIRI ATAS: Kompas Dial
    const compassR = Math.round(36 * scale);
    const compassX = margin + compassR;
    const compassY = margin + compassR;
    drawCompassDial(ctx, compassX, compassY, compassR, compassHeading);

    // 4. KANAN BAWAH: Text Overlay (Timestamp, Koordinat, Heading, Alamat, #Nama)
    const lines: string[] = [];
    lines.push(formatCameraTimestamp());
    if (coordsStr) {
      lines.push(coordsStr);
    }
    lines.push(`${compassHeading}° ${compassDir}`);
    if (addressLines && addressLines.length > 0) {
      addressLines.forEach((al) => lines.push(al));
    }
    lines.push(`#${cleanUserName}`);

    const fontSize = Math.round(17 * scale);
    const lineHeight = Math.round(24 * scale);
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 4 * scale;
    ctx.shadowOffsetX = 1 * scale;
    ctx.shadowOffsetY = 1 * scale;
    ctx.lineWidth = Math.max(2, 2.5 * scale);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillStyle = '#ffffff';

    const rightX = canvas.width - margin;
    let curY = canvas.height - margin;

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      ctx.strokeText(line, rightX, curY);
      ctx.fillText(line, rightX, curY);
      curY -= lineHeight;
    }

    // 6. Convert to JPEG Blob
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
    startCamera(facingMode);
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
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 overscroll-contain touch-none select-none"
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="bg-white dark:bg-slate-900 sm:border border-gray-100 dark:border-slate-800 sm:rounded-2xl overflow-hidden max-w-2xl w-full h-[100dvh] sm:h-auto sm:max-h-[92dvh] flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-xs sm:text-sm">
                Ambil Foto dengan GPS Map Camera
              </h3>
              {!capturedPreview && (
                <p className="text-[10px] text-gray-500 dark:text-slate-400">
                  Kamera:{' '}
                  <strong className="text-blue-600 dark:text-blue-400">
                    {facingMode === 'user' ? 'Depan (Selfie)' : 'Belakang'}
                  </strong>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!capturedPreview && (
              <button
                type="button"
                onClick={() => setIsMirrored((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border min-h-[36px] ${
                  isMirrored
                    ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 font-semibold shadow-xs'
                    : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700'
                }`}
                title={isMirrored ? 'Mirror Aktif (Foto dicerminkan)' : 'Aktifkan Efek Mirror (Cermin)'}
                aria-label="Cerminkan Foto"
              >
                <FlipHorizontal
                  className={`h-3.5 w-3.5 ${
                    isMirrored ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-slate-300'
                  }`}
                />
                <span className="hidden sm:inline">Mirror</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors"
              aria-label="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Viewport Kamera / Pratinjau */}
        <div className="relative bg-black flex-1 min-h-0 flex items-center justify-center overflow-hidden touch-none">
          {cameraError ? (
            <div className="p-6 text-center text-white">
              <p className="text-sm text-red-400 mb-4">{cameraError}</p>
              <button
                onClick={() => startCamera(facingMode)}
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
              className="max-h-full max-w-full w-auto h-auto object-contain"
            />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
                className="w-full h-full object-contain transition-transform duration-200"
              />

              {/* LIVE OVERLAY HUD */}
              {/* 1. KANAN ATAS: Logo ICONNET */}
              <div className="absolute top-3 right-3 z-10 pointer-events-none drop-shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/logo.svg"
                  alt="ICONNET"
                  className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
                />
              </div>

              {/* 2. KIRI ATAS: Kompas Dial */}
              <div className="absolute top-3 left-3 z-10 pointer-events-none drop-shadow-md">
                <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-black/50 border border-white/80 flex items-center justify-center relative text-[9px] font-bold text-white shadow-xs">
                  <span className="absolute top-0.5">N</span>
                  <span className="absolute right-1">E</span>
                  <span className="absolute bottom-0.5">S</span>
                  <span className="absolute left-1">M</span>
                  <div
                    className="h-3 w-1 bg-cyan-400 rounded-full origin-bottom transition-transform duration-300"
                    style={{ transform: `rotate(${compassHeading}deg)` }}
                  />
                </div>
              </div>

              {/* 3. KANAN BAWAH: Live Text Info */}
              <div className="absolute bottom-3 right-3 z-10 pointer-events-none text-right text-white font-semibold text-[10px] sm:text-xs leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] max-w-[85%] sm:max-w-[70%]">
                <p>{currentTimeStr}</p>
                {coordsStr && <p className="font-mono text-[9px] sm:text-[11px]">{coordsStr}</p>}
                <p>{compassHeading}° {compassDir}</p>
                {addressLines.map((al, idx) => (
                  <p key={idx}>{al}</p>
                ))}
                <p className="font-bold text-sky-300">#{cleanUserName}</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Controls */}
        <div className="p-3 sm:p-4 bg-gray-50 dark:bg-slate-900 flex items-center justify-between gap-3 border-t border-gray-100 dark:border-slate-800 flex-shrink-0 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          {capturedPreview ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-2.5 px-4 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 font-medium rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 min-h-[44px] transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Ulangi
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 min-h-[44px] transition-colors shadow-sm"
              >
                <Check className="h-4 w-4" />
                Gunakan Foto
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3 w-full">
              <button
                type="button"
                onClick={handleSwitchCamera}
                disabled={isSwitching || !!cameraError}
                className="py-3 px-3.5 sm:px-4 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 min-h-[44px] transition-all border border-gray-300 dark:border-slate-700 shadow-xs active:scale-95 flex-shrink-0"
                title="Ganti ke Kamera Depan / Belakang"
              >
                <SwitchCamera
                  className={`h-4 w-4 text-blue-600 dark:text-blue-400 ${
                    isSwitching ? 'animate-spin' : ''
                  }`}
                />
                <span className="hidden sm:inline">
                  {facingMode === 'user' ? 'Kamera Belakang' : 'Kamera Depan'}
                </span>
                <span className="sm:hidden">
                  {facingMode === 'user' ? 'Belakang' : 'Depan'}
                </span>
              </button>

              <button
                type="button"
                onClick={takePhoto}
                disabled={!!cameraError || isSwitching}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-slate-700 text-white font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 min-h-[44px] transition-all shadow-sm active:scale-95"
              >
                <Camera className="h-4 w-4" />
                <span>Ambil Foto</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper: Direction letters
function getCompassDirection(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(deg / 45) % 8;
  return dirs[index];
}

// Canvas Drawer: Compass Dial
function drawCompassDial(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  headingDeg: number
) {
  ctx.save();
  // Disc
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.stroke();

  // Cardinal letters
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(r * 0.35)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText('N', cx, cy - r * 0.72);
  ctx.fillText('E', cx + r * 0.72, cy);
  ctx.fillText('S', cx, cy + r * 0.72);
  ctx.fillText('M', cx - r * 0.72, cy);

  // Pointer needle pointing at heading
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((headingDeg * Math.PI) / 180);

  ctx.fillStyle = '#06b6d4';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.6);
  ctx.lineTo(-r * 0.15, r * 0.25);
  ctx.lineTo(r * 0.15, r * 0.25);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

// Canvas Drawer: Fallback ICONNET Symbol
function drawIconnetSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 100;
  ctx.scale(s, s);

  ctx.strokeStyle = '#0396A6';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.arc(50, 50, 40, Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(50, 50, 26, Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();

  ctx.fillStyle = '#17264F';
  ctx.beginPath();
  ctx.arc(50, 58, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
