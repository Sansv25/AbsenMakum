'use client';

import { useEffect, useState, Suspense, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Ticket, TicketStatus, TicketImage, Message } from '@/lib/ticketing/types';
import { formatDateWITA, getStatusLabel, getStatusBadgeClass, getModeLabel } from '@/lib/ticketing/format';
import { compressImage, formatFileSize } from '@/lib/ticketing/compressImage';
import { buildFirstMessage } from '@/lib/ticketing/buildFirstMessage';
import { TicketEditModal } from '@/components/ticketing/ticket-edit-modal';
import { DeleteTicketModal } from '@/components/ticketing/delete-ticket-modal';
import {
  ArrowLeft,
  Copy,
  Check,
  Download,
  Upload,
  Bot,
  User,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  FileText,
  Send,
  X,
  ExternalLink,
  CheckCheck,
  Pencil,
  Trash2,
} from 'lucide-react';

interface DisplayImage {
  id: string;
  storage_path: string;
  signedUrl: string;
  size_bytes: number | null;
  created_at: string;
}

interface ActiveConflict {
  id: string;
  customer_id: string;
  name: string;
  status: TicketStatus;
}

function TicketDetailContent() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [images, setImages] = useState<DisplayImage[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConflict, setActiveConflict] = useState<ActiveConflict | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [startingTicket, setStartingTicket] = useState(false);
  const [autoSending, setAutoSending] = useState(false);
  const [syncingChat, setSyncingChat] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedTicketNo, setCopiedTicketNo] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // Manual chat input
  const [replyInput, setReplyInput] = useState('');
  const [sendingManualChat, setSendingManualChat] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Mode Monitoring: Pending reply draft
  const [pendingDraft, setPendingDraft] = useState<{
    ticket_id: string;
    customer_name: string;
    reply_text: string;
    incoming_text: string;
    created_at: string;
  } | null>(null);
  const [editedDraftText, setEditedDraftText] = useState('');
  const [processingDraft, setProcessingDraft] = useState(false);

  const loadTicketAndImages = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();

      // 1. Fetch ticket details
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (ticketError) throw new Error(ticketError.message);
      setTicket(ticketData as Ticket);

      // 2. Check if another ticket is active
      const { data: conflictData } = await supabase
        .from('tickets')
        .select('id, customer_id, name, status')
        .in('status', ['in_conversation', 'needs_admin'])
        .neq('id', ticketId)
        .maybeSingle();

      setActiveConflict(conflictData ? (conflictData as ActiveConflict) : null);

      // 3. Fetch ticket images
      const { data: imagesData, error: imagesError } = await supabase
        .from('ticket_images')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (imagesError) throw new Error(imagesError.message);

      if (imagesData && imagesData.length > 0) {
        const paths = imagesData.map((img: TicketImage) => img.storage_path);
        const { data: signedUrls, error: signError } = await supabase.storage
          .from('ticket-images')
          .createSignedUrls(paths, 600);

        if (signError) {
          console.error('Error creating signed URLs:', signError);
        }

        const displayImgs: DisplayImage[] = imagesData.map(
          (img: TicketImage, idx: number) => ({
            id: img.id,
            storage_path: img.storage_path,
            signedUrl: signedUrls?.[idx]?.signedUrl || '',
            size_bytes: img.size_bytes,
            created_at: img.created_at,
          })
        );
        setImages(displayImgs);
      } else {
        setImages([]);
      }

      // 4. Fetch chat messages
      const { data: messagesData } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (messagesData) {
        setMessages(messagesData as Message[]);
      }

      // 5. Check pending draft in monitoring mode
      fetch('/api/ticketing/ai/pending-reply')
        .then((r) => r.json())
        .then((d) => {
          if (d?.pending && d.pending.ticket_id === ticketId) {
            setPendingDraft(d.pending);
            lastDraftCreatedAtRef.current = d.pending.created_at;
            setEditedDraftText(d.pending.reply_text || '');
          } else {
            setPendingDraft(null);
            lastDraftCreatedAtRef.current = null;
            setEditedDraftText('');
          }
        })
        .catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat detail tiket';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const lastDraftCreatedAtRef = useRef<string | null>(null);

  // Fungsi sinkronisasi draf AI balasan
  const fetchPendingDraft = useCallback(async () => {
    if (!ticketId) return;
    try {
      const res = await fetch('/api/ticketing/ai/pending-reply');
      const d = await res.json();
      if (d?.pending && d.pending.ticket_id === ticketId) {
        setPendingDraft(d.pending);
        // Otomatis ganti draf ke jawaban baru jika CS mengirim pertanyaan baru
        if (d.pending.created_at !== lastDraftCreatedAtRef.current) {
          lastDraftCreatedAtRef.current = d.pending.created_at;
          setEditedDraftText(d.pending.reply_text || '');
        }
      } else {
        setPendingDraft(null);
        lastDraftCreatedAtRef.current = null;
      }
    } catch {}
  }, [ticketId]);

  useEffect(() => {
    loadTicketAndImages();
  }, [loadTicketAndImages]);

  // Realtime subscription for ticket, messages, and pending reply
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`ticket-live-${ticketId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets', filter: `id=eq.${ticketId}` },
        () => {
          loadTicketAndImages();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          setMessages((prev) => {
            const incoming = payload.new as Message;
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          setTimeout(() => {
            chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
          fetchPendingDraft();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ticketing_settings', filter: 'key=eq.pending_ai_reply' },
        () => {
          fetchPendingDraft();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, loadTicketAndImages, fetchPendingDraft]);

  // Auto-sync aktif berkala (Polling 2.5s) agar chat & draf AI PASTI update live tanpa perlu refresh manual
  useEffect(() => {
    if (!ticketId) return;

    let isPolling = false;
    const interval = setInterval(async () => {
      if (isPolling) return;
      isPolling = true;

      try {
        const supabase = createClient();

        // 1. Ambil pesan chat terbaru langsung dari database
        const { data: latestMsgs } = await supabase
          .from('ticket_messages')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });

        if (latestMsgs) {
          setMessages((prev) => {
            const hasNewLength = prev.length !== latestMsgs.length;
            const hasDifferentLast =
              prev.length > 0 &&
              latestMsgs.length > 0 &&
              (prev[prev.length - 1]?.id !== latestMsgs[latestMsgs.length - 1]?.id ||
               prev[prev.length - 1]?.ig_mid !== latestMsgs[latestMsgs.length - 1]?.ig_mid);

            if (hasNewLength || hasDifferentLast) {
              setTimeout(() => {
                chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
              return latestMsgs as Message[];
            }
            return prev;
          });
        }

        // 2. Ambil draf AI terbaru jika ada chat CS baru
        await fetchPendingDraft();

        // 3. Cek perubahan status tiket atau nomor tiket yang terbit
        const { data: currentTicketData } = await supabase
          .from('tickets')
          .select('status, ticket_number')
          .eq('id', ticketId)
          .maybeSingle();

        if (currentTicketData && ticket) {
          if (
            currentTicketData.status !== ticket.status ||
            currentTicketData.ticket_number !== ticket.ticket_number
          ) {
            setTicket((prev) => (prev ? { ...prev, ...currentTicketData } : null));
          }
        }
      } catch (err) {
        console.error('Silent auto-sync error:', err);
      } finally {
        isPolling = false;
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [ticketId, ticket, fetchPendingDraft]);

  // Handle Start Ticket (Manual Send in HP)
  const handleStartTicket = async () => {
    if (!ticket) return;
    setStartingTicket(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/ticketing/${ticket.id}/start`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memulai tiket.');

      setActionSuccess('Tiket berhasil dimulai! Status kini Sedang Berjalan.');
      await loadTicketAndImages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memulai tiket';
      setActionError(msg);
    } finally {
      setStartingTicket(false);
    }
  };

  // Handle Auto Send via Browser (Puppeteer Typer)
  const handleAutoSend = async () => {
    if (!ticket) return;
    setAutoSending(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/ticketing/${ticket.id}/auto-send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim otomatis.');

      setActionSuccess(data.message || 'Pesan berhasil dikirim otomatis!');
      await loadTicketAndImages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim via browser';
      setActionError(msg);
    } finally {
      setAutoSending(false);
    }
  };

  // Handle Sync Chat
  const handleSyncChat = async () => {
    setSyncingChat(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch('/api/ticketing/sync-chat', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal sinkronisasi chat');

      if (data.ticket_number) {
        setActionSuccess(`✓ Ditemukan Nomor Tiket: ${data.ticket_number}!`);
      } else {
        setActionSuccess(data.message || 'Sinkronisasi chat selesai.');
      }
      await loadTicketAndImages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal sinkronisasi';
      setActionError(msg);
    } finally {
      setSyncingChat(false);
    }
  };

  // Handle Close Ticket
  const handleCloseTicket = async () => {
    if (!ticket) return;
    if (!confirm('Apakah Anda yakin ingin menyelesaikan / menutup tiket ini?')) return;

    setClosingTicket(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/ticketing/${ticket.id}/close`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menutup tiket.');

      setActionSuccess('Tiket berhasil ditutup / diselesaikan.');
      await loadTicketAndImages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menutup tiket';
      setActionError(msg);
    } finally {
      setClosingTicket(false);
    }
  };

  // Handle Toggle AI / Manual
  const handleToggleMode = async () => {
    if (!ticket) return;
    const nextMode = ticket.mode === 'ai' ? 'manual' : 'ai';
    try {
      const supabase = createClient();
      await supabase.from('tickets').update({ mode: nextMode }).eq('id', ticket.id);
      setTicket({ ...ticket, mode: nextMode });
      setActionSuccess(`Mode tiket diubah menjadi: ${nextMode === 'ai' ? 'AI Otomatis' : 'Manual (AI Mati)'}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch {
      setActionError('Gagal mengubah mode tiket');
    }
  };

  // Handle Approve Draft
  const handleApproveDraft = async () => {
    if (!pendingDraft) return;
    setProcessingDraft(true);
    try {
      const res = await fetch('/api/ticketing/ai/pending-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          ticketId: pendingDraft.ticket_id,
          replyText: editedDraftText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim balasan');

      setPendingDraft(null);
      setActionSuccess(`✓ Berhasil: ${data.message || 'Pesan balasan telah dikirim!'}`);
      setTimeout(() => setActionSuccess(null), 4000);
      await loadTicketAndImages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyetujui draf';
      setActionError(msg);
    } finally {
      setProcessingDraft(false);
    }
  };

  // Handle Reject Draft
  const handleRejectDraft = async () => {
    if (!pendingDraft) return;
    setProcessingDraft(true);
    try {
      const res = await fetch('/api/ticketing/ai/pending-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          ticketId: pendingDraft.ticket_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membatalkan draf');

      setPendingDraft(null);
      setActionSuccess('Draf balasan AI berhasil dibatalkan.');
      setTimeout(() => setActionSuccess(null), 3000);
      await loadTicketAndImages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membatalkan draf';
      setActionError(msg);
    } finally {
      setProcessingDraft(false);
    }
  };

  // Copy First Message Text
  const handleCopyMessage = () => {
    if (!ticket) return;
    const text = buildFirstMessage(ticket);
    navigator.clipboard.writeText(text);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 3000);
  };

  // Send Manual Chat Message
  const handleSendManualChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !ticket) return;

    setSendingManualChat(true);
    try {
      const supabase = createClient();
      const newMsg = {
        ticket_id: ticket.id,
        direction: 'out',
        sender: 'admin',
        body: replyInput.trim(),
        ig_mid: 'pending',
      };

      const { data, error } = await supabase.from('ticket_messages').insert(newMsg).select().single();
      if (error) throw new Error(error.message);

      if (data) {
        setMessages((prev) => {
          const incoming = data as Message;
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
      }
      setReplyInput('');
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim pesan';
      setActionError(msg);
    } finally {
      setSendingManualChat(false);
    }
  };

  // Upload Additional Photos
  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !ticket) return;

    setUploadingPhoto(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressed = await compressImage(file);
        const storagePath = `${ticket.id}/${Date.now()}_${i}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('ticket-images')
          .upload(storagePath, compressed.file, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) throw new Error(uploadError.message);

        await supabase.from('ticket_images').insert({
          ticket_id: ticket.id,
          storage_path: storagePath,
          mime: 'image/jpeg',
          size_bytes: compressed.compressedSize,
        });
      }

      await loadTicketAndImages();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunggah foto tambahan';
      setErrorMsg(msg);
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleDownloadAll = () => {
    images.forEach((img, idx) => {
      if (img.signedUrl) {
        const link = document.createElement('a');
        link.href = img.signedUrl;
        link.download = `foto_keluhan_${idx + 1}.jpg`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Memuat detail tiket...</p>
      </div>
    );
  }

  if (errorMsg || !ticket) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Tiket Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{errorMsg || 'Data tiket tidak dapat dimuat.'}</p>
        <Link
          href="/ticketing"
          className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Antrean Tiket
        </Link>
      </div>
    );
  }

  const firstMessageText = buildFirstMessage(ticket);
  const cleanPhone = ticket.phone ? ticket.phone.replace(/[^0-9]/g, '') : '';
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone}`
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/ticketing"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Antrean Tiket
            </Link>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {ticket.id.slice(0, 8)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {ticket.name}
            </h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass(ticket.status)}`}>
              {getStatusLabel(ticket.status)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Dibuat: {formatDateWITA(ticket.created_at)}
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
              <User className="w-3 h-3 text-blue-500" />
              Dibuat oleh: <strong className="font-bold text-slate-900 dark:text-white">{ticket.creator_name || 'Admin'}</strong>
            </span>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-1.5 shadow-2xs"
            title="Edit data tiket atau nomor output"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit Tiket</span>
          </button>

          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl text-xs font-bold border border-rose-200 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition flex items-center gap-1.5 shadow-2xs"
            title={ticket.status === 'queued' ? 'Hapus tiket dari antrean' : 'Hapus tiket ini'}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{ticket.status === 'queued' ? 'Hapus Antrean' : 'Hapus Tiket'}</span>
          </button>

          <button
            onClick={handleToggleMode}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold border transition-all flex items-center gap-2 shadow-2xs ${
              ticket.mode === 'ai'
                ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50'
            }`}
            title="Klik untuk beralih mode AI otomatis atau manual"
          >
            <span className={`w-2 h-2 rounded-full ${ticket.mode === 'ai' ? 'bg-purple-500 animate-pulse' : 'bg-rose-500'}`} />
            <span>Mode AI: {ticket.mode === 'ai' ? 'AKTIF' : 'MANUAL'}</span>
          </button>
        </div>
      </div>

      {/* Action Banners */}
      {actionError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Monitoring Mode: Pending Reply Approval Banner */}
      {pendingDraft &&
        pendingDraft.ticket_id === ticket.id &&
        ticket.status !== 'ticket_issued' &&
        ticket.status !== 'closed' &&
        ticket.status !== 'failed' &&
        !ticket.ticket_number && (
        <div className="p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-orange-500/10 border-2 border-amber-400 dark:border-amber-600 rounded-3xl shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 dark:border-amber-800/80 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black shadow-md shadow-amber-500/20">
                AI
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Draf Balasan AI Menunggu Persetujuan (Mode Monitoring)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pelanggan: <strong className="font-bold text-slate-800 dark:text-slate-200">{pendingDraft.customer_name}</strong>
                </p>
              </div>
            </div>
            <span className="self-start sm:self-auto text-[11px] font-bold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300">
              Perlu Approval
            </span>
          </div>

          <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-800/60 shadow-2xs">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Pesan Masuk dari CS ICONNET:
              </span>
              <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 italic">
                &ldquo;{pendingDraft.incoming_text}&rdquo;
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Draf Balasan AI (Bisa diedit sebelum disetujui):
                </span>
                <span className="text-[10px] text-slate-400">Cek kebenaran data</span>
              </div>
              <textarea
                value={editedDraftText}
                onChange={(e) => setEditedDraftText(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                placeholder="Tulis balasan..."
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            <button
              onClick={handleRejectDraft}
              disabled={processingDraft}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition shadow-2xs"
            >
              ✕ Tolak Draf
            </button>
            <button
              onClick={handleApproveDraft}
              disabled={processingDraft}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
            >
              {processingDraft ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengirim ke IG...</span>
                </>
              ) : (
                <>
                  <CheckCheck className="w-4 h-4" />
                  <span>Setujui & Kirim ke Instagram</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Ticket Number / Output Card */}
      {ticket.ticket_number && (
        <div
          className={`p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 border shadow-sm ${
            /^[A-Z0-9]{8}$/.test(ticket.ticket_number)
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
              : ticket.ticket_number.toLowerCase().includes('bayar')
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
              : 'bg-sky-50 dark:bg-sky-950/30 border-sky-300 dark:border-sky-800'
          }`}
        >
          <div className="space-y-1 text-center sm:text-left">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              {/^[A-Z0-9]{8}$/.test(ticket.ticket_number)
                ? 'Nomor Tiket Resmi ICONNET'
                : 'Output / Kesimpulan ICONNET'}
            </span>
            <div className="font-mono text-3xl sm:text-4xl font-black tracking-wider text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-3">
              <span>{/^[A-Z0-9]{8}$/.test(ticket.ticket_number) ? '🎫' : 'ℹ️'}</span>
              <span>{ticket.ticket_number}</span>
            </div>
            {ticket.ticket_issued_at && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Terbit pada: {formatDateWITA(ticket.ticket_issued_at)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-bold shadow-xs transition flex items-center gap-2"
              title="Koreksi atau edit nomor tiket / output"
            >
              <Pencil className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Edit Output</span>
            </button>

            <button
              onClick={() => {
                if (ticket.ticket_number) {
                  navigator.clipboard.writeText(ticket.ticket_number);
                  setCopiedTicketNo(true);
                  setTimeout(() => setCopiedTicketNo(false), 3000);
                }
              }}
              className="px-5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-bold shadow-xs transition flex items-center gap-2"
            >
              {copiedTicketNo ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" /> Tersalin!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Salin Nomor Tiket
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Jika Belum Ada Nomor Tiket: Tombol Input Manual Output */}
      {!ticket.ticket_number && (
        <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            <span>Nomor tiket / output belum tercatat. Anda dapat memasukkan atau mengedit output secara manual jika diperlukan.</span>
          </div>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Input / Edit Output</span>
          </button>
        </div>
      )}

      {/* Phase 3: First Message Package & Quick Actions (Queued Status) */}
      {ticket.status === 'queued' && (
        <div className="bg-gradient-to-br from-blue-500/10 via-white to-indigo-500/10 dark:from-blue-950/30 dark:via-slate-900 dark:to-indigo-950/30 rounded-3xl border-2 border-blue-200 dark:border-blue-800 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="font-bold text-slate-900 dark:text-white text-base">
                  Paket Pesan Pembuka Siap Dikirim
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Kirim format pesan di bawah ke DM Instagram <strong>@iconnet.here</strong>. Setelah itu klik tombol konfirmasi untuk mengaktifkan AI.
              </p>
            </div>
          </div>

          {/* Active Conflict Warning */}
          {activeConflict && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Aturan Satu Tiket Aktif
              </div>
              <p>
                Tiket lain <strong>&ldquo;{activeConflict.name}&rdquo;</strong> (ID: {activeConflict.customer_id}) saat ini sedang aktif dengan status <strong>{getStatusLabel(activeConflict.status)}</strong>.
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Selesaikan atau tutup tiket tersebut terlebih dahulu sebelum memulai tiket ini.
              </p>
              <div className="pt-1">
                <Link
                  href={`/ticketing/${activeConflict.id}`}
                  className="text-blue-600 dark:text-blue-400 underline font-bold inline-flex items-center gap-1"
                >
                  Buka Tiket Aktif ({activeConflict.name}) <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}

          {/* First Message Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Format Pesan Standar:
              </span>
              <button
                onClick={handleCopyMessage}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2"
              >
                {copiedMessage ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Tersalin ke Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Salin Pesan
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto border border-slate-800 selection:bg-blue-500 selection:text-white">
              {firstMessageText}
            </pre>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {images.length > 0 && (
                <button
                  onClick={handleDownloadAll}
                  className="w-full sm:w-auto text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Unduh Semua Foto ({images.length})
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button
                onClick={handleAutoSend}
                disabled={autoSending || startingTicket || !!activeConflict}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition flex items-center justify-center gap-2 ${
                  autoSending || startingTicket || !!activeConflict
                    ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                }`}
              >
                {autoSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengetik & Mengirim ke IG...</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4" />
                    <span>Kirim Otomatis (Browser / Typer)</span>
                  </>
                )}
              </button>

              <button
                onClick={handleStartTicket}
                disabled={autoSending || startingTicket || !!activeConflict}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 shadow-2xs transition flex items-center justify-center gap-2 ${
                  autoSending || startingTicket || !!activeConflict
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:border-slate-400'
                }`}
              >
                {startingTicket ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Memulai...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>✓ Sudah Kirim Manual di HP</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Conversation Control Panel */}
      {(ticket.status === 'in_conversation' || ticket.status === 'needs_admin') && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-blue-400 dark:border-blue-600 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                </span>
                <h2 className="font-bold text-slate-900 dark:text-white text-base">
                  Tiket Sedang Aktif ({getStatusLabel(ticket.status)})
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Percakapan dengan ICONNET sedang berlangsung. Sistem otomatis memantau balasan nomor tiket setiap 15 detik.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleSyncChat}
                disabled={syncingChat}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2"
                title="Periksa chat Instagram sekarang juga"
              >
                {syncingChat ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sinkronisasi...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Periksa Chat Sekarang</span>
                  </>
                )}
              </button>
              <button
                onClick={handleCopyMessage}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 transition flex items-center gap-1.5"
              >
                {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMessage ? 'Tersalin' : 'Salin Pesan'}</span>
              </button>
              <button
                onClick={handleCloseTicket}
                disabled={closingTicket}
                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                {closingTicket ? 'Menutup...' : 'Tutup / Selesaikan Tiket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Details, Gallery, Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Customer Data & Photo Gallery & Live Chatroom */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" /> Data Pelanggan
              </h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                ID: {ticket.customer_id}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 dark:text-slate-500 font-semibold block mb-0.5">ID Pelanggan:</span>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{ticket.customer_id}</p>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 font-semibold block mb-0.5">ID PLN:</span>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{ticket.pln_id || '-'}</p>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 font-semibold block mb-0.5">No. Telepon / WA:</span>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{ticket.phone || '-'}</p>
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition"
                      title="Hubungi via WhatsApp"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 font-semibold block mb-0.5">No. Telepon / CP Alternatif:</span>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{ticket.alt_phone || '-'}</p>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 font-semibold block mb-0.5">Email:</span>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{ticket.email || '-'}</p>
                  {ticket.email && (
                    <a
                      href={`mailto:${ticket.email}`}
                      className="p-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition"
                      title="Kirim Email"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 font-semibold block mb-0.5">Regional:</span>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{ticket.regional || '-'}</p>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 font-semibold block mb-0.5">Kantor Perwakilan:</span>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{ticket.office || '-'}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400 dark:text-slate-500 font-semibold block mb-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Alamat Instalasi:
                </span>
                <p className="font-medium text-slate-800 dark:text-slate-200 text-xs whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  {ticket.address || '-'}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-300 font-bold text-xs block mb-1.5">
                Keluhan Gangguan:
              </span>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 font-medium leading-relaxed whitespace-pre-wrap">
                {ticket.complaint}
              </div>
            </div>
          </div>

          {/* Photos Gallery */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 dark:text-white text-base">
                  Foto Bukti Keluhan ({images.length})
                </h2>
                <span className="text-xs text-slate-400 font-medium">(Bucket Privat)</span>
              </div>
              <div className="flex items-center gap-2">
                {images.length > 0 && (
                  <button
                    onClick={handleDownloadAll}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 transition flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Unduh Semua
                  </button>
                )}
                <label className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-xl cursor-pointer transition shadow-xs flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingPhoto ? 'Mengunggah...' : '+ Tambah Foto'}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/jpg"
                    disabled={uploadingPhoto}
                    onChange={handleAddPhotos}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {images.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Belum ada foto yang diunggah untuk tiket ini
                </p>
                <p className="text-[11px] text-slate-400">
                  Klik tombol <strong>+ Tambah Foto</strong> di atas untuk melampirkan foto lampu LOS atau modem.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    onClick={() => setPreviewModalUrl(img.signedUrl)}
                    className="group cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-2 overflow-hidden hover:border-blue-400 hover:shadow-md transition"
                  >
                    <div className="aspect-square w-full rounded-xl bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.signedUrl}
                        alt={`Foto keluhan ${idx + 1}`}
                        className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition">
                        <span className="opacity-0 group-hover:opacity-100 text-white text-[10px] font-bold bg-black/70 px-2 py-1 rounded-full">
                          🔍 Lihat
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                      <span>Foto #{idx + 1}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {img.size_bytes ? formatFileSize(img.size_bytes) : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Chatroom History Feed */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 dark:text-white text-base">
                  Riwayat Percakapan Langsung
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                  {messages.length} Pesan
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Sinkron Realtime</span>
            </div>

            {/* Message Stream */}
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                  Belum ada pesan tercatat di sesi ini. Riwayat percakapan n8n / Instagram akan tampil di sini secara realtime.
                </div>
              ) : (
                messages.map((m) => {
                  const isOut = m.direction === 'out';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isOut ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5 px-1">
                        <span className="font-semibold uppercase">
                          {m.sender === 'iconnet'
                            ? 'CS ICONNET'
                            : m.sender === 'ai'
                            ? 'AI Bot'
                            : m.sender === 'admin'
                            ? 'Admin Manual'
                            : 'System'}
                        </span>
                        <span>•</span>
                        <span>{formatDateWITA(m.created_at)}</span>
                        {isOut && m.ig_mid === 'pending' && (
                          <span className="text-amber-400 font-medium ml-1">
                            • Mengirim ke Instagram...
                          </span>
                        )}
                      </div>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                          isOut
                            ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.body}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Manual Admin Reply Input */}
            <form onSubmit={handleSendManualChat} className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <input
                type="text"
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                placeholder="Ketik catatan / balasan manual admin..."
                className="flex-1 text-xs px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={sendingManualChat || !replyInput.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (1 Col): Status & Timeline Info */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
            <h2 className="font-bold text-slate-900 dark:text-white text-base border-b border-slate-100 dark:border-slate-800 pb-3">
              Informasi Status Tiket
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-slate-900 dark:text-white">{getStatusLabel(ticket.status)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Mode Operasi:</span>
                <span className="font-bold text-slate-900 dark:text-white">{getModeLabel(ticket.mode)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Pembuat Tiket:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{ticket.creator_name || 'Admin'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Giliran AI:</span>
                <span className="font-bold text-slate-900 dark:text-white">{ticket.ai_turns} turn</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Waktu Mulai:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{formatDateWITA(ticket.started_at)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Waktu Tiket Terbit:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{formatDateWITA(ticket.ticket_issued_at)}</span>
              </div>
            </div>

            {ticket.status === 'queued' && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl text-xs text-blue-900 dark:text-blue-200 space-y-1">
                <p className="font-bold">Langkah Selanjutnya:</p>
                <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
                  Salin teks pesan pertama, kirimkan ke DM Instagram @iconnet.here, lalu klik tombol <strong>Sudah Kirim Manual di HP</strong>.
                </p>
              </div>
            )}

            {(ticket.status === 'in_conversation' || ticket.status === 'needs_admin') && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                <p className="font-bold">Percakapan Aktif:</p>
                <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Sistem sedang memantau percakapan. Jika nomor tiket 8 karakter terbit, tiket akan otomatis berstatus Terbit.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {previewModalUrl && (
        <div
          onClick={() => setPreviewModalUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800">
              <span className="text-xs font-bold">Pratinjau Foto Bukti</span>
              <button
                onClick={() => setPreviewModalUrl(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewModalUrl}
                alt="Pratinjau foto keluhan"
                className="max-h-[80vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
      {/* Modal Edit Tiket & Output */}
      <TicketEditModal
        isOpen={isEditModalOpen}
        ticket={ticket}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={(updated) => {
          setTicket(updated);
          setActionSuccess('Data tiket dan output berhasil diperbarui!');
          setTimeout(() => setActionSuccess(null), 3000);
          loadTicketAndImages();
        }}
      />

      {/* Modal Hapus Tiket */}
      <DeleteTicketModal
        isOpen={isDeleteModalOpen}
        ticket={ticket}
        onClose={() => setIsDeleteModalOpen(false)}
        onSuccess={() => {
          router.push('/ticketing');
        }}
      />
    </div>
  );
}

export default function TicketDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-500 font-medium text-sm">
          Memuat halaman detail tiket...
        </div>
      }
    >
      <TicketDetailContent />
    </Suspense>
  );
}
