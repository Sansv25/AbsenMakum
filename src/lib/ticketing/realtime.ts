import type { SupabaseClient } from '@supabase/supabase-js';

export const TICKETS_REALTIME_CHANNEL = 'tickets-realtime-feed';

export interface TicketBroadcastPayload {
  action: 'create' | 'update' | 'delete' | 'requeue' | 'reorder' | 'sync';
  ticketId?: string;
  ticket?: unknown;
  queueOrder?: string[];
  timestamp: number;
}

/**
 * Menyiarkan perubahan tiket secara real-time via Supabase WebSocket Broadcast
 * ke semua perangkat/tab browser yang sedang membuka halaman /ticketing.
 */
export async function broadcastTicketChange(
  supabase: SupabaseClient,
  action: TicketBroadcastPayload['action'],
  payload?: {
    ticketId?: string;
    ticket?: unknown;
    queueOrder?: string[];
  }
) {
  try {
    const channel = supabase.channel(TICKETS_REALTIME_CHANNEL);
    await channel.send({
      type: 'broadcast',
      event: 'ticket_changed',
      payload: {
        action,
        ticketId: payload?.ticketId,
        ticket: payload?.ticket,
        queueOrder: payload?.queueOrder,
        timestamp: Date.now(),
      },
    });
  } catch (err) {
    console.warn('Realtime broadcastTicketChange failed:', err);
  }
}
