import { z } from 'zod';

export const ticketInputSchema = z.object({
  customer_id: z.string().min(1, 'ID Pelanggan wajib diisi.'),
  pln_id: z.string().optional(),
  phone: z.string().optional(),
  name: z.string().min(1, 'Nama Pelanggan wajib diisi.'),
  address: z.string().optional(),
  email: z.string().optional(),
  regional: z.string().optional(),
  office: z.string().optional(),
  complaint: z.string().min(1, 'Keluhan gangguan pelanggan wajib diisi.'),
});

export type TicketInput = z.infer<typeof ticketInputSchema>;
