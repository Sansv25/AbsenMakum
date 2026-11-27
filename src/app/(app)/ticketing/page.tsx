'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Ticket, TicketStatus, PendingAiReplyDraft } from '@/lib/ticketing/types';
import { getStatusBadgeClass, getStatusLabel, getModeLabel, formatDateWITA } from '@/lib/ticketing/format';
import { TicketStatsCards } from '@/components/ticketing/ticket-stats-cards';
import { TicketControlSwitches } from '@/components/ticketing/ticket-control-switches';
import { TicketAiApprovalBanner } from '@/components/ticketing/ticket-ai-approval-banner';
import { TicketEditModal } from '@/components/ticketing/ticket-edit-modal';
import { DeleteTicketModal } from '@/components/ticketing/delete-ticket-modal';
import { NewTicketModal } from '@/components/ticketing/new-ticket-modal';
import {
  broadcastTicketChange,
  TICKETS_REALTIME_CHANNEL,
  type TicketBroadcastPayload,
} from '@/lib/ticketing/realtime';
import { showAlert, showConfirm } from '@/lib/swal';
import {
  Search,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  Ticket as TicketIcon,
  ChevronLeft,
  ChevronRight,
  User,
  AlertCircle,
  Inbox,
  Sparkles,
  Pencil,
  Trash2,
  Phone,
  MapPin,
  Zap,
  LayoutGrid,
  List as ListIcon,
  MessageSquare,
  Clock,
  ExternalLink,
  RotateCcw,
  Download,
} from 'lucide-react';

export default function TicketingDashboardPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter & Search & View Mode
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [syncing, setSyncing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Queue Order
  const [queueOrder, setQueueOrder] = useState<string[]>([]);

  // Modal States
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [deletingTicket, setDeletingTicket] = useState<Ticket | null>(null);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [requeuingId, setRequeuingId] = useState<string | null>(null);

  const handleRequeueTicket = async (ticket: Ticket) => {
    const confirmRequeue = await showConfirm(
      'Antrekan Ulang Tiket?',
      `Apakah Anda yakin ingin MENGANTREKAN ULANG tiket "${ticket.name}"?\n\nTiket akan dikembalikan ke status 'Antrean' dan riwayat chat akan direset agar bot mengirim ulang pesan pembuka ke Instagram.`,
      'Ya, Antrekan Ulang',
      false
    );
    if (!confirmRequeue) return;

    setRequeuingId(ticket.id);
    try {
      const res = await fetch(`/api/ticketing/${ticket.id}/requeue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearMessages: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengantrekan ulang tiket');
      const supabase = createClient();
      await broadcastTicketChange(supabase, 'requeue', { ticketId: ticket.id });
      await fetchTickets();
    } catch (err: unknown) {
      await showAlert(
        'Gagal Mengantrekan Ulang',
        err instanceof Error ? err.message : 'Gagal mengantrekan ulang tiket',
        'error'
      );
    } finally {
      setRequeuingId(null);
    }
  };

  // Toggles
  const [autoQueueEnabled, setAutoQueueEnabled] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [dispatchingQueue, setDispatchingQueue] = useState(false);
  const [canCreateTicket, setCanCreateTicket] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Pending Drafts in Monitoring Mode (mendukung banyak tiket/bot paralel sekaligus)
  const [pendingDrafts, setPendingDrafts] = useState<PendingAiReplyDraft[]>([]);
  const [editedDraftTexts, setEditedDraftTexts] = useState<Record<string, string>>({});
  const [processingDraftId, setProcessingDraftId] = useState<string | null>(null);

  // Cek query ?create=true atau ?new=true saat pertama kali dibuka
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('create') === 'true' || urlParams.get('new') === 'true') {
        setIsNewTicketModalOpen(true);
      }
    }
  }, []);

  // Load initial settings
  useEffect(() => {
    fetch('/api/ticketing/queue/settings')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.enabled === 'boolean') setAutoQueueEnabled(d.enabled);
      })
      .catch(() => {});

    fetch('/api/ticketing/ai/settings')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.enabled === 'boolean') setAiEnabled(d.enabled);
      })
      .catch(() => {});

    fetch('/api/ticketing/ai/monitoring')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.enabled === 'boolean') setMonitoringEnabled(d.enabled);
      })
      .catch(() => {});

    // Cek izin pembuatan tiket untuk user saat ini
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        supabase
          .from('profiles')
          .select('full_name, role, roles')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => {
            const isMasterEmail = data.user.email?.toLowerCase() === 'madesanjaya255@gmail.com';
            const roles: string[] = Array.isArray(profile?.roles) ? profile.roles : [];
            const isOwner = roles.includes('owner') || isMasterEmail;
            const isTiket = roles.includes('tiket');
            const allowed = isOwner || isTiket;
            setIsOwner(isOwner);
            setCanCreateTicket(allowed);

            const displayName = profile?.full_name?.trim() || data.user.email?.split('@')[0] || 'Petugas';
            setCurrentUser({ id: data.user.id, name: displayName });

            if (!allowed) {
              window.location.href = '/';
            }

            // Auto buka modal jika diarahkan dari query ?create=true atau ?new=true
            if (typeof window !== 'undefined') {
              const urlParams = new URLSearchParams(window.location.search);
              if (urlParams.get('create') === 'true' || urlParams.get('new') === 'true') {
                setIsNewTicketModalOpen(true);
              }
            }
          });
      }
    });

    const checkDraft = () => {
      fetch('/api/ticketing/ai/pending-reply')
        .then((r) => r.json())
        .then((d) => {
          const list: PendingAiReplyDraft[] = Array.isArray(d?.pendingList)
            ? d.pendingList
            : d?.pending
            ? [d.pending]
            : [];

          setPendingDrafts((prev) => {
            // Update teks editan hanya untuk draf baru atau yang diperbarui AI
            setEditedDraftTexts((prevTexts) => {
              const nextTexts = { ...prevTexts };
              for (const item of list) {
                const oldItem = prev.find((p) => p.ticket_id === item.ticket_id);
                if (
                  !oldItem ||
                  oldItem.created_at !== item.created_at ||
                  oldItem.incoming_text !== item.incoming_text ||
                  oldItem.reply_text !== item.reply_text
                ) {
                  nextTexts[item.ticket_id] = item.reply_text || '';
                }
              }
              return nextTexts;
            });
            return list;
          });
        })
        .catch(() => {});
    };

    checkDraft();
    const interval = setInterval(checkDraft, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      const supabase = createClient();
      const [{ data: ticketsData, error: ticketsError }, queueRes] = await Promise.all([
        supabase.from('tickets').select('*').order('created_at', { ascending: false }),
        fetch('/api/ticketing/reorder')
          .then((r) => r.json())
          .catch(() => ({ ticketIds: [] })),
      ]);

      if (ticketsError) {
        throw new Error(ticketsError.message);
      }

      setQueueOrder(queueRes?.ticketIds || []);
      setTickets((ticketsData ?? []) as Ticket[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat daftar tiket';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();

    // Supabase Realtime WebSocket subscription (Broadcast + Postgres changes)
    const supabase = createClient();
    const channel = supabase.channel(TICKETS_REALTIME_CHANNEL, {
      config: {
        broadcast: { self: false },
      },
    });

    channel
      .on('broadcast', { event: 'ticket_changed' }, (payload) => {
        const p = (payload as Record<string, unknown>)?.payload as TicketBroadcastPayload | undefined;
        // Jika ada tiket baru yang dibuat di perangkat lain, masukkan langsung secara instan
        if (p?.action === 'create' && p?.ticket) {
          const newT = p.ticket as Ticket;
          setTickets((prev) => {
            if (prev.some((t) => t.id === newT.id)) return prev;
            return [newT, ...prev];
          });
        } else if (p?.action === 'delete' && p?.ticketId) {
          setTickets((prev) => prev.filter((t) => t.id !== p.ticketId));
        } else if (p?.action === 'reorder' && Array.isArray(p?.queueOrder)) {
          setQueueOrder(p.queueOrder);
        }
        // Sinkronkan data lengkap dari server
        fetchTickets();
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    // Background polling setiap 3.5 detik sebagai backup jika koneksi WebSocket terputus/idle
    const pollInterval = setInterval(() => {
      fetchTickets();
    }, 3500);

    // Segera perbarui saat tab/jendela kembali aktif (misal switch tab atau buka layar HP)
    const handleSyncOnFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchTickets();
      }
    };
    window.addEventListener('focus', handleSyncOnFocus);
    document.addEventListener('visibilitychange', handleSyncOnFocus);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleSyncOnFocus);
      document.removeEventListener('visibilitychange', handleSyncOnFocus);
      supabase.removeChannel(channel);
    };
  }, [fetchTickets]);

  // Automated background polling for sync when active ticket exists
  useEffect(() => {
    const hasActiveTicket = tickets.some(
      (t) => t.status === 'in_conversation' || t.status === 'needs_admin'
    );
    if (!hasActiveTicket) return;

    let isPolling = false;
    const interval = setInterval(async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        const res = await fetch('/api/ticketing/sync-chat', { method: 'POST' });
        const data = await res.json();
        if (data.ticket_number) {
          await fetchTickets();
        }
      } catch (err) {
        console.error('Background sync error:', err);
      } finally {
        isPolling = false;
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [tickets, fetchTickets]);

  // Automated Queue Dispatcher
  useEffect(() => {
    if (!autoQueueEnabled || dispatchingQueue || loading) return;

    const hasActiveTicket = tickets.some(
      (t) => t.status === 'in_conversation' || t.status === 'needs_admin'
    );
    const hasQueuedTicket = tickets.some((t) => t.status === 'queued');

    if (!hasActiveTicket && hasQueuedTicket) {
      setDispatchingQueue(true);
      fetch('/api/ticketing/queue/dispatch', { method: 'POST' })
        .then((r) => r.json())
        .then((d) => {
          if (d.status === 'ready' && d.ticket) {
            fetchTickets();
          }
        })
        .catch(() => {})
        .finally(() => {
          setTimeout(() => setDispatchingQueue(false), 5000);
        });
    }
  }, [tickets, autoQueueEnabled, dispatchingQueue, loading, fetchTickets]);

  const handleToggleAutoQueue = async () => {
    if (!isOwner) return;
    const nextVal = !autoQueueEnabled;
    setAutoQueueEnabled(nextVal);
    await fetch('/api/ticketing/queue/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: nextVal }),
    });
  };

  const handleToggleAi = async () => {
    if (!isOwner) return;
    const nextVal = !aiEnabled;
    setAiEnabled(nextVal);
    await fetch('/api/ticketing/ai/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: nextVal }),
    });
  };

  const handleToggleMonitoring = async () => {
    if (!isOwner) return;
    const nextVal = !monitoringEnabled;
    setMonitoringEnabled(nextVal);
    await fetch('/api/ticketing/ai/monitoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: nextVal }),
    });
  };

  const handleSyncChat = async () => {
    setSyncing(true);
    try {
      await fetch('/api/ticketing/sync-chat', { method: 'POST' });
      await fetchTickets();
      const supabase = createClient();
      await broadcastTicketChange(supabase, 'sync');
    } finally {
      setSyncing(false);
    }
  };

  // Draf yang valid hanya jika tiket terkait masih aktif dan belum terbit / selesai
  const activeDrafts = useMemo(() => {
    return pendingDrafts.filter((draft) => {
      const targetTicket = tickets.find((t) => t.id === draft.ticket_id);
      if (targetTicket) {
        if (
          targetTicket.status === 'ticket_issued' ||
          targetTicket.status === 'closed' ||
          targetTicket.status === 'failed' ||
          Boolean(targetTicket.ticket_number)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [pendingDrafts, tickets]);

  const handleApproveDraft = async (ticketId: string) => {
    setProcessingDraftId(ticketId);
    try {
      await fetch('/api/ticketing/ai/pending-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          ticketId,
          replyText: editedDraftTexts[ticketId] || '',
        }),
      });
      setPendingDrafts((prev) => prev.filter((d) => d.ticket_id !== ticketId));
      await fetchTickets();
    } finally {
      setProcessingDraftId(null);
    }
  };

  const handleRejectDraft = async (ticketId: string) => {
    setProcessingDraftId(ticketId);
    try {
      await fetch('/api/ticketing/ai/pending-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          ticketId,
        }),
      });
      setPendingDrafts((prev) => prev.filter((d) => d.ticket_id !== ticketId));
      await fetchTickets();
    } finally {
      setProcessingDraftId(null);
    }
  };

  const persistQueueOrder = async (newOrder: string[]) => {
    setQueueOrder(newOrder);
    await fetch('/api/ticketing/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketIds: newOrder }),
    });
    const supabase = createClient();
    await broadcastTicketChange(supabase, 'reorder', { queueOrder: newOrder });
  };

  const handleMoveQueue = async (id: string, direction: 'up' | 'down') => {
    const currentQueued = filteredTickets.filter((t) => t.status === 'queued');
    const ids = currentQueued.map((t) => t.id);
    const curIdx = ids.indexOf(id);
    if (curIdx === -1) return;

    const targetIdx = direction === 'up' ? curIdx - 1 : curIdx + 1;
    if (targetIdx < 0 || targetIdx >= ids.length) return;

    const [moved] = ids.splice(curIdx, 1);
    ids.splice(targetIdx, 0, moved);

    await persistQueueOrder(ids);
  };

  const handleCopyTicketNumber = (num: string, id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(num);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredTickets = useMemo(() => {
    const result = tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.customer_id.toLowerCase().includes(q) ||
          t.ticket_number?.toLowerCase().includes(q) ||
          t.creator_name?.toLowerCase().includes(q) ||
          t.pln_id?.toLowerCase().includes(q)
        );
      }
      return true;
    });

    if (statusFilter === 'queued') {
      result.sort((a, b) => {
        const idxA = queueOrder.indexOf(a.id);
        const idxB = queueOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    }

    return result;
  }, [tickets, statusFilter, searchQuery, queueOrder]);

  // Pagination calculations
  const totalItems = filteredTickets.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedTickets = filteredTickets.slice(startIndex, endIndex);

  const statusTabs: { key: string; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'queued', label: 'Antrean' },
    { key: 'in_conversation', label: 'Sedang Berjalan' },
    { key: 'needs_admin', label: 'Butuh Admin' },
    { key: 'ticket_issued', label: 'Tiket Terbit' },
    { key: 'closed', label: 'Selesai' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <TicketIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">
                Ticketing Gangguan ICONNET
              </h1>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Otomasi pelaporan keluhan pelanggan via Instagram &bull; Pencatatan nomor tiket resmi
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
          {canCreateTicket && (
            <button
              type="button"
              onClick={() => setIsNewTicketModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer"
            >
              <TicketIcon className="h-3.5 w-3.5" />
              <span>+ Buat Tiket Baru</span>
            </button>
          )}

          <a
            href="https://github.com/Sansv25/Auto-ticketing/archive/refs/heads/main.zip"
            target="_blank"
            rel="noopener noreferrer"
            download="Auto-ticketing-main.zip"
            title="Unduh paket Bot Piket Auto-Ticketing (ekstrak lalu jalankan 1_LOGIN_INSTAGRAM.bat dan 2_MULAI_PIKET.bat)"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-950/80 transition shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Bot Tiket</span>
          </a>

          <Link
            href="/ticketing/settings"
            className="text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden sm:inline">Pengaturan Prompt AI</span>
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Stats Cards */}
      <TicketStatsCards
        tickets={tickets}
        activeFilter={statusFilter}
        onSelectFilter={setStatusFilter}
      />

      {/* Control Center Switches */}
      <TicketControlSwitches
        autoQueueEnabled={autoQueueEnabled}
        onToggleAutoQueue={handleToggleAutoQueue}
        aiEnabled={aiEnabled}
        onToggleAi={handleToggleAi}
        monitoringEnabled={monitoringEnabled}
        onToggleMonitoring={handleToggleMonitoring}
        syncing={syncing}
        onSync={handleSyncChat}
        isOwner={isOwner}
        onCreateTicket={canCreateTicket ? () => setIsNewTicketModalOpen(true) : undefined}
      />

      {/* AI Approval Floating Banners (mendukung banyak tiket paralel) */}
      {activeDrafts.length > 0 && (
        <div className="space-y-3">
          {activeDrafts.map((draft) => (
            <TicketAiApprovalBanner
              key={draft.ticket_id}
              draft={draft}
              editedText={editedDraftTexts[draft.ticket_id] ?? draft.reply_text ?? ''}
              onTextChange={(txt) =>
                setEditedDraftTexts((prev) => ({ ...prev, [draft.ticket_id]: txt }))
              }
              onApprove={() => handleApproveDraft(draft.ticket_id)}
              onReject={() => handleRejectDraft(draft.ticket_id)}
              processing={processingDraftId === draft.ticket_id}
            />
          ))}
        </div>
      )}

      {/* Filter Tabs, Search Bar & View Mode Toggle */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-2xl border border-gray-200/80 dark:border-slate-800 shadow-2xs">
        {/* Status Tabs with smooth invisible scrollbar */}
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1 sm:pb-0">
          {statusTabs.map((tab) => {
            const count =
              tab.key === 'all'
                ? tickets.length
                : tickets.filter((t) => t.status === tab.key).length;
            const isActive = statusFilter === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.key);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? 'bg-blue-700 text-white'
                      : 'bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar & View Switcher */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-[180px] sm:min-w-[240px]">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari nama, ID, tiket, pembuat..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Toggle View Mode: Card Lengkap vs Menu List */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'card'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'
              }`}
              title="Tampilan Kartu Lengkap (Besar & Lega)"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Kartu Lengkap</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700 dark:text-slate-400'
              }`}
              title="Tampilan Menu List"
            >
              <ListIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Menu List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ticket Cards Grid / List */}
      <div className={viewMode === 'card' ? 'grid grid-cols-1 gap-4' : 'space-y-2.5'}>
        {loading ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 space-y-2">
            <div className="inline-block h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Memuat data tiket keluhan...
            </p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-gray-200/80 dark:border-slate-800 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400">
              <Inbox className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-slate-200">
                Tidak ada tiket ditemukan
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                {searchQuery
                  ? 'Tidak ada tiket yang cocok dengan kata kunci pencarian.'
                  : 'Belum ada tiket keluhan di kategori ini.'}
              </p>
            </div>
            {canCreateTicket ? (
              <button
                type="button"
                onClick={() => setIsNewTicketModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer"
              >
                <TicketIcon className="h-3.5 w-3.5" />
                <span>Buat Tiket Baru Sekarang</span>
              </button>
            ) : (
              <p className="text-[11px] text-gray-400 dark:text-slate-500">
                Pembuatan tiket gangguan hanya diizinkan untuk akun dengan <strong>Role Tiket</strong>.
              </p>
            )}
          </div>
        ) : viewMode === 'card' ? (
          /* ========================================================================= */
          /* TAMPILAN KARTU LENGKAP (VERSI LEBIH BESAR, LEGA, DAN MENAMPUNG DETAIL)     */
          /* ========================================================================= */
          paginatedTickets.map((ticket, index) => {
            const isQueued = ticket.status === 'queued';
            const hasTicketNo = !!ticket.ticket_number;
            const globalIndex = startIndex + index;

            return (
              <div
                key={ticket.id}
                className="bg-white dark:bg-slate-900 border border-gray-200/90 dark:border-slate-800 hover:border-blue-400 dark:hover:border-slate-700 rounded-3xl p-4 sm:p-6 shadow-xs hover:shadow-md transition-all space-y-4"
              >
                {/* Header: Avatar, Nama, Status Badges, dan Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-800/80">
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* Urutan antrean (jika status antrean) */}
                    {isQueued && statusFilter === 'queued' && (
                      <div className="flex flex-col gap-1 items-center flex-shrink-0 pt-0.5 bg-gray-50 dark:bg-slate-800 p-1.5 rounded-xl border border-gray-200 dark:border-slate-700">
                        <button
                          type="button"
                          disabled={globalIndex === 0}
                          onClick={() => handleMoveQueue(ticket.id, 'up')}
                          className="p-1 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 disabled:opacity-30 transition cursor-pointer"
                          title="Naikkan urutan antrean"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[10px] font-bold text-gray-500 font-mono">
                          #{globalIndex + 1}
                        </span>
                        <button
                          type="button"
                          disabled={globalIndex === filteredTickets.length - 1}
                          onClick={() => handleMoveQueue(ticket.id, 'down')}
                          className="p-1 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 disabled:opacity-30 transition cursor-pointer"
                          title="Turunkan urutan antrean"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 text-white font-extrabold text-base flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                      {ticket.name.trim().charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="text-base sm:text-lg font-bold text-gray-950 dark:text-white tracking-tight break-words">
                        {ticket.name}
                      </h2>

                      {/* Badges Bar: Status, Mode, Pembuat, Waktu */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${getStatusBadgeClass(
                            ticket.status as TicketStatus
                          )}`}
                        >
                          {getStatusLabel(ticket.status as TicketStatus)}
                        </span>

                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-purple-500" />
                          <span>{getModeLabel(ticket.mode)}</span>
                        </span>

                        {ticket.creator_name && (
                          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 flex items-center gap-1">
                            <User className="h-3 w-3 text-gray-400" />
                            <span>Dibuat: {ticket.creator_name}</span>
                          </span>
                        )}

                        {ticket.runner_label && (ticket.status === 'in_conversation' || ticket.status === 'needs_admin') && (
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                            <span>🤖 {ticket.runner_label}</span>
                          </span>
                        )}

                        <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400 flex items-center gap-1 ml-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span>{formatDateWITA(ticket.created_at)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action: Edit, Delete, Detail Chat */}
                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    {ticket.status !== 'queued' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRequeueTicket(ticket);
                        }}
                        disabled={requeuingId === ticket.id}
                        className="p-2 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 transition shadow-2xs disabled:opacity-50"
                        title="Antrekan Ulang (Kirim Ulang Tiket ke Bot)"
                      >
                        <RotateCcw className={`h-4 w-4 ${requeuingId === ticket.id ? 'animate-spin' : ''}`} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingTicket(ticket);
                      }}
                      className="p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition shadow-2xs"
                      title="Edit Tiket & Output"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeletingTicket(ticket);
                      }}
                      className="p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-gray-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition shadow-2xs"
                      title={ticket.status === 'queued' ? 'Hapus dari Antrean' : 'Hapus Tiket'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <Link
                      href={`/ticketing/${ticket.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Detail &amp; Chat</span>
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                {/* DETAIL GRID: INFORMASI LENGKAP DALAM KOTAK LEGA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
                  {/* ID Pelanggan */}
                  <div className="flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 shadow-2xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block tracking-wider">
                        ID Pelanggan
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {ticket.customer_id}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleCopyTicketNumber(ticket.customer_id, `cust-${ticket.id}`, e)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition"
                      title="Salin ID Pelanggan"
                    >
                      {copiedId === `cust-${ticket.id}` ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  {/* No Telepon / WA */}
                  <div className="flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 shadow-2xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block tracking-wider flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5 text-emerald-500" />
                        <span>No. Telepon / WA</span>
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
                        {ticket.phone || '-'}
                      </span>
                    </div>
                    {ticket.phone && (
                      <a
                        href={`https://wa.me/${ticket.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition"
                        title="Buka WhatsApp"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>

                  {/* ID PLN (Jika ada) */}
                  {ticket.pln_id && (
                    <div className="flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 shadow-2xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block tracking-wider flex items-center gap-1">
                          <Zap className="h-2.5 w-2.5 text-amber-500" />
                          <span>ID PLN</span>
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {ticket.pln_id}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleCopyTicketNumber(ticket.pln_id!, `pln-${ticket.id}`, e)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition"
                        title="Salin ID PLN"
                      >
                        {copiedId === `pln-${ticket.id}` ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Alamat Lengkap (Jika ada) */}
                  {ticket.address && (
                    <div className="col-span-1 sm:col-span-2 lg:col-span-3 bg-slate-50/80 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 flex items-start gap-2.5 shadow-2xs">
                      <MapPin className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                      <span className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                        {ticket.address}
                      </span>
                    </div>
                  )}
                </div>

                {/* KELUHAN PELANGGAN */}
                <div className="bg-slate-50/80 dark:bg-slate-800/60 p-3.5 sm:p-4 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Keluhan Pelanggan:</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal whitespace-pre-wrap">
                    {ticket.complaint}
                  </p>
                </div>

                {/* OUTPUT / KESIMPULAN / NOMOR TIKET */}
                {hasTicketNo && (
                  <div
                    className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                      /^[A-Z0-9]{8}$/.test(ticket.ticket_number!)
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-100'
                        : ticket.ticket_number!.toLowerCase().includes('bayar')
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80 text-amber-950 dark:text-amber-100'
                        : 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/80 text-blue-950 dark:text-blue-100'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70">
                        {/^[A-Z0-9]{8}$/.test(ticket.ticket_number!) ? 'Nomor Tiket Resmi' : 'Output / Kesimpulan Tiket'}
                      </span>
                      <span
                        className={`font-bold text-sm sm:text-base block mt-0.5 break-words ${
                          /^[A-Z0-9]{8}$/.test(ticket.ticket_number!)
                            ? 'font-mono text-emerald-700 dark:text-emerald-300 tracking-wider'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {ticket.ticket_number}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleCopyTicketNumber(ticket.ticket_number!, ticket.id, e)}
                      className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs shrink-0"
                      title="Salin Output"
                    >
                      {copiedId === ticket.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          /* ========================================================================= */
          /* TAMPILAN MENU LIST (ULTRA RINGKAS & TERTATA SEPERTI DATA TABLE)           */
          /* ========================================================================= */
          <div className="bg-white dark:bg-slate-900 border border-gray-200/90 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-slate-800/80 shadow-2xs">
            {/* Table Header (Desktop) */}
            <div className="hidden lg:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50/90 dark:bg-slate-800/80 text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider items-center">
              <div className="col-span-4">Pelanggan &amp; ID</div>
              <div className="col-span-3">Keluhan</div>
              <div className="col-span-2">Output / Resolusi</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">Aksi</div>
            </div>

            {/* List Rows */}
            {paginatedTickets.map((ticket, index) => {
              const isQueued = ticket.status === 'queued';
              const hasTicketNo = !!ticket.ticket_number;
              const globalIndex = startIndex + index;

              return (
                <div
                  key={ticket.id}
                  onClick={() => router.push(`/ticketing/${ticket.id}`)}
                  className="group px-3 sm:px-4 py-2 sm:py-2.5 hover:bg-blue-50/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer flex flex-col lg:grid lg:grid-cols-12 gap-1.5 lg:gap-3 items-start lg:items-center"
                >
                  {/* Kolom 1: Pelanggan (Dot Status, Nama, ID, Phone) - Col 4 */}
                  <div className="flex items-center gap-2.5 min-w-0 w-full lg:col-span-4">
                    {/* Status Dot */}
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        ticket.status === 'closed' || ticket.status === 'ticket_issued'
                          ? 'bg-emerald-500'
                          : ticket.status === 'in_conversation'
                          ? 'bg-blue-500 animate-pulse'
                          : ticket.status === 'needs_admin'
                          ? 'bg-amber-500 animate-pulse'
                          : 'bg-gray-400'
                      }`}
                      title={getStatusLabel(ticket.status as TicketStatus)}
                    />

                    {isQueued && statusFilter === 'queued' && (
                      <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-100 dark:bg-slate-800 px-1 py-0.2 rounded">
                        #{globalIndex + 1}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                        <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 truncate group-hover:text-blue-600 transition">
                          {ticket.name}
                        </span>
                        {/* Status mini chip on mobile */}
                        <span
                          className={`lg:hidden text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${getStatusBadgeClass(
                            ticket.status as TicketStatus
                          )}`}
                        >
                          {getStatusLabel(ticket.status as TicketStatus)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-slate-400">
                        <span className="font-mono text-gray-700 dark:text-slate-300 font-semibold">
                          {ticket.customer_id}
                        </span>
                        {ticket.phone && (
                          <>
                            <span>&bull;</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[110px]">
                              {ticket.phone}
                            </span>
                          </>
                        )}
                        <span className="hidden sm:inline">&bull;</span>
                        <span className="hidden sm:inline text-gray-400">
                          {formatDateWITA(ticket.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Kolom 2: Keluhan - Col 3 */}
                  <div className="min-w-0 w-full lg:col-span-3 text-xs text-gray-600 dark:text-slate-300">
                    <p className="line-clamp-1 text-ellipsis">
                      <span className="lg:hidden text-gray-400 font-medium">Keluhan: </span>
                      {ticket.complaint}
                    </p>
                  </div>

                  {/* Kolom 3: Output / Tiket - Col 2 */}
                  <div className="min-w-0 w-full lg:col-span-2">
                    {hasTicketNo ? (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold font-mono bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200 max-w-full">
                        <span className="truncate">{ticket.ticket_number}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyTicketNumber(ticket.ticket_number!, ticket.id, e);
                          }}
                          className="p-0.5 hover:bg-sky-100 dark:hover:bg-sky-900 rounded shrink-0 transition"
                          title="Salin Output"
                        >
                          {copiedId === ticket.id ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </div>

                  {/* Kolom 4: Status Badge (Desktop) - Col 2 */}
                  <div className="hidden lg:flex items-center gap-1.5 col-span-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(
                        ticket.status as TicketStatus
                      )}`}
                    >
                      {getStatusLabel(ticket.status as TicketStatus)}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {formatDateWITA(ticket.created_at)}
                    </span>
                  </div>

                  {/* Kolom 5: Aksi Ringkas - Col 1 */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-end gap-1 w-full lg:col-span-1 self-end lg:self-center shrink-0"
                  >
                    {ticket.status !== 'queued' && (
                      <button
                        type="button"
                        onClick={() => handleRequeueTicket(ticket)}
                        disabled={requeuingId === ticket.id}
                        className="p-1 rounded-md text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
                        title="Antrekan Ulang (Kirim Ulang Tiket ke Bot)"
                      >
                        <RotateCcw className={`h-3.5 w-3.5 ${requeuingId === ticket.id ? 'animate-spin' : ''}`} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setEditingTicket(ticket)}
                      className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition"
                      title="Edit Tiket"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingTicket(ticket)}
                      className="p-1 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition"
                      title="Hapus Tiket"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <Link
                      href={`/ticketing/${ticket.id}`}
                      className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition"
                      title="Buka Chat & Detail"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-gray-200/90 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs transition-colors">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <p className="text-gray-500 dark:text-slate-400">
              Menampilkan <strong className="text-gray-900 dark:text-slate-100">{startIndex + 1}</strong> &ndash;{' '}
              <strong className="text-gray-900 dark:text-slate-100">{endIndex}</strong> dari{' '}
              <strong className="text-gray-900 dark:text-slate-100">{totalItems}</strong> tiket
            </p>

            <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400">
              <span className="hidden sm:inline text-[11px]">Tampilkan:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value={10}>10 / hal</option>
                <option value={20}>20 / hal</option>
                <option value={50}>50 / hal</option>
                <option value={100}>100 / hal</option>
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 self-center sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="px-2.5 sm:px-3 py-1.5 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed font-medium transition flex items-center gap-1 min-h-[34px] cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sebelumnya</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    return (
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - safeCurrentPage) <= 1
                    );
                  })
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;
                    const isActive = p === safeCurrentPage;

                    return (
                      <div key={p} className="flex items-center">
                        {showEllipsis && (
                          <span className="px-1 text-gray-400 dark:text-slate-500 font-bold select-none">
                            ...
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200/60 dark:border-slate-700/60'
                          }`}
                        >
                          {p}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="px-2.5 sm:px-3 py-1.5 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed font-medium transition flex items-center gap-1 min-h-[34px] cursor-pointer"
                title="Halaman Berikutnya"
              >
                <span className="hidden sm:inline">Berikutnya</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Edit Tiket & Output */}
      <TicketEditModal
        isOpen={Boolean(editingTicket)}
        ticket={editingTicket}
        onClose={() => setEditingTicket(null)}
        onSuccess={(updated) => {
          setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          fetchTickets();
        }}
      />

      {/* Modal Hapus Tiket */}
      <DeleteTicketModal
        isOpen={Boolean(deletingTicket)}
        ticket={deletingTicket}
        onClose={() => setDeletingTicket(null)}
        onSuccess={(deletedId) => {
          setTickets((prev) => prev.filter((t) => t.id !== deletedId));
          fetchTickets();
        }}
      />

      {/* Modal Buat Tiket Baru (Alur Wizard: Data Mentah -> Input Manual -> Bukti Foto) */}
      <NewTicketModal
        isOpen={isNewTicketModalOpen}
        onClose={() => {
          setIsNewTicketModalOpen(false);
          if (typeof window !== 'undefined' && (window.location.search.includes('create') || window.location.search.includes('new'))) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }}
        currentUser={currentUser}
        onSuccess={(newTicket) => {
          setTickets((prev) => [newTicket, ...prev]);
          fetchTickets();
        }}
      />
    </div>
  );
}
