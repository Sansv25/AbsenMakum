'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  FileDown,
  Loader2,
  AlertCircle,
  ArrowLeftRight,
  Upload,
  Check,
  Briefcase,
  GraduationCap,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import {
  generateAttendancePdf,
  type PdfAttendanceItem,
  type NotaTableRow,
  type NotaPdfConfig,
} from '@/lib/pdf';
import { jobLabel, shiftNumber } from '@/lib/shifts';
import { showAlert } from '@/lib/swal';

interface NotaTableModalProps {
  isOpen: boolean;
  attendances: PdfAttendanceItem[];
  startDate: string;
  endDate: string;
  onClose: () => void;
  onSuccess: () => void;
}

function getTodayFormattedWita(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Makassar',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(new Date());
    const d = parts.find((p) => p.type === 'day')?.value ?? '01';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
    return `${d}/${m}/${y}`;
  } catch {
    return new Date().toLocaleDateString('en-GB');
  }
}

function createRowId(): string {
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildInitialTables(attendances: PdfAttendanceItem[]): {
  magangRows: NotaTableRow[];
  freelanceRows: NotaTableRow[];
} {
  const defaultDate = getTodayFormattedWita();

  interface OfficerGroup {
    key: string;
    name: string;
    isFreelance: boolean;
    jobs: Map<string, Set<number>>;
  }

  const groups = new Map<string, OfficerGroup>();

  for (const item of attendances) {
    const name = item.author_name?.trim() || 'Petugas Piket';
    const key = item.author_id || `name:${name.toLowerCase()}`;
    const roles = item.author_roles ?? [];
    const isFreelance = roles.includes('freelance');

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name,
        isFreelance,
        jobs: new Map(),
      });
    }

    const g = groups.get(key)!;
    if (isFreelance) {
      g.isFreelance = true;
    }

    const jLabel = item.job_type ? jobLabel(item.job_type) : 'Operasional';
    const sNum = shiftNumber(item.shift_type);
    if (!g.jobs.has(jLabel)) {
      g.jobs.set(jLabel, new Set());
    }
    g.jobs.get(jLabel)!.add(sNum);
  }

  const magangRows: NotaTableRow[] = [];
  const freelanceRows: NotaTableRow[] = [];

  for (const g of groups.values()) {
    const activityParts: string[] = [];
    for (const [jName, shiftSet] of g.jobs.entries()) {
      const nums = Array.from(shiftSet).sort((a, b) => a - b);
      if (nums.length === 2 && nums[0] === 1 && nums[1] === 2) {
        activityParts.push(`${jName} Shift 1 dan 2`);
      } else {
        activityParts.push(`${jName} Shift ${nums.join(', ')}`);
      }
    }

    const row: NotaTableRow = {
      id: createRowId(),
      authorId: g.key.startsWith('name:') ? undefined : g.key,
      sourceName: g.name,
      no: '',
      tglProses: defaultDate,
      namaPenerima: g.name,
      kegiatan: activityParts.join(' dan ') || 'Piket Operasional',
      noRek: '',
      namaBank: '',
      buktiTf: '',
      buktiTfImageUrl: null,
      nominal: 0,
    };

    if (g.isFreelance) {
      freelanceRows.push(row);
    } else {
      magangRows.push(row);
    }
  }

  magangRows.forEach((r, idx) => {
    r.no = String(idx + 1);
  });
  freelanceRows.forEach((r, idx) => {
    r.no = String(idx + 1);
  });

  return { magangRows, freelanceRows };
}

function readFileAsCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('File gambar kosong.'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak valid.'));
      img.onload = () => {
        const maxDim = 1200;
        let w = img.naturalWidth || 800;
        let h = img.naturalHeight || 800;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

function formatNominalDisplay(val: number): string {
  if (!val || val <= 0) return '';
  return Math.round(val).toLocaleString('en-US');
}

export function NotaTableModal({
  isOpen,
  attendances,
  startDate,
  endDate,
  onClose,
  onSuccess,
}: NotaTableModalProps) {
  const [title, setTitle] = useState('');
  const [magangTitle, setMagangTitle] = useState('Komisi Penjualan Magang');
  const [freelanceTitle, setFreelanceTitle] = useState('Komisi Penjualan Freelance');
  const [bulkDate, setBulkDate] = useState(getTodayFormattedWita());
  const [magangRows, setMagangRows] = useState<NotaTableRow[]>([]);
  const [freelanceRows, setFreelanceRows] = useState<NotaTableRow[]>([]);
  const [includeEmptyTables, setIncludeEmptyTables] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const { magangRows: initMagang, freelanceRows: initFreelance } = buildInitialTables(attendances);
    setMagangRows(initMagang);
    setFreelanceRows(initFreelance);
    setBulkDate(getTodayFormattedWita());
    setErrorMsg(null);
    setProgressMsg(null);
    setProgressPercent(0);
  }, [isOpen, attendances]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const magangTotal = useMemo(
    () => magangRows.reduce((acc, r) => acc + (Number.isFinite(r.nominal) ? r.nominal : 0), 0),
    [magangRows]
  );

  const freelanceTotal = useMemo(
    () => freelanceRows.reduce((acc, r) => acc + (Number.isFinite(r.nominal) ? r.nominal : 0), 0),
    [freelanceRows]
  );

  if (!isOpen) return null;

  function applyBulkDateToAll() {
    const clean = bulkDate.trim();
    if (!clean) return;
    setMagangRows((prev) => prev.map((r) => ({ ...r, tglProses: clean })));
    setFreelanceRows((prev) => prev.map((r) => ({ ...r, tglProses: clean })));
  }

  function updateRow(
    group: 'magang' | 'freelance',
    id: string,
    patch: Partial<NotaTableRow>
  ) {
    const setter = group === 'magang' ? setMagangRows : setFreelanceRows;
    setter((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow(group: 'magang' | 'freelance') {
    const setter = group === 'magang' ? setMagangRows : setFreelanceRows;
    setter((prev) => [
      ...prev,
      {
        id: createRowId(),
        no: String(prev.length + 1),
        tglProses: bulkDate.trim() || getTodayFormattedWita(),
        namaPenerima: '',
        kegiatan: '',
        noRek: '',
        namaBank: '',
        buktiTf: '',
        buktiTfImageUrl: null,
        nominal: 0,
      },
    ]);
  }

  function deleteRow(group: 'magang' | 'freelance', id: string) {
    const setter = group === 'magang' ? setMagangRows : setFreelanceRows;
    setter((prev) =>
      prev
        .filter((r) => r.id !== id)
        .map((r, idx) => ({ ...r, no: String(idx + 1) }))
    );
  }

  function moveRow(fromGroup: 'magang' | 'freelance', id: string) {
    const source = fromGroup === 'magang' ? magangRows : freelanceRows;
    const target = fromGroup === 'magang' ? freelanceRows : magangRows;
    const item = source.find((r) => r.id === id);
    if (!item) return;

    const nextSource = source
      .filter((r) => r.id !== id)
      .map((r, idx) => ({ ...r, no: String(idx + 1) }));
    const nextTarget = [...target, item].map((r, idx) => ({ ...r, no: String(idx + 1) }));

    if (fromGroup === 'magang') {
      setMagangRows(nextSource);
      setFreelanceRows(nextTarget);
    } else {
      setFreelanceRows(nextSource);
      setMagangRows(nextTarget);
    }
  }

  async function handleUploadBuktiImage(
    group: 'magang' | 'freelance',
    row: NotaTableRow,
    file?: File
  ) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      await showAlert('Format Salah', 'File bukti transfer harus berupa gambar (JPG/PNG/WebP).', 'warning');
      return;
    }
    try {
      const dataUrl = await readFileAsCompressedDataUrl(file);
      updateRow(group, row.id, {
        buktiTfImageUrl: dataUrl,
        buktiTf: row.buktiTf.trim() ? row.buktiTf : 'v',
      });
    } catch (err: unknown) {
      await showAlert(
        'Gagal Memuat Gambar',
        err instanceof Error ? err.message : 'Gagal memproses gambar bukti TF.',
        'error'
      );
    }
  }

  async function handleGeneratePdf() {
    setErrorMsg(null);
    setGenerating(true);
    setProgressMsg('Menyiapkan dokumen Nota & PDF Piket...');
    setProgressPercent(10);

    const notaConfig: NotaPdfConfig = {
      title: title.trim(),
      magangTitle: magangTitle.trim() || 'Komisi Penjualan Magang',
      freelanceTitle: freelanceTitle.trim() || 'Komisi Penjualan Freelance',
      magangRows,
      freelanceRows,
      includeEmptyTables,
    };

    try {
      await generateAttendancePdf(
        attendances,
        startDate,
        endDate,
        (current, total, msg) => {
          const percent = 15 + Math.round((current / total) * 80);
          setProgressPercent(percent);
          setProgressMsg(msg);
        },
        notaConfig
      );

      setProgressPercent(100);
      setProgressMsg('Dokumen PDF berhasil diunduh!');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat dokumen PDF.');
    } finally {
      setGenerating(false);
    }
  }

  function renderTableEditor(
    group: 'magang' | 'freelance',
    rows: NotaTableRow[],
    sectionTitle: string,
    onSectionTitleChange: (val: string) => void,
    totalNominal: number
  ) {
    const isFreelance = group === 'freelance';
    return (
      <div className="border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
        {/* Banner Header */}
        <div
          className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 ${
            isFreelance
              ? 'bg-teal-600 dark:bg-teal-800 text-white'
              : 'bg-blue-600 dark:bg-blue-800 text-white'
          }`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            {isFreelance ? (
              <Briefcase className="h-4 w-4 shrink-0" />
            ) : (
              <GraduationCap className="h-4 w-4 shrink-0" />
            )}
            <input
              type="text"
              value={sectionTitle}
              onChange={(e) => onSectionTitleChange(e.target.value)}
              disabled={generating}
              className="bg-white/15 hover:bg-white/25 focus:bg-white/25 text-white placeholder:text-white/70 font-bold text-xs sm:text-sm px-2.5 py-1 rounded-lg border border-white/25 focus:outline-none w-full max-w-xs"
              placeholder={isFreelance ? 'Komisi Penjualan Freelance' : 'Komisi Penjualan Magang'}
            />
            <span className="text-[11px] bg-black/20 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
              {rows.length} baris
            </span>
          </div>

          <button
            type="button"
            disabled={generating}
            onClick={() => addRow(group)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah Baris</span>
          </button>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-amber-300 dark:bg-amber-500/80 text-slate-950 font-bold uppercase text-[10.5px]">
                <th className="border-b border-r border-amber-400 dark:border-amber-600 px-2 py-2 w-12 text-center">
                  No
                </th>
                <th className="border-b border-r border-amber-400 dark:border-amber-600 px-2 py-2 w-28 text-center">
                  Tgl Proses
                </th>
                <th className="border-b border-r border-amber-400 dark:border-amber-600 px-2 py-2 min-w-[140px] text-left">
                  Nama Penerima
                </th>
                <th className="border-b border-r border-amber-400 dark:border-amber-600 px-2 py-2 min-w-[190px] text-left">
                  Kegiatan
                </th>
                <th className="border-b border-r border-amber-400 dark:border-amber-600 px-2 py-2 min-w-[135px] text-left">
                  No Rek / E-Wallet
                </th>
                <th className="border-b border-r border-amber-400 dark:border-amber-600 px-2 py-2 min-w-[125px] text-left">
                  Nama Bank / E-Wallet
                </th>
                <th className="border-b border-r border-amber-400 dark:border-amber-600 px-2 py-2 min-w-[130px] text-center">
                  Bukti TF
                </th>
                <th className="border-b border-r border-amber-400 dark:border-amber-600 px-2 py-2 min-w-[120px] text-right">
                  Nominal (Rp)
                </th>
                <th className="border-b border-amber-400 dark:border-amber-600 px-2 py-2 w-20 text-center">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-5 text-center text-gray-400 dark:text-slate-500 text-xs"
                  >
                    Belum ada data petugas di tabel ini. Klik <strong>+ Tambah Baris</strong> atau pindahkan baris dari tabel lain.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="border-r border-gray-200 dark:border-slate-700 p-1.5">
                      <input
                        type="text"
                        value={row.no}
                        onChange={(e) => updateRow(group, row.id, { no: e.target.value })}
                        disabled={generating}
                        className="w-full px-1.5 py-1.5 text-center border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="border-r border-gray-200 dark:border-slate-700 p-1.5">
                      <input
                        type="text"
                        value={row.tglProses}
                        onChange={(e) => updateRow(group, row.id, { tglProses: e.target.value })}
                        disabled={generating}
                        placeholder="DD/MM/YYYY"
                        className="w-full px-2 py-1.5 text-center border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="border-r border-gray-200 dark:border-slate-700 p-1.5">
                      <input
                        type="text"
                        value={row.namaPenerima}
                        onChange={(e) =>
                          updateRow(group, row.id, { namaPenerima: e.target.value })
                        }
                        disabled={generating}
                        placeholder="Nama penerima..."
                        className="w-full px-2 py-1.5 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                      />
                    </td>
                    <td className="border-r border-gray-200 dark:border-slate-700 p-1.5">
                      <input
                        type="text"
                        value={row.kegiatan}
                        onChange={(e) => updateRow(group, row.id, { kegiatan: e.target.value })}
                        disabled={generating}
                        placeholder="Marketer Shift 2..."
                        className="w-full px-2 py-1.5 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="border-r border-gray-200 dark:border-slate-700 p-1.5">
                      <input
                        type="text"
                        value={row.noRek}
                        onChange={(e) => updateRow(group, row.id, { noRek: e.target.value })}
                        disabled={generating}
                        placeholder="Isi no rek / HP"
                        className="w-full px-2 py-1.5 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </td>
                    <td className="border-r border-gray-200 dark:border-slate-700 p-1.5">
                      <input
                        type="text"
                        value={row.namaBank}
                        onChange={(e) => updateRow(group, row.id, { namaBank: e.target.value })}
                        disabled={generating}
                        placeholder="Mandiri / Dana..."
                        className="w-full px-2 py-1.5 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="border-r border-gray-200 dark:border-slate-700 p-1.5">
                      <div className="flex items-center gap-1 justify-center">
                        <input
                          type="text"
                          value={row.buktiTf}
                          onChange={(e) => updateRow(group, row.id, { buktiTf: e.target.value })}
                          disabled={generating}
                          placeholder="-"
                          title="Ketik tanda bukti TF (misal: v)"
                          className="w-11 px-1.5 py-1.5 text-center border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                        />
                        <button
                          type="button"
                          disabled={generating}
                          onClick={() =>
                            updateRow(group, row.id, {
                              buktiTf: row.buktiTf.trim() === 'v' ? '' : 'v',
                            })
                          }
                          title="Toggle centang v"
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            row.buktiTf.trim() === 'v'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <label
                          title="Upload foto struk TF (opsional, ikut masuk lampiran PDF)"
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            row.buktiTfImageUrl
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {row.buktiTfImageUrl ? (
                            <ImageIcon className="h-3.5 w-3.5" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={generating}
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              handleUploadBuktiImage(group, row, f);
                            }}
                          />
                        </label>
                        {row.buktiTfImageUrl && (
                          <button
                            type="button"
                            disabled={generating}
                            onClick={() =>
                              updateRow(group, row.id, { buktiTfImageUrl: null })
                            }
                            title="Hapus foto struk TF"
                            className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="border-r border-gray-200 dark:border-slate-700 p-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.nominal > 0 ? String(row.nominal) : ''}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^0-9]/g, '');
                          updateRow(group, row.id, {
                            nominal: digits ? parseInt(digits, 10) : 0,
                          });
                        }}
                        disabled={generating}
                        placeholder="0"
                        className="w-full px-2 py-1.5 text-right border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </td>
                    <td className="p-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          disabled={generating}
                          onClick={() => moveRow(group, row.id)}
                          title={
                            isFreelance
                              ? 'Pindahkan ke tabel Magang'
                              : 'Pindahkan ke tabel Freelance'
                          }
                          className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition cursor-pointer"
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={generating}
                          onClick={() => deleteRow(group, row.id)}
                          title="Hapus baris ini"
                          className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-amber-200/90 dark:bg-amber-500/30 text-slate-950 dark:text-amber-200 font-bold">
                <td colSpan={7} className="px-3 py-2 text-center border-r border-amber-300 dark:border-amber-700">
                  TOTAL
                </td>
                <td className="px-3 py-2 text-right font-mono border-r border-amber-300 dark:border-amber-700">
                  Rp {formatNominalDisplay(totalNominal) || '0'}
                </td>
                <td className="px-2 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-gray-50/70 dark:bg-slate-900">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm sm:text-base truncate">
                Edit Tabel Nota &amp; Judul Sebelum Export PDF
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {attendances.length} laporan shift ditemukan ({startDate} s/d {endDate}). No, Nama, &amp; Kegiatan terisi otomatis dan dapat diubah.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={generating}
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Judul Dokumen & Tgl Proses Massal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                Judul Dokumen Nota (Isi Sendiri)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={generating}
                placeholder="Contoh: NOTA SALES BATCH 4 (TAD)"
                className="w-full px-3.5 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
                Samakan Tgl Proses Semua Baris
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  disabled={generating}
                  placeholder="DD/MM/YYYY"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  disabled={generating}
                  onClick={applyBulkDateToAll}
                  className="px-3 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white text-xs font-semibold rounded-xl whitespace-nowrap transition cursor-pointer"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>

          {/* Tabel 1: Komisi Penjualan Magang */}
          {renderTableEditor(
            'magang',
            magangRows,
            magangTitle,
            setMagangTitle,
            magangTotal
          )}

          {/* Tabel 2: Komisi Penjualan Freelance */}
          {renderTableEditor(
            'freelance',
            freelanceRows,
            freelanceTitle,
            setFreelanceTitle,
            freelanceTotal
          )}

          {(magangRows.length === 0 || freelanceRows.length === 0) && (
            <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeEmptyTables}
                onChange={(e) => setIncludeEmptyTables(e.target.checked)}
                disabled={generating}
                className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
              />
              <span>Tetap tampilkan tabel yang kosong (0 baris) di PDF</span>
            </label>
          )}

          {generating && (
            <div className="space-y-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  {progressMsg || 'Memproses dokumen PDF...'}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="text-[11px] text-gray-500 dark:text-slate-400">
            Total Gabungan: <strong className="text-gray-800 dark:text-slate-200">Rp {formatNominalDisplay(magangTotal + freelanceTotal) || '0'}</strong> • Urutan PDF: Tabel &amp; Foto Magang, lalu Tabel &amp; Foto Freelance (grid ringkas).
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={generating}
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition min-h-[42px]"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={generating}
              onClick={handleGeneratePdf}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm min-h-[42px] cursor-pointer"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Membuat PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  <span>Buat &amp; Download PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
