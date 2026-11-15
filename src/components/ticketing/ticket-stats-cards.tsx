'use client';

import { Clock, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Ticket } from '@/lib/ticketing/types';

interface TicketStatsCardsProps {
  tickets: Ticket[];
  onSelectFilter?: (status: string) => void;
  activeFilter?: string;
}

export function TicketStatsCards({
  tickets,
  onSelectFilter,
  activeFilter = 'all',
}: TicketStatsCardsProps) {
  const queuedCount = tickets.filter((t) => t.status === 'queued').length;
  const inConvCount = tickets.filter((t) => t.status === 'in_conversation').length;
  const needsAdminCount = tickets.filter((t) => t.status === 'needs_admin').length;
  const issuedCount = tickets.filter((t) => t.status === 'ticket_issued').length;

  const stats = [
    {
      id: 'queued',
      label: 'Antrean Tiket',
      count: queuedCount,
      icon: Clock,
      colorText: 'text-amber-600 dark:text-amber-400',
      bgIcon: 'bg-amber-100 dark:bg-amber-950/60',
      borderActive: 'border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/20',
      desc: 'Menunggu dikirim ke Instagram',
    },
    {
      id: 'in_conversation',
      label: 'Sedang Berjalan',
      count: inConvCount,
      icon: Activity,
      colorText: 'text-blue-600 dark:text-blue-400',
      bgIcon: 'bg-blue-100 dark:bg-blue-950/60',
      borderActive: 'border-blue-400 dark:border-blue-600 ring-2 ring-blue-400/20',
      desc: 'Chat aktif dengan CS Iconnet',
      isPulse: inConvCount > 0,
    },
    {
      id: 'needs_admin',
      label: 'Butuh Admin',
      count: needsAdminCount,
      icon: AlertTriangle,
      colorText: 'text-rose-600 dark:text-rose-400',
      bgIcon: 'bg-rose-100 dark:bg-rose-950/60',
      borderActive: 'border-rose-400 dark:border-rose-600 ring-2 ring-rose-400/20',
      desc: 'Pertanyaan di luar data tiket',
      isAlert: needsAdminCount > 0,
    },
    {
      id: 'ticket_issued',
      label: 'Tiket Terbit',
      count: issuedCount,
      icon: CheckCircle2,
      colorText: 'text-emerald-600 dark:text-emerald-400',
      bgIcon: 'bg-emerald-100 dark:bg-emerald-950/60',
      borderActive: 'border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-400/20',
      desc: 'Nomor tiket resmi didapat',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((s) => {
        const Icon = s.icon;
        const isActive = activeFilter === s.id;

        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelectFilter?.(s.id === activeFilter ? 'all' : s.id)}
            className={`text-left p-4 rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-900 shadow-2xs hover:shadow-xs flex flex-col justify-between ${
              isActive
                ? s.borderActive
                : 'border-gray-200/80 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                {s.label}
              </span>
              <div className={`p-2 rounded-xl ${s.bgIcon} ${s.colorText} relative`}>
                <Icon className="h-4 w-4" />
                {s.isPulse && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500 animate-ping" />
                )}
                {s.isAlert && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                )}
              </div>
            </div>

            <div className="mt-2.5">
              <span className="text-2xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">
                {s.count}
              </span>
              <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5 truncate">
                {s.desc}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
