'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Ticket, TicketStatus } from '@/lib/ticketing/types';
import { getStatusBadgeClass, getStatusLabel, getModeLabel, formatDateWITA } from '@/lib/ticketing/format';
import { TicketStatsCards } from '@/components/ticketing/ticket-stats-cards';
import { TicketControlSwitches } from '@/components/ticketing/ticket-control-switches';
import { TicketAiApprovalBanner } from '@/components/ticketing/ticket-ai-approval-banner';
import { TicketEditModal } from '@/components/ticketing/ticket-edit-modal';
import { DeleteTicketModal } from '@/components/ticketing/delete-ticket-modal';
import {
  Search,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  Ticket as TicketIcon,
  ChevronRight,
  User,
  AlertCircle,
  Inbox,
  Sparkles,
  Pencil,
  Trash2,
} from 'lucide-react';

export default function TicketingDashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [syncing, setSyncing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Queue Order
  const [queueOrder, setQueueOrder] = useState<string[]>([]);

  // Modal States
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [deletingTicket, setDeletingTicket] = useState<Ticket | null>(null);

  // Toggles
  const [autoQueueEnabled, setAutoQueueEnabled] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [dispatchingQueue, setDispatchingQueue] = useState(false);
  const [canCreateTicket, setCanCreateTicket] = useState(false);

  // Pending Draft in Monitoring Mode
  const [pendingDraft, setPendingDraft] = useState<{
    ticket_id: string;
    customer_name: string;
    reply_text: string;
    incoming_text: string;
    created_at: string;
  } | null>(null);
  const [editedDraftText, setEditedDraftText] = useState('');
  const [processingDraft, setProcessingDraft] = useState(false);

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
          .select('role, roles')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => {
            const isMasterEmail = data.user.email?.toLowerCase() === 'madesanjaya255@gmail.com';
            const roles: string[] = Array.isArray(profile?.roles) ? profile.roles : [];
            const isOwner = roles.includes('owner') || isMasterEmail;
            const isAdmin = roles.includes('admin') || profile?.role === 'master';
            const isTiket = roles.includes('tiket');
            setCanCreateTicket(isOwner || isAdmin || isTiket);
          });
      }
    });

    const checkDraft = () => {
      fetch('/api/ticketing/ai/pending-reply')
        .then((r) => r.json())
        .then((d) => {
          if (d?.pending) {
            setPendingDraft((prev) => {
              if (
                !prev ||
                prev.created_at !== d.pending.created_at ||
                prev.incoming_text !== d.pending.incoming_text ||
                prev.reply_text !== d.pending.reply_text
              ) {
                setEditedDraftText(d.pending.reply_text || '');
              }
              return d.pending;
            });
          } else {
            setPendingDraft(null);
            setEditedDraftText('');
          }
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

    // Supabase Realtime subscription
    const supabase = createClient();
    const channel = supabase
      .channel('tickets-realtime-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
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
    const nextVal = !autoQueueEnabled;
    setAutoQueueEnabled(nextVal);
    await fetch('/api/ticketing/queue/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: nextVal }),
    });
  };

  const handleToggleAi = async () => {
    const nextVal = !aiEnabled;
    setAiEnabled(nextVal);
    await fetch('/api/ticketing/ai/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: nextVal }),
    });
  };

  const handleToggleMonitoring = async () => {
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
    } finally {
      setSyncing(false);
    }
  };

  // Draf yang valid hanya jika tiket terkait masih aktif dan belum terbit / selesai
  const activeDraft = useMemo(() => {
    if (!pendingDraft) return null;
    const targetTicket = tickets.find((t) => t.id === pendingDraft.ticket_id);
    if (targetTicket) {
      if (
        targetTicket.status === 'ticket_issued' ||
        targetTicket.status === 'closed' ||
        targetTicket.status === 'failed' ||
        Boolean(targetTicket.ticket_number)
      ) {
        return null;
      }
    }
    return pendingDraft;
  }, [pendingDraft, tickets]);

  const handleApproveDraft = async () => {
    if (!activeDraft) return;
    setProcessingDraft(true);
    try {
      await fetch('/api/ticketing/ai/pending-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          ticketId: activeDraft.ticket_id,
          replyText: editedDraftText,
        }),
      });
      setPendingDraft(null);
      await fetchTickets();
    } finally {
      setProcessingDraft(false);
    }
  };

  const handleRejectDraft = async () => {
    if (!activeDraft) return;
    setProcessingDraft(true);
    try {
      await fetch('/api/ticketing/ai/pending-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          ticketId: activeDraft.ticket_id,
        }),
      });
      setPendingDraft(null);
      await fetchTickets();
    } finally {
      setProcessingDraft(false);
    }
  };

  const persistQueueOrder = async (newOrder: string[]) => {
    setQueueOrder(newOrder);
    await fetch('/api/ticketing/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketIds: newOrder }),
    });
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
            <Link
              href="/ticketing/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
            >
              <TicketIcon className="h-3.5 w-3.5" />
              <span>+ Buat Tiket Baru</span>
            </Link>
          )}

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
      />

      {/* AI Approval Floating Banner */}
      <TicketAiApprovalBanner
        draft={activeDraft}
        editedText={editedDraftText}
        onTextChange={setEditedDraftText}
        onApprove={handleApproveDraft}
        onReject={handleRejectDraft}
        processing={processingDraft}
      />

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-gray-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
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
                onClick={() => setStatusFilter(tab.key)}
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

        <div className="relative min-w-[220px]">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, ID, tiket, pembuat..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Ticket Cards Grid / List */}
      <div className="space-y-3">
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
              <Link
                href="/ticketing/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
              >
                <TicketIcon className="h-3.5 w-3.5" />
                <span>Buat Tiket Baru Sekarang</span>
              </Link>
            ) : (
              <p className="text-[11px] text-gray-400 dark:text-slate-500">
                Pembuatan tiket gangguan hanya diizinkan untuk akun dengan <strong>Role Tiket</strong>.
              </p>
            )}
          </div>
        ) : (
          filteredTickets.map((ticket, index) => {
            const isQueued = ticket.status === 'queued';
            const hasTicketNo = !!ticket.ticket_number;

            return (
              <div
                key={ticket.id}
                className="group bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                {/* Left info */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Reorder buttons if queued */}
                  {isQueued && statusFilter === 'queued' && (
                    <div className="flex flex-col gap-1 items-center flex-shrink-0 pt-0.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveQueue(ticket.id, 'up')}
                        className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 disabled:opacity-30 transition"
                        title="Naikkan urutan antrean"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-[10px] font-bold text-gray-400 font-mono">
                        #{index + 1}
                      </span>
                      <button
                        type="button"
                        disabled={index === filteredTickets.length - 1}
                        onClick={() => handleMoveQueue(ticket.id, 'down')}
                        className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 disabled:opacity-30 transition"
                        title="Turunkan urutan antrean"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Customer Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-2xs mt-0.5">
                    {ticket.name.trim().charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">
                        {ticket.name}
                      </span>

                      {/* Status badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(
                          ticket.status as TicketStatus
                        )}`}
                      >
                        {getStatusLabel(ticket.status as TicketStatus)}
                      </span>

                      {/* Mode AI badge */}
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                        {getModeLabel(ticket.mode)}
                      </span>

                      {/* Creator attribution badge */}
                      {ticket.creator_name && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 flex items-center gap-1">
                          <User className="h-2.5 w-2.5 text-gray-400" />
                          <span>Dibuat: {ticket.creator_name}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-slate-400">
                      <span>ID: <strong className="text-gray-700 dark:text-slate-200">{ticket.customer_id}</strong></span>
                      {ticket.phone && (
                        <>
                          <span>&bull;</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{ticket.phone}</span>
                        </>
                      )}
                      <span>&bull;</span>
                      <span className="text-gray-400">{formatDateWITA(ticket.created_at)}</span>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-slate-300 line-clamp-1 text-ellipsis pr-4">
                      {ticket.complaint}
                    </p>
                  </div>
                </div>

                {/* Right action / Ticket Number highlight */}
                <div className="flex items-center gap-3 self-end sm:self-center flex-shrink-0">
                  {hasTicketNo && (
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-2xs max-w-xs ${
                        /^[A-Z0-9]{8}$/.test(ticket.ticket_number!)
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800'
                          : ticket.ticket_number!.toLowerCase().includes('bayar')
                          ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800'
                          : 'bg-sky-50 dark:bg-sky-950/50 border-sky-300 dark:border-sky-800'
                      }`}
                    >
                      <div className="min-w-0">
                        <span
                          className={`text-[9px] uppercase tracking-wider font-bold block ${
                            /^[A-Z0-9]{8}$/.test(ticket.ticket_number!)
                              ? 'text-emerald-800 dark:text-emerald-300'
                              : ticket.ticket_number!.toLowerCase().includes('bayar')
                              ? 'text-amber-800 dark:text-amber-300'
                              : 'text-sky-800 dark:text-sky-300'
                          }`}
                        >
                          {/^[A-Z0-9]{8}$/.test(ticket.ticket_number!) ? 'Nomor Tiket' : 'Output / Kesimpulan'}
                        </span>
                        <span
                          className={`font-semibold text-xs tracking-tight line-clamp-1 ${
                            /^[A-Z0-9]{8}$/.test(ticket.ticket_number!)
                              ? 'font-mono font-extrabold text-sm text-emerald-950 dark:text-emerald-200 tracking-wider'
                              : ticket.ticket_number!.toLowerCase().includes('bayar')
                              ? 'text-amber-950 dark:text-amber-200'
                              : 'text-sky-950 dark:text-sky-200'
                          }`}
                        >
                          {ticket.ticket_number}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleCopyTicketNumber(ticket.ticket_number!, ticket.id, e)}
                        className={`p-1.5 rounded-lg transition shrink-0 ${
                          /^[A-Z0-9]{8}$/.test(ticket.ticket_number!)
                            ? 'hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                            : 'hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300'
                        }`}
                        title="Salin Nomor Tiket / Output"
                      >
                        {copiedId === ticket.id ? (
                          <Check className="h-4 w-4 text-emerald-600 animate-scale" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
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
                    className="inline-flex items-center gap-1 px-3.5 py-2 bg-gray-100 hover:bg-blue-600 hover:text-white dark:bg-slate-800 dark:hover:bg-blue-600 text-gray-700 dark:text-slate-200 rounded-xl text-xs font-bold transition shadow-2xs min-h-[38px]"
                  >
                    <span>Detail &amp; Chat</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

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
    </div>
  );
}
