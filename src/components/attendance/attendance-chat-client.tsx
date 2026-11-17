'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Camera,
  Users,
  X,
  Clock,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Sun,
  MessageSquare,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { compressImage, isImageFile } from '@/lib/image';
import { showAlert } from '@/lib/swal';
import { formatIndonesia } from '@/lib/dates';
import { RoleBadgeGroup } from '@/components/ui/nav';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { GroupAttendanceModal } from './group-attendance-modal';
import type { AttendanceFeedMessage, FeedType } from '@/lib/types/attendance-feed';
import type { AppRole } from '@/lib/supabase/types';

interface AttendanceChatClientProps {
  initialDate: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRoles: AppRole[];
  isMaster: boolean;
  initialMessages: AttendanceFeedMessage[];
}

export function AttendanceChatClient({
  initialDate,
  currentUserId,
  currentUserName,
  currentUserRoles,
  isMaster,
  initialMessages,
}: AttendanceChatClientProps) {
  const [workDate, setWorkDate] = useState<string>(initialDate);
  const [messages, setMessages] = useState<AttendanceFeedMessage[]>(initialMessages);
  const [loading, setLoading] = useState<boolean>(false);

  // Input chat state
  const [inputText, setInputText] = useState<string>('');
  const [feedType, setFeedType] = useState<FeedType>('absen_pagi');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Modal QR & Lightbox state
  const [groupModalOpen, setGroupModalOpen] = useState<boolean>(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);

  // Auto scroll ke bawah feed saat pesan bertambah
  const scrollToBottom = useCallback((smooth = true) => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

  // Muat daftar pesan saat workDate berubah
  const loadMessages = useCallback(async (date: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/attendance/feed?work_date=${date}`);
      if (res.ok) {
        const json = await res.json();
        setMessages(json.messages || []);
        setTimeout(() => scrollToBottom(false), 150);
      }
    } catch {
      // Abaikan kegagalan berkala
    } finally {
      setLoading(false);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    loadMessages(workDate);
  }, [workDate, loadMessages]);

  // Realtime subscription ke tabel attendance_feed
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`chat_feed_${workDate}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_feed',
          filter: `work_date=eq.${workDate}`,
        },
        () => {
          loadMessages(workDate);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workDate, loadMessages]);

  // Pilih file foto
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isImageFile(file)) {
      showAlert('Format Tidak Didukung', 'Harap pilih file gambar (JPG, PNG, WebP).', 'warning');
      return;
    }

    try {
      setIsCompressing(true);
      const compressed = await compressImage(file);
      setAttachedFile(compressed);
      setAttachedPreview(URL.createObjectURL(compressed));
    } catch {
      showAlert('Gagal Kompres Foto', 'Terjadi kesalahan saat memproses gambar.', 'error');
    } finally {
      setIsCompressing(false);
    }
  }

  function clearAttachment() {
    setAttachedFile(null);
    setAttachedPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // Kirim absen pagi / pesan chat
  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isSending || isCompressing) return;

    const trimmed = inputText.trim();
    if (!trimmed && !attachedFile) {
      return;
    }

    try {
      setIsSending(true);
      const supabase = createClient();
      let storagePath: string | null = null;

      // 1. Upload foto jika ada
      if (attachedFile) {
        const fileId = crypto.randomUUID();
        storagePath = `${currentUserId}/absen-pagi/${workDate}/${fileId}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('evidence')
          .upload(storagePath, attachedFile, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Gagal mengunggah foto: ${uploadError.message}`);
        }
      }

      // 2. Kirim pesan ke API feed
      const res = await fetch('/api/attendance/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_date: workDate,
          feed_type: feedType,
          message: trimmed || null,
          media_paths: storagePath ? [storagePath] : [],
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Gagal mengirim pesan');
      }

      // 3. Reset form
      setInputText('');
      clearAttachment();
      setFeedType('absen_pagi');

      // Refresh list
      await loadMessages(workDate);
      scrollToBottom(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim';
      showAlert('Gagal Mengirim', msg, 'error');
    } finally {
      setIsSending(false);
    }
  }

  function openLightbox(url: string) {
    setLightboxSrc(url);
    setLightboxOpen(true);
  }

  return (
    <div className="flex flex-col h-full max-h-full w-full max-w-4xl mx-auto bg-slate-50 dark:bg-slate-950 border-x border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
      {/* 1. Header Absen Pagi */}
      <div className="shrink-0 p-3 sm:p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              Absen Pagi & Feed
              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                Khusus Pagi
              </span>
            </h1>
            <p className="text-[11px] text-slate-500">
              {formatIndonesia(workDate)}
            </p>
          </div>
        </div>

        {/* Date Picker & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            />
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 mr-1">
            <span>
              <strong className="text-slate-800 dark:text-slate-200">{currentUserName}</strong>
            </span>
            <RoleBadgeGroup roles={currentUserRoles} isMaster={isMaster} />
          </div>

          <button
            onClick={() => setGroupModalOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 rounded-xl shadow-md transition transform active:scale-95"
          >
            <Users className="w-4 h-4" />
            <span>Absen Bareng (QR)</span>
          </button>

          <button
            onClick={() => loadMessages(workDate)}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Segarkan Feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Messages Feed Scrollable Area */}
      <div
        ref={chatScrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 scroll-smooth overscroll-contain"
      >
        {/* Info Banner Tanggal */}
        <div className="flex items-center justify-center my-1">
          <span className="text-[11px] font-medium text-slate-500 bg-slate-200/60 dark:bg-slate-800/80 px-3 py-1 rounded-full border border-slate-300/40 dark:border-slate-700/60">
            🌅 Absen Pagi • {formatIndonesia(workDate)}
          </span>
        </div>

        {/* Empty State */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
              <Sun className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
              Belum Ada yang Absen Pagi Hari Ini
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mb-4">
              Jadilah yang pertama check-in pagi! Unggah foto selfie kehadiran Anda atau gunakan{' '}
              <span className="font-semibold text-amber-600">Absen Bareng</span> jika datang bersama rekan kantor.
            </p>
            <button
              onClick={() => setGroupModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 rounded-xl transition"
            >
              <Users className="w-4 h-4" /> Buka QR Absen Bersama Pagi
            </button>
          </div>
        )}

        {/* Message Items */}
        {messages.map((msg) => {
          const isMe = msg.user_id === currentUserId;
          const senderName = msg.user?.full_name || msg.user?.email || 'Petugas';
          const timeStr = new Date(msg.created_at).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Makassar',
          });

          // A. SPECIAL CARD: Absen Bersama Pagi (Group Attendance)
          if (msg.feed_type === 'group_attendance') {
            const photoUrl = msg.media_urls?.[0];
            return (
              <div
                key={msg.id}
                className="mx-auto max-w-lg bg-gradient-to-b from-amber-50 to-white dark:from-slate-900 dark:to-slate-950 border border-amber-200 dark:border-amber-900/60 rounded-3xl p-4 shadow-md space-y-3"
              >
                {/* Header Card */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        Absen Bersama Pagi (QR Verified)
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Inisiator: {senderName} • {timeStr} WITA
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Hadir Pagi
                  </span>
                </div>

                {/* Foto Bersama */}
                {photoUrl && (
                  <div
                    onClick={() => openLightbox(photoUrl)}
                    className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 cursor-pointer group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl}
                      alt="Foto Absen Bersama Pagi"
                      className="w-full h-52 object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold backdrop-blur-[2px]">
                      🔍 Klik untuk perbesar
                    </div>
                  </div>
                )}

                {/* Anggota yang Hadir */}
                <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    Rekan Terverifikasi Hadir ({(msg.group_members?.length || 0) + 1}):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {/* Inisiator Badge */}
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 px-2.5 py-1 rounded-xl">
                      👑 {senderName}
                    </span>
                    {/* Rekan Scan */}
                    {msg.group_members?.map((m) => (
                      <span
                        key={m.user_id}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-xl"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {m.full_name || m.email || 'Rekan'}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Pesan Tambahan / Catatan */}
                {msg.message && (
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed px-1">
                    {msg.message}
                  </p>
                )}
              </div>
            );
          }

          // B. CARD: Absen Mandiri Pagi (absen_pagi)
          if (msg.feed_type === 'absen_pagi') {
            const photoUrl = msg.media_urls?.[0];
            return (
              <div
                key={msg.id}
                className={`max-w-sm ${isMe ? 'ml-auto' : 'mr-auto'} rounded-2xl p-3.5 shadow-sm border bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    <Sun className="w-3 h-3 text-amber-600" /> Hadir Pagi
                  </span>
                  <span className="text-[10px] text-slate-400">{timeStr} WITA</span>
                </div>

                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {isMe ? 'Anda' : senderName}
                  </span>
                  <RoleBadgeGroup roles={msg.user?.roles} />
                </div>

                {photoUrl && (
                  <div
                    onClick={() => openLightbox(photoUrl)}
                    className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 cursor-pointer group my-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl}
                      alt="Foto Absen Pagi"
                      className="w-full h-44 object-cover group-hover:scale-105 transition"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-medium">
                      Perbesar
                    </div>
                  </div>
                )}

                {msg.message && (
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {msg.message}
                  </p>
                )}
              </div>
            );
          }

          // C. REGULAR CHAT / PESAN
          const photoUrl = msg.media_urls?.[0];
          return (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] sm:max-w-md ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
            >
              {/* Header Pengirim */}
              {!isMe && (
                <div className="flex items-center gap-1.5 mb-1 pl-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {senderName}
                  </span>
                  <RoleBadgeGroup roles={msg.user?.roles} />
                </div>
              )}

              {/* Bubble Chat */}
              <div
                className={`rounded-2xl p-3 shadow-sm ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-br-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-xs'
                }`}
              >
                {photoUrl && (
                  <div
                    onClick={() => openLightbox(photoUrl)}
                    className="relative rounded-xl overflow-hidden border border-white/20 dark:border-slate-800 bg-slate-950 cursor-pointer group mb-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl}
                      alt="Lampiran"
                      className="w-full max-h-56 object-cover group-hover:scale-105 transition"
                    />
                  </div>
                )}

                {msg.message && (
                  <p className="text-xs whitespace-pre-wrap leading-relaxed select-text">
                    {msg.message}
                  </p>
                )}

                <div
                  className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${
                    isMe ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  <Clock className="w-2.5 h-2.5" />
                  <span>{timeStr} WITA</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Bottom Chat Input Area */}
      <div className="shrink-0 p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-lg">
        {/* Preview Lampiran Gambar jika dipilih */}
        {attachedPreview && (
          <div className="mb-2 relative inline-block">
            <div className="relative rounded-xl overflow-hidden border-2 border-amber-500 w-20 h-20 bg-slate-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachedPreview} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={clearAttachment}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-rose-600 transition"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
              ✓ Foto Selfie Siap
            </span>
          </div>
        )}

        {/* Action Pills: Mode Absen Pagi vs Chat */}
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setFeedType('absen_pagi')}
            className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              feedType === 'absen_pagi'
                ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 shadow-xs'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-600" />
            Absen Pagi (Selfie)
          </button>
          <button
            type="button"
            onClick={() => setFeedType('chat')}
            className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              feedType === 'chat'
                ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 shadow-xs'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
            Obrolan / Catatan
          </button>
        </div>

        {/* Input Bar Form */}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCompressing}
            className="w-10 h-10 shrink-0 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center transition"
            title="Ambil Foto Selfie Pagi"
          >
            {isCompressing ? (
              <RefreshCw className="w-5 h-5 animate-spin text-amber-600" />
            ) : (
              <Camera className="w-5 h-5" />
            )}
          </button>

          {/* Input Text Field */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              feedType === 'absen_pagi'
                ? 'Keterangan absen pagi (misal: Hadir di kantor / standby)...'
                : 'Tulis pesan obrolan atau catatan...'
            }
            className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={isSending || isCompressing || (!inputText.trim() && !attachedFile)}
            className="w-10 h-10 shrink-0 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-md transition"
          >
            {isSending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>

      {/* Modal Absen Bersama Pagi (QR Code) */}
      <GroupAttendanceModal
        isOpen={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        initialDate={workDate}
        onSuccess={() => {
          loadMessages(workDate);
        }}
      />

      {/* Lightbox Preview */}
      {lightboxSrc && (
        <ImageLightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={[{ src: lightboxSrc, title: 'Foto Absen Pagi' }]}
        />
      )}
    </div>
  );
}
