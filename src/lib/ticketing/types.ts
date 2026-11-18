export type TicketStatus =
  | 'queued'
  | 'in_conversation'
  | 'needs_admin'
  | 'ticket_issued'
  | 'closed'
  | 'failed';

export type TicketMode = 'ai' | 'manual';

export type MessageDirection = 'in' | 'out';

export type MessageSender = 'iconnet' | 'ai' | 'admin' | 'system';

export interface PendingAiReplyDraft {
  ticket_id: string;
  customer_name: string;
  reply_text: string;
  incoming_text: string;
  created_at: string;
  runner_label?: string | null;
}

export interface BotWorkerInfo {
  bot_id: string;
  ig_user_id: string;
  ig_username: string | null;
  user_email: string;
  hostname: string;
  active_ticket_id: string | null;
  status: 'online' | 'paused' | 'offline';
  last_heartbeat: string;
  seconds_ago?: number;
}

export interface Ticket {
  id: string;
  customer_id: string;
  pln_id: string | null;
  phone: string | null;
  alt_phone?: string | null;
  name: string;
  address: string | null;
  email: string | null;
  regional: string | null;
  office: string | null;
  complaint: string;
  status: TicketStatus;
  mode: TicketMode;
  ticket_number: string | null;
  ai_turns: number;
  queue_order?: number;
  created_by: string | null;
  creator_name?: string | null;
  runner_id?: string | null;
  runner_ig_id?: string | null;
  runner_label?: string | null;
  pending_ai_reply?: PendingAiReplyDraft | null;
  started_at: string | null;
  ticket_issued_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketImage {
  id: string;
  ticket_id: string;
  storage_path: string;
  mime: string;
  size_bytes: number | null;
  created_at: string;
}

export interface Message {
  id: string;
  ticket_id: string | null;
  direction: MessageDirection;
  sender: MessageSender;
  body: string | null;
  media_path: string | null;
  ig_mid: string | null;
  created_at: string;
}

export interface TicketingSetting {
  key: string;
  value: unknown;
}

export interface ParsedCustomerData {
  customer_id: string;
  pln_id: string;
  phone: string;
  alt_phone: string;
  name: string;
  address: string;
  email: string;
  regional: string;
  office: string;
  complaint: string;
}
