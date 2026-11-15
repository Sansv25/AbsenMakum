import { ParsedCustomerData } from './types';

export function parseCustomerBlock(text: string): ParsedCustomerData {
  const result: ParsedCustomerData = {
    customer_id: '',
    pln_id: '',
    phone: '',
    name: '',
    address: '',
    email: '',
    regional: '',
    office: '',
    complaint: '',
  };

  if (!text || typeof text !== 'string') {
    return result;
  }

  // Normalize line endings and split into lines
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  // Recognized field mappings
  const labelMap: { key: keyof Omit<ParsedCustomerData, 'complaint'>; patterns: RegExp[] }[] = [
    { key: 'customer_id', patterns: [/^(?:id\s*pelanggan|customer\s*id|id\s*cust(?:omer)?|id(?!\s*(?:pln|meter)))\b/i] },
    { key: 'pln_id', patterns: [/^(?:id\s*pln|no(?:mor)?\s*meter(?:an)?|id\s*meter)\b/i] },
    { key: 'phone', patterns: [/^(?:telepon|no(?:mor)?\s*(?:tlp|telp|hp|wa|telepon)|phone)\b/i] },
    { key: 'name', patterns: [/^(?:nama\s*pelanggan|nama\s*lengkap|nama(?!\s*(?:wifi|wi-fi|ssid|sandi|hotspot|network|jaringan|perangkat|modem|baru)))\b/i] },
    { key: 'address', patterns: [/^(?:alamat\s*instalasi|alamat\s*lengkap|alamat)\b/i] },
    { key: 'email', patterns: [/^(?:email|e-mail)\b/i] },
    { key: 'regional', patterns: [/^(?:regional|wilayah)\b/i] },
    { key: 'office', patterns: [/^(?:kantor\s*perwakilan|kantor\s*layanan|kantor|kp)\b/i] },
  ];

  type Token = {
    lineIndex: number;
    key: keyof Omit<ParsedCustomerData, 'complaint'>;
    inlineValue?: string;
  };

  const tokens: Token[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    for (const item of labelMap) {
      for (const pattern of item.patterns) {
        // Check if line matches "Label: Value" or "Label = Value" or "Label - Value"
        const matchWithColon = rawLine.match(new RegExp(pattern.source + `\\s*[:=-]\\s*(.*)$`, 'i'));
        if (matchWithColon) {
          tokens.push({ lineIndex: i, key: item.key, inlineValue: matchWithColon[1].trim() });
          break;
        }

        const matchExact = pattern.test(rawLine);
        if (matchExact) {
          tokens.push({ lineIndex: i, key: item.key });
          break;
        }
      }
    }
  }

  // If no tokens found, check if there is an unlabeled customer ID (standalone 10-14 digit number)
  if (tokens.length === 0) {
    const rawLines = lines.map((l) => l.trim()).filter(Boolean);
    const idLineIdx = rawLines.findIndex((l) => /^\d{10,14}$/.test(l));
    if (idLineIdx !== -1) {
      result.customer_id = rawLines[idLineIdx];
      result.complaint = rawLines.filter((_, idx) => idx !== idLineIdx).join('\n');
      return result;
    }

    result.complaint = rawLines.join('\n');
    return result;
  }

  // For each token, extract the value
  for (let idx = 0; idx < tokens.length; idx++) {
    const current = tokens[idx];
    const next = tokens[idx + 1];

    if (current.inlineValue !== undefined && current.inlineValue !== '') {
      result[current.key] = current.inlineValue;
    } else {
      // The value is in subsequent line(s) before the next recognized token
      const startLine = current.lineIndex + 1;
      const endLine = next ? next.lineIndex : -1;
      const collectedLines: string[] = [];

      const maxLine = endLine === -1 ? lines.length : endLine;
      for (let l = startLine; l < maxLine; l++) {
        const lineContent = lines[l].trim();
        if (lineContent) {
          collectedLines.push(lineContent);
        }
      }

      result[current.key] = collectedLines.join(' ');
    }
  }

  // Complaint is everything after the last token's value lines
  const lastToken = tokens[tokens.length - 1];
  let complaintStartLine = lastToken.lineIndex + 1;

  if (lastToken.inlineValue === undefined || lastToken.inlineValue === '') {
    // If last token was multi-line or empty, advance past the value
    for (let l = lastToken.lineIndex + 1; l < lines.length; l++) {
      if (lines[l].trim()) {
        complaintStartLine = l + 1;
        break;
      }
    }
  }

  const complaintLines: string[] = [];
  for (let l = complaintStartLine; l < lines.length; l++) {
    const trimmed = lines[l].trim();
    if (trimmed) {
      complaintLines.push(trimmed);
    }
  }

  result.complaint = complaintLines.join('\n');
  return result;
}
