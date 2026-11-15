export function buildFirstMessage(ticket: {
  customer_id: string;
  pln_id?: string | null;
  phone?: string | null;
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

  const complaint = (ticket.complaint || '').trim();
  if (complaint) {
    return `${lines.join('\n')}\n\n${complaint}`;
  }
  return lines.join('\n');
}
