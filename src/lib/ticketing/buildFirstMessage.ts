export function buildFirstMessage(ticket: {
  customer_id: string;
  pln_id?: string | null;
  phone?: string | null;
  alt_phone?: string | null;
  name: string;
  address?: string | null;
  email?: string | null;
  regional?: string | null;
  office?: string | null;
  complaint: string;
}): string {
  const parts: string[] = [];

  parts.push(`ID Pelanggan: ${ticket.customer_id || '-'}`);
  if (ticket.pln_id) parts.push(`ID PLN: ${ticket.pln_id}`);
  if (ticket.phone) parts.push(`No Telp/WA: ${ticket.phone}`);
  if (ticket.alt_phone) parts.push(`No Telp/CP Alternatif: ${ticket.alt_phone}`);
  parts.push(`Nama Pelanggan: ${ticket.name || '-'}`);
  if (ticket.address) parts.push(`Alamat: ${ticket.address}`);
  if (ticket.email) parts.push(`Email: ${ticket.email}`);
  if (ticket.regional) parts.push(`Regional: ${ticket.regional}`);
  if (ticket.office) parts.push(`Kantor Perwakilan: ${ticket.office}`);
  parts.push('');
  parts.push(`Keluhan: ${ticket.complaint || '-'}`);
  if (ticket.alt_phone) parts.push(`cp alt ${ticket.alt_phone}`);

  return parts.join('\n');
}
