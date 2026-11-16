import { ParsedCustomerData } from './types';

export function parseCustomerBlock(text: string): ParsedCustomerData {
  const result: ParsedCustomerData = {
    customer_id: '',
    pln_id: '',
    phone: '',
    alt_phone: '',
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
    { key: 'alt_phone', patterns: [/^(?:cp\s*alt(?:ernatif)?|no(?:mor)?\s*(?:alt|alternatif)|(?:telepon|telp|hp|wa)\s*(?:alt|alternatif)|kontak\s*(?:alt|alternatif))\b/i] },
    { key: 'phone', patterns: [/^(?:telepon|no(?:mor)?\s*(?:tlp|telp|hp|wa|telepon)|phone|cp(?!\s*alt))\b/i] },
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

  const consumedLineIndices = new Set<number>();
  const tokens: Token[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    for (const item of labelMap) {
      let matched = false;
      for (const pattern of item.patterns) {
        // 1. Cek apakah baris ini tepat HANYA label saja (tanpa nilai)
        const matchExactOnly = new RegExp(pattern.source + `\\s*$`, 'i').test(rawLine);
        if (matchExactOnly) {
          tokens.push({ lineIndex: i, key: item.key });
          consumedLineIndices.add(i);
          matched = true;
          break;
        }

        // 2. Cek apakah ada delimiter pemisah titik dua/sama dengan/strip (misal: "Nama: Budi", "CP Alt: 08123")
        const matchWithColon = rawLine.match(new RegExp(pattern.source + `\\s*[:=-]\\s*(.+)$`, 'i'));
        if (matchWithColon) {
          tokens.push({ lineIndex: i, key: item.key, inlineValue: matchWithColon[1].trim() });
          consumedLineIndices.add(i);
          matched = true;
          break;
        }

        // 3. Khusus format dengan spasi langsung tanpa titik dua (misal: "cp alt 6285732144668", "ID 151000357186", "Telepon 08123456")
        const matchWithSpace = rawLine.match(new RegExp(pattern.source + `\\s+([+0-9A-Za-z].*)$`, 'i'));
        if (matchWithSpace) {
          const val = matchWithSpace[1].trim();
          // Pastikan baris ini bukan cuma label persis dari key lain
          const isAnotherLabelExact = labelMap.some((m) =>
            m.patterns.some((p) => new RegExp(p.source + `\\s*$`, 'i').test(rawLine))
          );
          if (!isAnotherLabelExact) {
            tokens.push({ lineIndex: i, key: item.key, inlineValue: val });
            consumedLineIndices.add(i);
            matched = true;
            break;
          }
        }
      }
      if (matched) break;
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
      const endLine = next ? next.lineIndex : lines.length;
      const collectedLines: string[] = [];

      for (let l = startLine; l < endLine; l++) {
        const lineContent = lines[l].trim();
        if (lineContent) {
          collectedLines.push(lineContent);
          consumedLineIndices.add(l);
          // For single line fields (all except address), break after first non-empty line
          if (current.key !== 'address') {
            break;
          }
        }
      }

      result[current.key] = collectedLines.join(' ');
    }
  }

  // Baris-baris yang tidak dikonsumsi oleh token apa pun adalah bagian dari keluhan (complaint)
  const complaintLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed && !consumedLineIndices.has(i)) {
      complaintLines.push(trimmed);
    }
  }

  result.complaint = complaintLines.join('\n');
  return result;
}
