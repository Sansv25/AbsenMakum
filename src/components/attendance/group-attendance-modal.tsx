'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Users,
  QrCode,
  CheckCircle2,
  Clock,
  RefreshCw,
  Send,
  AlertCircle,
  Search,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@/lib/supabase/client';
import { compressImage, isImageFile } from '@/lib/image';
import { showAlert, showToast } from '@/lib/swal';
import { todayWITA, formatIndonesia } from '@/lib/dates';
import { CameraModal } from '@/components/upload/camera-modal';
import type { GroupAttendanceSession, GroupMemberInfo } from '@/lib/types/attendance-feed';

interface ProfileItem {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface GroupAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  onSuccess?: () => void;
}

export function GroupAttendanceModal({
  isOpen,
  onClose,
  initialDate,
  onSuccess,
}: GroupAttendanceModalProps) {
  const [step, setStep] = useState<'form' | 'qr'>('form');
  const [workDate, setWorkDate] = useState<string>(initialDate || todayWITA());
  const [note, setNote] = useState<string>('');

  // Foto group
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [cameraOpen, setCameraOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Daftar anggota yang dipilih
  const [availableProfiles, setAvailableProfiles] = useState<ProfileItem[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchMember, setSearchMember] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('Inisiator');

  // Sesi QR
  const [session, setSession] = useState<GroupAttendanceSession | null>(null);
  const [members, setMembers] = useState<GroupMemberInfo[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(180);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);

  // Ambil user profil & rekan terdaftar saat modal dibuka
  useEffect(() => {
    if (!isOpen) return;

    setStep('form');
    setWorkDate(initialDate || todayWITA());
    setPhotoFile(null);
    setPhotoPreview(null);
    setNote('');
    setSelectedUserIds([]);
    setSession(null);
    setMembers([]);
    setTimeLeft(180);

    const supabase = createClient();
    async function loadInitialData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setCurrentUserId(user.id);
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        if (myProfile?.full_name) {
          setCurrentUserName(myProfile.full_name);
        }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .neq('id', user.id)
          .order('full_name');

        if (profiles) {
          setAvailableProfiles(profiles);
        }
      }
    }

    loadInitialData();
  }, [isOpen, initialDate]);

  // Handle pilih foto
  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isImageFile(file)) {
      showAlert('Format Tidak Didukung', 'Harap pilih file gambar (JPG, PNG, WebP).', 'warning');
      return;
    }

    try {
      setIsCompressing(true);
      const compressed = await compressImage(file);
      setPhotoFile(compressed);
      const previewUrl = URL.createObjectURL(compressed);
      setPhotoPreview(previewUrl);
    } catch {
      showAlert('Gagal Memproses Foto', 'Gagal mengompresi gambar, coba gunakan foto lain.', 'error');
    } finally {
      setIsCompressing(false);
    }
  }

  // Tangkap foto dari GPS Map Camera Modal (Timestamp & Lokasi seperti Halaman Piket)
  async function handleCameraCapture(file: File) {
    try {
      setIsCompressing(true);
      const compressed = await compressImage(file);
      setPhotoFile(compressed);
      const previewUrl = URL.createObjectURL(compressed);
      setPhotoPreview(previewUrl);
    } catch {
      showAlert('Gagal Memproses Foto', 'Gagal mengompresi gambar, coba gunakan foto lain.', 'error');
    } finally {
      setIsCompressing(false);
    }
  }

  // Toggle checklist anggota
  function toggleMember(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  // Buat sesi dan generate QR code
  async function handleCreateSession() {
    if (!photoFile) {
      showAlert('Foto Wajib Diisi', 'Silakan ambil foto selfie bersama rekan terlebih dahulu.', 'warning');
      return;
    }

    if (!currentUserId) {
      showAlert('Akses Ditolak', 'Silakan login terlebih dahulu.', 'error');
      return;
    }

    setIsCreatingSession(true);

    try {
      const supabase = createClient();

      // 1. Upload foto ke Storage bucket 'evidence' di folder khusus absen-pagi
      const fileId = crypto.randomUUID();
      const storagePath = `${currentUserId}/absen-pagi/${workDate}/group-${fileId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(storagePath, photoFile, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Gagal upload foto: ${uploadError.message}`);
      }

      // 2. Buat sesi di server via API
      const res = await fetch('/api/attendance/group/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_date: workDate,
          photo_storage_path: storagePath,
          note: note.trim() || null,
          target_user_ids: selectedUserIds,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Gagal membuat sesi absen bersama');
      }

      const createdSession: GroupAttendanceSession = json.session;
      setSession(createdSession);
      setMembers(createdSession.members || []);
      setTimeLeft(180);
      setStep('qr');
      showToast('QR Code Absen Bersama Pagi siap di-scan!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem';
      showAlert('Gagal Membuat Sesi', msg, 'error');
    } finally {
      setIsCreatingSession(false);
    }
  }

  // Polling status anggota yang scan QR & Realtime listener
  useEffect(() => {
    if (step !== 'qr' || !session) return;

    const supabase = createClient();

    // 1. Polling interval setiap 2.5 detik untuk fallback kehandalan
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/attendance/group/session?session_id=${session.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.session?.members) {
            setMembers(data.session.members);
          }
        }
      } catch {
        // Abaikan kegagalan jaringan berkala
      }
    }, 2500);

    // 2. Realtime listener via Supabase websocket
    const channel = supabase
      .channel(`group_session_${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_attendance_members',
          filter: `session_id=eq.${session.id}`,
        },
        async () => {
          try {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate(200);
            }
          } catch {
            // vibration not supported
          }

          const res = await fetch(`/api/attendance/group/session?session_id=${session.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.session?.members) {
              setMembers(data.session.members);
            }
          }
        }
      )
      .subscribe();

    // 3. Countdown timer 180s
    const timerInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timerInterval);
      supabase.removeChannel(channel);
    };
  }, [step, session]);

  // Finalisasi sesi absen bersama pagi
  async function handleFinalizeSession() {
    if (!session) return;

    try {
      setIsFinalizing(true);
      const res = await fetch('/api/attendance/group/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal memfinalisasi absen bersama');
      }

      showToast('Absen bersama pagi berhasil diterbitkan ke feed!', 'success');

      // Siarkan broadcast event agar HP rekan lain langsung menampilkan obrolan baru
      try {
        const supabase = createClient();
        const broadcastChannel = supabase.channel(`attendance_chat_${workDate}`);
        await broadcastChannel.send({
          type: 'broadcast',
          event: 'new_chat',
          payload: { senderId: currentUserId, time: Date.now() },
        });
      } catch {
        // Fallback
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kegagalan finalisasi';
      showAlert('Gagal Kirim Absen', msg, 'error');
    } finally {
      setIsFinalizing(false);
    }
  }

  if (!isOpen) return null;

  // Filter daftar user yang dicari
  const filteredProfiles = availableProfiles.filter((p) => {
    const q = searchMember.toLowerCase();
    const name = (p.full_name || '').toLowerCase();
    const email = (p.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  // URL yang akan dibuka oleh rekan ketika scan lewat Google Lens / Kamera HP
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrUrl = session ? `${origin}/absen/join?token=${session.qr_token}` : '';

  // Format menit:detik
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Cek apakah semua orang yang dipilih sudah scan
  const scannedUserIds = new Set(members.map((m) => m.user_id));
  const missingSelectedMembers = selectedUserIds.filter((id) => !scannedUserIds.has(id));
  const allSelectedScanned = selectedUserIds.length === 0 || missingSelectedMembers.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Absen Bersama
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {step === 'form'
                  ? 'Foto bersama & tentukan rekan yang hadir'
                  : 'Rekan scan QR pakai Google Lens / Kamera HP'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {step === 'form' ? (
            <>
              {/* 1. Upload Foto Bersama */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  1. Foto Bersama Rekan Pagi Ini <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={handlePhotoSelected}
                />

                {photoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview}
                      alt="Preview Foto Bersama"
                      className="w-full h-56 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end justify-between p-3">
                      <span className="text-xs text-white font-medium bg-black/50 px-2.5 py-1 rounded-lg backdrop-blur-md flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Foto Siap
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCameraOpen(true)}
                          className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-xl shadow transition flex items-center gap-1"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Kamera GPS</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs bg-white/90 hover:bg-white text-slate-900 font-semibold px-3 py-1.5 rounded-xl shadow transition"
                        >
                          Galeri
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Opsi 1: Kamera GPS Map Timestamp (Piket Design) */}
                    <button
                      type="button"
                      onClick={() => setCameraOpen(true)}
                      disabled={isCompressing}
                      className="p-4 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700 hover:border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col items-center justify-center text-center transition group min-h-[140px]"
                    >
                      <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-2xs">
                        <Camera className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Kamera GPS Map
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Watermark waktu WITA &amp; lokasi resmi
                      </span>
                    </button>

                    {/* Opsi 2: Galeri / File HP */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isCompressing}
                      className="p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-slate-50 dark:bg-slate-800/40 flex flex-col items-center justify-center text-center transition group min-h-[140px]"
                    >
                      <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-2xs">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Galeri / File HP
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        Pilih foto tersimpan tanpa watermark
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Informasi Tanggal (Otomatis Hari Ini Tanpa Select) */}
              <div className="text-xs text-slate-500 font-medium bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                📅 Tanggal:{' '}
                <span className="text-slate-800 dark:text-slate-200 font-semibold">
                  {formatIndonesia(workDate)}
                </span>
              </div>

              {/* 3. Catatan Keterangan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan / Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Datang pagi di kantor / briefing pagi"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* 4. Pilih Rekan yang Terdaftar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    2. Pilih Rekan yang Ikut Absen{' '}
                    <span className="text-slate-400 font-normal lowercase">(opsional)</span>
                  </label>
                  {selectedUserIds.length > 0 && (
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                      {selectedUserIds.length} dipilih
                    </span>
                  )}
                </div>

                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari nama rekan..."
                    value={searchMember}
                    onChange={(e) => setSearchMember(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-slate-100 dark:border-slate-800 p-1.5 bg-slate-50/50 dark:bg-slate-900/50">
                  {filteredProfiles.length === 0 ? (
                    <p className="text-center py-3 text-xs text-slate-400">
                      Tidak ada rekan lain yang ditemukan.
                    </p>
                  ) : (
                    filteredProfiles.map((p) => {
                      const isSelected = selectedUserIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleMember(p.id)}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition select-none ${
                            isSelected
                              ? 'bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 font-semibold'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                                isSelected
                                  ? 'bg-amber-600 border-amber-600 text-white'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span className="truncate">{p.full_name || p.email}</span>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400">
                              Harus scan
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  💡 Tips: Hanya rekan yang Anda centang (checklist) yang diizinkan untuk men-scan QR.
                </p>
              </div>
            </>
          ) : (
            /* Step 2: Tampilan QR Code Aktif & Realtime Listener */
            <div className="flex flex-col items-center space-y-4 text-center">
              {/* Badge Petunjuk Google Lens */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold">
                <QrCode className="w-4 h-4" />
                Scan pakai Google Lens / Kamera HP
              </div>

              {/* Kotak QR Code */}
              <div className="p-4 bg-white rounded-3xl shadow-lg border border-slate-200">
                {qrUrl && <QRCodeSVG value={qrUrl} size={220} level="H" includeMargin />}
              </div>

              {/* Timer Kedaluwarsa */}
              <div className="flex items-center gap-2 text-xs">
                <Clock
                  className={`w-4 h-4 ${timeLeft < 30 ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`}
                />
                <span
                  className={`font-semibold ${timeLeft < 30 ? 'text-rose-600 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  Masa berlaku QR: {timeFormatted}
                </span>
                {timeLeft === 0 && (
                  <button
                    onClick={handleCreateSession}
                    className="ml-2 text-xs text-amber-600 underline font-semibold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Buat Baru
                  </button>
                )}
              </div>

              {/* Status Rekan yang Terverifikasi */}
              <div className="w-full bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 text-left">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-600" />
                    Rekan Terverifikasi Hadir ({members.length})
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                    Realtime Sync ⚡
                  </span>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {/* Inisiator Sendiri */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-base">👑</span>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {currentUserName} (Anda / Inisiator)
                        </div>
                        <div className="text-[10px] text-slate-400">Mengambil foto bersama</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Terverifikasi
                    </span>
                  </div>

                  {/* Rekan yang sudah scan */}
                  {members
                    .filter((m) => m.user_id !== currentUserId)
                    .map((m) => (
                      <div
                        key={m.user_id}
                        className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800/80 animate-fade-in"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-base">🧑</span>
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {m.full_name || m.email || 'Rekan Terverifikasi'}
                            </div>
                            <div className="text-[10px] text-slate-400">Scan via Google Lens</div>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Terverifikasi
                        </span>
                      </div>
                    ))}

                  {/* Rekan yang dipilih tapi belum scan */}
                  {missingSelectedMembers.map((missingId) => {
                    const prof = availableProfiles.find((p) => p.id === missingId);
                    return (
                      <div
                        key={missingId}
                        className="flex items-center justify-between p-2 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 opacity-80"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-base">⏳</span>
                          <span className="text-xs font-medium truncate">
                            {prof?.full_name || prof?.email || 'Rekan Terpilih'}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          Menunggu scan...
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!allSelectedScanned && (
                <div className="w-full flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-200 text-xs text-left">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    Masih menunggu {missingSelectedMembers.length} rekan yang Anda pilih untuk scan QR.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          {step === 'form' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreateSession}
                disabled={!photoFile || isCreatingSession}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow transition flex items-center gap-2"
              >
                {isCreatingSession ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Menyiapkan QR...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4" /> Tampilkan QR Code
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('form')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleFinalizeSession}
                disabled={!allSelectedScanned || isFinalizing}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg transition flex items-center gap-2"
              >
                {isFinalizing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Menerbitkan...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Kirim Absen Bersama ({members.length} Orang)
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modal Kamera GPS Map Timestamp (Desain Seperti Halaman Piket) */}
      <CameraModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
        userName={currentUserName}
        initialFacingMode="user"
      />
    </div>
  );
}
