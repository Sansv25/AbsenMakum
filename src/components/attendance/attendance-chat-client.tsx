'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Camera,
  Users,
  X,
  CheckCheck,
  RefreshCw,
  MessageSquare,
  Reply,
  AtSign,
  Paperclip,
  MapPin,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { compressImage, isImageFile } from '@/lib/image';
import { showAlert } from '@/lib/swal';
import { formatIndonesia } from '@/lib/dates';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { CameraModal } from '@/components/upload/camera-modal';
import { GroupAttendanceModal } from './group-attendance-modal';
import type { AttendanceFeedMessage, FeedType } from '@/lib/types/attendance-feed';

export interface MentionProfile {
  id: string;
  full_name: string;
  email?: string | null;
}

interface ReplyingTarget {
  id: string;
  author: string;
  text: string;
}

interface AttendanceChatClientProps {
  initialDate: string;
  currentUserId: string;
  currentUserName?: string;
  initialMessages: AttendanceFeedMessage[];
  availableProfiles?: MentionProfile[];
}

export function AttendanceChatClient({
  initialDate,
  currentUserId,
  currentUserName = 'Petugas',
  initialMessages,
  availableProfiles = [],
}: AttendanceChatClientProps) {
  const [workDate] = useState<string>(initialDate);
  const [messages, setMessages] = useState<AttendanceFeedMessage[]>(initialMessages);
  const [loading, setLoading] = useState<boolean>(false);

  // Mention (@ tag) state
  const [profiles, setProfiles] = useState<MentionProfile[]>(availableProfiles);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(0);
  const [showMentionMenu, setShowMentionMenu] = useState<boolean>(false);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const mentionMenuRef = useRef<HTMLDivElement | null>(null);

  // Input chat state
  const [inputText, setInputText] = useState<string>('');
  const [feedType, setFeedType] = useState<FeedType>('absen_pagi');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Attachment & Geolocation state (mode obrolan)
  const [showAttachMenu, setShowAttachMenu] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const attachMenuRef = useRef<HTMLDivElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<ReplyingTarget | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  // Modal QR & Lightbox state
  const [groupModalOpen, setGroupModalOpen] = useState<boolean>(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);

  // Camera Modal state (GPS Map & Timestamp Camera seperti halaman piket)
  const [cameraOpen, setCameraOpen] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');

  // Pastikan daftar profiles termuat untuk mention
  useEffect(() => {
    if (availableProfiles && availableProfiles.length > 0) {
      setProfiles(availableProfiles);
      return;
    }
    const supabase = createClient();
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name')
      .then(({ data }) => {
        if (data) {
          setProfiles(
            data.map((p) => ({
              id: p.id,
              full_name: p.full_name || p.email || 'Petugas',
              email: p.email,
            }))
          );
        }
      });
  }, [availableProfiles]);

  // Tutup menu mention & lampiran saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        mentionMenuRef.current &&
        !mentionMenuRef.current.contains(event.target as Node) &&
        textInputRef.current &&
        !textInputRef.current.contains(event.target as Node)
      ) {
        setShowMentionMenu(false);
      }

      if (
        attachMenuRef.current &&
        !attachMenuRef.current.contains(event.target as Node)
      ) {
        setShowAttachMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter daftar mention sesuai teks setelah '@'
  const filteredMentionProfiles = profiles.filter((p) => {
    if (!mentionQuery) return true;
    const q = mentionQuery.toLowerCase();
    const name = (p.full_name || '').toLowerCase();
    const email = (p.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  // Auto scroll ke bawah feed saat pesan bertambah
  const scrollToBottom = useCallback((smooth = true) => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  // Muat daftar pesan: dukung mode silent (background polling) dan forceScroll
  const loadMessages = useCallback(
    async (date: string, isSilent = false, forceScroll = false) => {
      try {
        if (!isSilent) setLoading(true);
        const res = await fetch(`/api/attendance/feed?work_date=${date}`);
        if (res.ok) {
          const json = await res.json();
          const newMsgs: AttendanceFeedMessage[] = json.messages || [];

          // Cek apakah pengguna saat ini sedang berada di dekat dasar scroll (< 150px)
          const el = chatScrollRef.current;
          const isNearBottom = el
            ? el.scrollHeight - el.scrollTop - el.clientHeight < 150
            : true;

          setMessages((prevMsgs) => {
            const prevLastId = prevMsgs.length > 0 ? prevMsgs[prevMsgs.length - 1].id : null;
            const newLastId = newMsgs.length > 0 ? newMsgs[newMsgs.length - 1].id : null;
            const isSame = prevMsgs.length === newMsgs.length && prevLastId === newLastId;

            // Jika data identik dan tidak dipaksa scroll, jangan trigger re-render
            if (isSame && !forceScroll) {
              return prevMsgs;
            }

            // HANYA tarik ke bawah jika:
            // 1. forceScroll aktif (pertama kali buka / baru kirim chat / klik tombol refresh)
            // 2. ATAU pengguna memang sedang berada di paling bawah chat saat pesan baru masuk
            if (forceScroll || isNearBottom) {
              setTimeout(() => scrollToBottom(!forceScroll), 100);
            }

            return newMsgs;
          });

          if (forceScroll) {
            setTimeout(() => scrollToBottom(false), 150);
          }
        }
      } catch {
        // Abaikan kegagalan berkala
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [scrollToBottom]
  );

  // Initial load saat tanggal pertama kali dipilih
  useEffect(() => {
    loadMessages(workDate, false, true);
  }, [workDate, loadMessages]);

  // Realtime Multi-Layer: Broadcast (<100ms) + Postgres Changes + Active 3s Polling (Silent & Preserves Scroll)
  useEffect(() => {
    const supabase = createClient();
    const channelName = `attendance_chat_${workDate}`;

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    // 1. Terima sinyal Broadcast seketika (<100ms) saat perangkat lain memposting (Silent)
    channel.on('broadcast', { event: 'new_chat' }, () => {
      loadMessages(workDate, true, false);
    });

    // 2. Terima perubahan CDC PostgreSQL dari tabel attendance_feed (Silent)
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'attendance_feed',
      },
      () => {
        loadMessages(workDate, true, false);
      }
    );

    // 3. Terima perubahan sesi group_attendance_sessions (Silent)
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'group_attendance_sessions',
      },
      () => {
        loadMessages(workDate, true, false);
      }
    );

    channel.subscribe();

    // 4. Polling berkala setiap 3 detik secara senyap (tidak reset scroll pengguna)
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadMessages(workDate, true, false);
      }
    }, 3000);

    // 5. Otomatis refresh saat layar HP menyala kembali atau pengguna kembali ke browser
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadMessages(workDate, true, false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  // Tangkap foto dari GPS Map Camera Modal (Timestamp & Lokasi seperti Halaman Piket)
  async function handleCameraCapture(file: File) {
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
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  }

  // Bagikan lokasi GPS saat ini (Mode Obrolan)
  async function handleShareLocation() {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      showAlert('Lokasi Tidak Didukung', 'Browser ini tidak mendukung GPS / Geolocation.', 'warning');
      return;
    }

    try {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = Math.round(position.coords.accuracy);

          let address = '';
          try {
            const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
            if (res.ok) {
              const data = await res.json();
              if (data.formatted) {
                address = data.formatted;
              }
            }
          } catch {
            // Geocode fallback
          }

          const mapLink = `https://maps.google.com/?q=${lat},${lng}`;
          const locText = address
            ? `📍 Berbagi Lokasi:\n${address}\n${mapLink}`
            : `📍 Berbagi Lokasi:\nKoordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)} (Akurasi: ±${accuracy}m)\n${mapLink}`;

          setInputText((prev) => (prev ? `${prev}\n\n${locText}` : locText));
          setIsLocating(false);

          setTimeout(() => {
            if (textInputRef.current) {
              textInputRef.current.focus();
            }
          }, 50);
        },
        (error) => {
          setIsLocating(false);
          let errMsg = 'Gagal mengakses lokasi.';
          if (error.code === error.PERMISSION_DENIED) {
            errMsg = 'Izin akses lokasi ditolak. Silakan aktifkan izin lokasi di browser HP Anda.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errMsg = 'Informasi lokasi tidak tersedia saat ini.';
          } else if (error.code === error.TIMEOUT) {
            errMsg = 'Waktu permintaan lokasi habis (timeout).';
          }
          showAlert('Gagal Ambil Lokasi', errMsg, 'error');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } catch {
      setIsLocating(false);
      showAlert('Gagal Ambil Lokasi', 'Terjadi kesalahan sistem saat mendeteksi GPS.', 'error');
    }
  }

  // Lompat ke pesan yang dibalas
  function scrollToRepliedMessage(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(id);
      setTimeout(() => setHighlightedMsgId(null), 2000);
    }
  }

  // Handle perubahan teks di input untuk mendeteksi '@'
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setInputText(value);

    const cursorPos = e.target.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);

    if (match) {
      setMentionQuery(match[1]);
      setShowMentionMenu(true);
      setMentionIndex(0);
    } else {
      setShowMentionMenu(false);
      setMentionQuery(null);
    }
  }

  // Pilih rekan yang ditandai dari popup
  function insertMention(profile: MentionProfile) {
    const name = profile.full_name.trim();
    const cursorPos = textInputRef.current?.selectionStart || inputText.length;
    const textBeforeCursor = inputText.slice(0, cursorPos);
    const textAfterCursor = inputText.slice(cursorPos);

    const newBefore = textBeforeCursor.replace(/(?:^|\s)@([a-zA-Z0-9_]*)$/, (match) => {
      const prefix = match.startsWith(' ') ? ' ' : '';
      return `${prefix}@${name} `;
    });

    const nextText = newBefore + textAfterCursor;
    setInputText(nextText);
    setShowMentionMenu(false);
    setMentionQuery(null);

    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
        const pos = newBefore.length;
        textInputRef.current.setSelectionRange(pos, pos);
      }
    }, 50);
  }

  // Navigasi keyboard (Panah Atas / Bawah / Enter) untuk mention
  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showMentionMenu && filteredMentionProfiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredMentionProfiles.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(
          (prev) => (prev - 1 + filteredMentionProfiles.length) % filteredMentionProfiles.length
        );
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMentionProfiles[mentionIndex]);
      } else if (e.key === 'Escape') {
        setShowMentionMenu(false);
      }
    }
  }

  // Tombol '@' cepat di toolbar input
  function triggerMentionButton() {
    const current = inputText;
    const addSpace = current.length > 0 && !current.endsWith(' ') ? ' ' : '';
    const newText = current + addSpace + '@';
    setInputText(newText);
    setMentionQuery('');
    setShowMentionMenu(true);
    setMentionIndex(0);

    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
        const pos = newText.length;
        textInputRef.current.setSelectionRange(pos, pos);
      }
    }, 50);
  }

  // Render teks pesan dengan highlight tag @
  function renderMessageWithMentions(text: string, isMeMsg: boolean) {
    const knownNames = profiles
      .map((p) => p.full_name?.trim())
      .filter((n): n is string => Boolean(n && n.length > 0))
      .sort((a, b) => b.length - a.length);

    const escapedNames = knownNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern =
      escapedNames.length > 0
        ? new RegExp(`(@(?:${escapedNames.join('|')}|[a-zA-Z0-9_]+))`, 'gi')
        : /(@[a-zA-Z0-9_]+)/g;

    const parts = text.split(pattern);

    return parts.map((part, idx) => {
      if (part.startsWith('@')) {
        const taggedName = part.slice(1).trim().toLowerCase();
        const myName = currentUserName.trim().toLowerCase();
        const isTaggedMe = taggedName === myName || (myName && myName.includes(taggedName));

        return (
          <span
            key={idx}
            className={`font-semibold rounded px-1.5 py-0.5 inline-flex items-center gap-0.5 transition ${
              isTaggedMe
                ? isMeMsg
                  ? 'bg-amber-300 text-slate-900 font-bold shadow-2xs'
                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 ring-1 ring-amber-400/60 font-bold'
                : isMeMsg
                ? 'bg-white/20 text-white underline decoration-white/40'
                : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 font-semibold'
            }`}
          >
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  }

  // Kirim absen pagi / pesan chat / balasan
  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isSending || isCompressing) return;

    // Absen Foto WAJIB melampirkan foto
    if (feedType === 'absen_pagi' && !attachedFile) {
      showAlert(
        'Foto Wajib Diisi',
        'Untuk melakukan Absen Foto, silakan ambil foto selfie kehadiran terlebih dahulu.',
        'warning'
      );
      return;
    }

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
          reply_to_id: replyingTo?.id || null,
          reply_to_text: replyingTo?.text || null,
          reply_to_user: replyingTo?.author || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Gagal mengirim pesan');
      }

      // 3. Reset form & status reply
      setInputText('');
      clearAttachment();
      setReplyingTo(null);
      setFeedType('absen_pagi');
      setShowMentionMenu(false);
      setMentionQuery(null);

      // 4. Siarkan broadcast event instan ke semua perangkat lain yang terhubung
      try {
        const broadcastChannel = supabase.channel(`attendance_chat_${workDate}`);
        await broadcastChannel.send({
          type: 'broadcast',
          event: 'new_chat',
          payload: { senderId: currentUserId, time: Date.now() },
        });
      } catch {
        // Abaikan kegagalan broadcast, CDC dan polling tetap bekerja
      }

      // Refresh list lokal
      await loadMessages(workDate, true, true);
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
    <div className="flex flex-col h-full max-h-full w-full max-w-3xl mx-auto bg-slate-50 dark:bg-slate-950 border-x border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
      {/* 1. Top Bar */}
      <div className="shrink-0 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">
              Absen Harian
            </h1>
            <p className="text-[11px] text-slate-500 mt-1">
              {formatIndonesia(workDate)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGroupModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Absen Bareng</span> (QR)
          </button>

          <button
            onClick={() => loadMessages(workDate, false, true)}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Segarkan Feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Messages Feed (Pure Chat Bubbles) */}
      <div
        ref={chatScrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 scroll-smooth overscroll-contain"
      >
        {/* Date Divider */}
        <div className="flex items-center justify-center my-2">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800 shadow-2xs">
            {formatIndonesia(workDate)}
          </span>
        </div>

        {/* Empty State */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-2">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Belum ada absensi pagi hari ini.
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-4">
              Kirim foto selfie atau buka Absen Bareng untuk scan QR bersama rekan.
            </p>
            <button
              onClick={() => setGroupModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded-lg transition"
            >
              <Users className="w-3.5 h-3.5" /> Buka QR Absen Bareng
            </button>
          </div>
        )}

        {/* Message Items (Pure Bubble Chat) */}
        {messages.map((msg) => {
          const isMe = msg.user_id === currentUserId;
          const senderName = msg.user?.full_name || msg.user?.email || 'Petugas';
          const timeStr = new Date(msg.created_at).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Makassar',
          });
          const photoUrl = msg.media_urls?.[0];
          const isHighlighted = highlightedMsgId === msg.id;

          // Cek apakah pesan menandai user yang sedang login via @Nama
          const isMentioned = Boolean(
            msg.message &&
              currentUserName &&
              new RegExp(
                `@${currentUserName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
                'i'
              ).test(msg.message)
          );

          return (
            <div
              key={msg.id}
              id={`msg-${msg.id}`}
              className={`flex flex-col group relative transition-colors duration-300 ${
                isMe ? 'items-end' : 'items-start'
              }`}
            >
              {/* Header Pengirim (Untuk pesan rekan) */}
              {!isMe && (
                <div className="mb-1 pl-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {senderName}
                  </span>
                </div>
              )}

              <div
                className={`flex items-end gap-1.5 max-w-[85%] sm:max-w-[75%] ${
                  isMe ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Bubble Chat Card */}
                <div
                  className={`rounded-2xl p-3 shadow-xs space-y-1.5 transition ${
                    isHighlighted ? 'ring-2 ring-blue-500 scale-[1.01]' : ''
                  } ${
                    isMentioned && !isMe
                      ? 'ring-2 ring-amber-400 dark:ring-amber-500/80 shadow-md'
                      : ''
                  } ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-xs'
                      : 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-xs'
                  }`}
                >
                  {/* LABEL ABSEN SISTEM: ABSEN FOTO */}
                  {msg.feed_type === 'absen_pagi' && (
                    <div
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md mb-0.5 ${
                        isMe
                          ? 'bg-white/20 text-white'
                          : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                      }`}
                    >
                      <Camera className="w-3 h-3" />
                      <span>Absen Masuk</span>
                    </div>
                  )}

                  {/* LABEL ABSEN SISTEM: ABSEN BARENG */}
                  {msg.feed_type === 'group_attendance' && (
                    <div
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md mb-0.5 ${
                        isMe
                          ? 'bg-white/20 text-white'
                          : 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60'
                      }`}
                    >
                      <Users className="w-3 h-3" />
                      <span>Absen Bareng (QR)</span>
                    </div>
                  )}

                  {/* BADGE JIKA USER DITANDAI (@MENTION) */}
                  {isMentioned && !isMe && (
                    <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-200/80 dark:border-amber-800/80 mb-0.5">
                      <AtSign className="w-2.5 h-2.5" />
                      <span>Anda ditandai</span>
                    </div>
                  )}

                  {/* QUOTE BLOCK (JIKA MEMBALAS PESAN LAIN) */}
                  {msg.reply_to_user && (
                    <div
                      onClick={() => msg.reply_to_id && scrollToRepliedMessage(msg.reply_to_id)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs mb-1 cursor-pointer transition select-none ${
                        isMe
                          ? 'bg-black/15 border-l-3 border-white/80 hover:bg-black/25'
                          : 'bg-slate-100 dark:bg-slate-800/80 border-l-3 border-blue-500 hover:bg-slate-200/80'
                      }`}
                    >
                      <div
                        className={`text-[11px] font-bold ${
                          isMe ? 'text-white' : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {msg.reply_to_user}
                      </div>
                      <p
                        className={`text-[11px] truncate ${
                          isMe ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {msg.reply_to_text || '📷 Lampiran Foto'}
                      </p>
                    </div>
                  )}

                  {/* FOTO (ASPEK RASIO NATURAL - TIDAK KEPOTONG) */}
                  {photoUrl && (
                    <div
                      onClick={() => openLightbox(photoUrl)}
                      className="rounded-xl overflow-hidden cursor-pointer group relative my-1 bg-black/5 dark:bg-black/20"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoUrl}
                        alt="Foto Kehadiran"
                        className="w-full max-h-[380px] object-contain rounded-xl block transition duration-200 group-hover:opacity-95"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* DAFTAR ANGGOTA (UNTUK ABSEN BERSAMA: INISIATOR BOLD DIIKUTI REKAN) */}
                  {msg.feed_type === 'group_attendance' && (() => {
                    const otherMembers = (msg.group_members || []).filter(
                      (m) =>
                        m.user_id !== msg.user_id &&
                        (m.full_name || m.email || '').trim().toLowerCase() !== senderName.trim().toLowerCase()
                    );
                    const uniqueOthers = Array.from(
                      new Set(
                        otherMembers
                          .map((m) => m.full_name || m.email || 'Rekan')
                          .filter(Boolean)
                      )
                    );

                    return (
                      <div
                        className={`text-xs pt-0.5 leading-relaxed ${
                          isMe ? 'text-blue-100' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <strong className="font-bold text-inherit">{senderName}</strong>
                        {uniqueOthers.length > 0 && `, ${uniqueOthers.join(', ')}`}
                      </div>
                    );
                  })()}

                  {/* TEKS PESAN / CATATAN (DENGAN SANITASI TEKS BOT LAMA & DUKUNGAN @MENTION + MAPS CARD) */}
                  {(() => {
                    let text = msg.message;
                    if (msg.feed_type === 'group_attendance' && text) {
                      if (text.startsWith('📸 Absen Bersama Pagi')) {
                        const parts = text.split('Catatan:');
                        text = parts.length > 1 ? parts.slice(1).join('Catatan:').trim() : null;
                      }
                    }
                    if (!text) return null;

                    const mapsUrlMatch = text.match(/https:\/\/maps\.google\.com\/\?q=([0-9.-]+,[0-9.-]+)/);

                    return (
                      <div className="space-y-1.5">
                        <p
                          className={`text-[13px] leading-relaxed whitespace-pre-wrap select-text ${
                            isMe ? 'text-white' : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {renderMessageWithMentions(text, isMe)}
                        </p>

                        {/* KARTU GOOGLE MAPS JIKA ADA TAUTAN LOKASI */}
                        {mapsUrlMatch && (
                          <a
                            href={mapsUrlMatch[0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2.5 p-2 rounded-xl transition select-none group/map ${
                              isMe
                                ? 'bg-white/15 hover:bg-white/25 text-white'
                                : 'bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-200/80 dark:border-rose-900/60'
                            }`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold leading-tight">Buka di Google Maps</div>
                              <div className="text-[10px] opacity-80 truncate">{mapsUrlMatch[1]}</div>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70 group-hover/map:opacity-100 transition" />
                          </a>
                        )}
                      </div>
                    );
                  })()}

                  {/* FOOTER WAKTU */}
                  <div
                    className={`text-[10px] flex items-center justify-end gap-1 pt-0.5 ${
                      isMe ? 'text-blue-200' : 'text-slate-400'
                    }`}
                  >
                    <span>{timeStr} WITA</span>
                    {isMe && <CheckCheck className="w-3.5 h-3.5 text-blue-200" />}
                  </div>
                </div>

                {/* TOMBOL REPLY (MUNCUL DI SAMPING BUBBLE) */}
                <button
                  type="button"
                  onClick={() =>
                    setReplyingTo({
                      id: msg.id,
                      author: senderName,
                      text: msg.message || (msg.media_paths?.length ? '📷 Foto Kehadiran' : 'Absen Pagi'),
                    })
                  }
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition shrink-0"
                  title="Balas pesan ini"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Bottom Input Bar */}
      <div className="shrink-0 p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 relative">
        {/* POPUP MENU MENTION (@ TAG REKAN) */}
        {showMentionMenu && filteredMentionProfiles.length > 0 && (
          <div
            ref={mentionMenuRef}
            className="absolute bottom-full left-3 right-3 mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-30 max-h-56 flex flex-col animate-fade-in"
          >
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <AtSign className="w-3.5 h-3.5 text-blue-500" /> Tag Rekan
              </span>
              <span className="text-[10px] text-slate-400">
                Tekan Tab/Enter atau klik nama
              </span>
            </div>
            <div className="overflow-y-auto p-1.5 space-y-0.5 max-h-44">
              {filteredMentionProfiles.map((p, idx) => {
                const isSelected = idx === mentionIndex;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onMouseEnter={() => setMentionIndex(idx)}
                    onClick={() => insertMention(p)}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left text-xs transition select-none ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center text-[11px] font-bold shrink-0">
                      {(p.full_name?.[0] || 'U').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{p.full_name}</div>
                      {p.email && (
                        <div className="text-[10px] text-slate-400 truncate">{p.email}</div>
                      )}
                    </div>
                    <span className="text-[11px] text-blue-500 font-bold shrink-0">
                      @{p.full_name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* DOCKED REPLY BANNER (JIKA SEDANG MEMBALAS) */}
        {replyingTo && (
          <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-800 border-l-3 border-blue-500 rounded-lg mb-2 text-xs animate-fade-in">
            <div className="min-w-0 pr-2">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <Reply className="w-3 h-3" /> Membalas {replyingTo.author}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {replyingTo.text}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Batalkan Balasan"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* PRATINJAU FOTO TERPILIH */}
        {attachedPreview && (
          <div className="mb-2 flex items-center gap-2.5 p-2 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in duration-150">
            <div
              onClick={() => openLightbox(attachedPreview)}
              className="relative rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 w-12 h-12 bg-slate-950 shrink-0 cursor-pointer group"
              title="Klik untuk melihat pratinjau foto besar"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachedPreview}
                alt="Preview"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Camera className="w-3.5 h-3.5 text-blue-500" />
                <span className="truncate">Foto GPS Map Terlampir</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                Foto siap dikirim dengan watermark waktu &amp; lokasi
              </p>
            </div>
            <button
              type="button"
              onClick={clearAttachment}
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition shrink-0"
              title="Hapus Lampiran Foto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* POPUP MENU LAMPIRAN (MODE OBROLAN) */}
        {showAttachMenu && feedType === 'chat' && (
          <div
            ref={attachMenuRef}
            className="absolute bottom-full left-3 mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-30 p-1.5 flex flex-col gap-1 w-64 animate-fade-in"
          >
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              Lampiran Pesan
            </div>

            {/* Opsi 1: Kamera GPS Map / Timestamp (Desain Seperti Halaman Piket) */}
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                setCameraFacingMode('environment');
                setCameraOpen(true);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400 transition text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Camera className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  Kamera GPS Map
                </div>
                <div className="text-[10px] text-slate-400 font-normal truncate">
                  Watermark waktu WITA &amp; lokasi resmi
                </div>
              </div>
            </button>

            {/* Opsi 2: Galeri / File */}
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                galleryInputRef.current?.click();
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div>Galeri / File</div>
                <div className="text-[10px] text-slate-400 font-normal">
                  Pilih foto dari HP tanpa watermark
                </div>
              </div>
            </button>

            {/* Opsi 3: Bagikan Lokasi GPS */}
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                handleShareLocation();
              }}
              disabled={isLocating}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                {isLocating ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-rose-600" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div>{isLocating ? 'Mencari GPS...' : 'Bagikan Titik Lokasi'}</div>
                <div className="text-[10px] text-slate-400 font-normal">
                  Kirim link koordinat Google Maps
                </div>
              </div>
            </button>
          </div>
        )}

        {/* PILIHAN MODE: ABSEN FOTO ATAU CHAT */}
        <div className="flex items-center gap-1.5 mb-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setFeedType('absen_pagi');
              setShowAttachMenu(false);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              feedType === 'absen_pagi'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            📷 Absen Foto
          </button>
          <button
            type="button"
            onClick={() => setFeedType('chat')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              feedType === 'chat'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            💬 Obrolan
          </button>
        </div>

        {/* FORM INPUT PESAN */}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* Input file kamera langsung (fallback) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Input file galeri */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Tombol Kamera & Lampiran Sesuai Mode */}
          {feedType === 'absen_pagi' ? (
            <div className="flex items-center gap-1 shrink-0">
              {/* Tombol Utama: Kamera GPS Map Timestamp (Piket Design) */}
              <button
                type="button"
                onClick={() => {
                  setCameraFacingMode('user');
                  setCameraOpen(true);
                }}
                disabled={isCompressing}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition shadow-xs ${
                  attachedFile
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title="Ambil Foto Selfie GPS Map Camera (Watermark Waktu & Lokasi)"
              >
                {isCompressing ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>

              {/* Tombol Sekunder: Pilih dari Galeri */}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isCompressing}
                className="w-8 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition"
                title="Pilih foto dari Galeri / File"
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              {/* Tombol Cepat Kamera GPS Map Timestamp di Obrolan */}
              <button
                type="button"
                onClick={() => {
                  setCameraFacingMode('environment');
                  setCameraOpen(true);
                }}
                disabled={isCompressing}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                  attachedFile
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                    : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800'
                }`}
                title="Ambil Foto Timestamp GPS Map (Desain Piket)"
              >
                <Camera className="w-4 h-4" />
              </button>

              {/* Tombol Menu Lampiran */}
              <button
                type="button"
                onClick={() => setShowAttachMenu((prev) => !prev)}
                disabled={isCompressing}
                className={`w-8 h-9 rounded-xl flex items-center justify-center transition ${
                  showAttachMenu
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title="Menu Lampiran (Galeri, Lokasi, dll)"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={triggerMentionButton}
            className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-700 flex items-center justify-center transition"
            title="Tag Rekan (@)"
          >
            <AtSign className="w-4 h-4" />
          </button>

          <input
            ref={textInputRef}
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder={
              replyingTo
                ? `Tulis balasan untuk ${replyingTo.author}...`
                : feedType === 'absen_pagi'
                ? attachedFile
                  ? 'Keterangan absen foto (opsional)...'
                  : 'Wajib ambil foto selfie untuk Absen Masuk...'
                : 'Tulis pesan / ketik @ untuk tag...'
            }
            className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <button
            type="submit"
            disabled={
              isSending ||
              isCompressing ||
              (feedType === 'absen_pagi' ? !attachedFile : !inputText.trim() && !attachedFile)
            }
            className="w-9 h-9 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-xs transition"
          >
            {isSending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>

      {/* Modal Kamera GPS Map Timestamp (Desain Seperti Halaman Piket) */}
      <CameraModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
        userName={currentUserName}
        initialFacingMode={cameraFacingMode}
      />

      {/* Modal Absen Bersama Pagi (QR Code) */}
      <GroupAttendanceModal
        isOpen={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        initialDate={workDate}
        onSuccess={() => {
          loadMessages(workDate, true, true);
        }}
      />

      {/* Lightbox Preview */}
      {lightboxSrc && (
        <ImageLightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={[{ src: lightboxSrc, title: 'Foto Kehadiran' }]}
        />
      )}
    </div>
  );
}
