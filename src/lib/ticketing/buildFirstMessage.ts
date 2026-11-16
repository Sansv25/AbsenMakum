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
  const fields: [string, string | null | undefined][] = [
    ['ID Pelanggan', ticket.customer_id],
    ['ID PLN', ticket.pln_id],
    ['Telepon', ticket.phone],
    ['Nama', ticket.name],
    ['Alamat', ticket.address],
    ['Email', ticket.email],
    ['Regional', ticket.regional],
    ['Kantor Perwakilan', ticket.office],
  ];

  const lines: string[] = [];
  for (const [label, val] of fields) {
    if (val && val.trim()) {
      lines.push(label);
      lines.push(val.trim());
    }
  }

  const parts: string[] = [];
  const fieldBlock = lines.join('\n');
  if (fieldBlock) parts.push(fieldBlock);

  const complaint = (ticket.complaint || '').trim();
  if (complaint) parts.push(complaint);

  if (ticket.alt_phone && ticket.alt_phone.trim()) {
    parts.push(`cp alt ${ticket.alt_phone.trim()}`);
  }

  return parts.join('\n\n');
}
