'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Globe,
  RefreshCw,
  Upload,
  Loader2,
  Link as LinkIcon,
  AlertCircle,
} from 'lucide-react';
import {
  getAppInitials,
  getDefaultFaviconUrl,
  getDisplayHost,
  normalizeAppUrl,
} from '@/lib/more-apps-utils';
import type { MoreAppItem } from '@/lib/supabase/types';

interface ShortcutModalProps {
  editingItem: MoreAppItem | null;
  onClose: () => void;
  onSave: (payload: { name: string; url: string; iconUrl: string | null }) => Promise<{ success: boolean; error?: string }>;
}

const GRADIENT_CLASSES = [
  'from-blue-500 to-indigo-600',
  'from-sky-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
];

export function pickAppColorClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return GRADIENT_CLASSES[hash % GRADIENT_CLASSES.length];
}

/**
 * Meresize file gambar pilihan user menjadi ikon PNG 128x128 ringkas.
 */
async function resizeImageFileToDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('File bukan gambar yang valid.'));
    el.src = dataUrl;
  });

  const maxDim = 128;
  const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
  const width = Math.max(16, Math.round((img.width || maxDim) * scale));
  const height = Math.max(16, Math.round((img.height || maxDim) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/png', 0.9);
}

export function ShortcutModal({ editingItem, onClose, onSave }: ShortcutModalProps) {
  const [name, setName] = useState(editingItem?.name ?? '');
  const [url, setUrl] = useState(editingItem?.url ?? '');
  const [iconUrl, setIconUrl] = useState(editingItem?.icon_url ?? '');
  const [customIconMode, setCustomIconMode] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastFetchedUrlRef = useRef<string>(editingItem?.url ?? '');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [saving, onClose]);

  const parsedPreviewUrl = normalizeAppUrl(url);
  const fallbackPreviewIcon = parsedPreviewUrl.ok ? getDefaultFaviconUrl(parsedPreviewUrl.url) : null;
  const activePreviewIcon = (iconUrl.trim() || fallbackPreviewIcon || '').trim();

  async function fetchSiteMetadata(targetRawUrl: string, forceRefresh = false) {
    const parsed = normalizeAppUrl(targetRawUrl);
    if (!parsed.ok) return;
    if (!forceRefresh && lastFetchedUrlRef.current === parsed.url && iconUrl.trim()) return;

    setFetchingMeta(true);
    setPreviewFailed(false);
    try {
      const res = await fetch(`/api/more-apps/metadata?url=${encodeURIComponent(parsed.url)}`);
      if (res.ok) {
        const data = (await res.json()) as {
          url?: string;
          iconUrl?: string | null;
          title?: string | null;
        };
        lastFetchedUrlRef.current = parsed.url;
        if (data.iconUrl) {
          setIconUrl(data.iconUrl);
          setPreviewFailed(false);
        }
        if (data.title && !name.trim()) {
          setName(data.title);
        }
      }
    } catch {
      // Abaikan error network; tetap gunakan favicon S2 default
      if (!iconUrl.trim() && fallbackPreviewIcon) {
        setIconUrl(fallbackPreviewIcon);
      }
    } finally {
      setFetchingMeta(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar (PNG, JPG, WebP, atau ICO).');
      return;
    }

    try {
      const resized = await resizeImageFileToDataUrl(file);
      setIconUrl(resized);
      setPreviewFailed(false);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memproses gambar icon.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = normalizeAppUrl(url);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nama aplikasi wajib diisi.');
      return;
    }

    setSaving(true);
    const resolvedIcon = iconUrl.trim() || getDefaultFaviconUrl(parsed.url);
    const res = await onSave({
      name: trimmedName,
      url: parsed.url,
      iconUrl: resolvedIcon,
    });

    if (!res.success) {
      setError(res.error || 'Gagal menyimpan shortcut.');
      setSaving(false);
      return;
    }

    setSaving(false);
    onClose();
  }

  const displayHost = parsedPreviewUrl.ok ? getDisplayHost(parsedPreviewUrl.url) : 'Contoh: qontak.com';
  const isFormValid = name.trim().length > 0 && parsedPreviewUrl.ok;

  return (
    <div
      className="fixed inset-0 !mt-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
              {editingItem ? 'Edit Shortcut Aplikasi' : 'Tambah Shortcut'}
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Icon situs diambil otomatis dari URL yang dimasukkan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Preview Tile + Icon Controls */}
          <div className="flex items-center gap-3.5 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700/80">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-xs flex items-center justify-center overflow-hidden flex-shrink-0 relative">
              {fetchingMeta ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              ) : activePreviewIcon && !previewFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activePreviewIcon}
                  alt={name || 'Preview Icon'}
                  className="w-9 h-9 object-contain"
                  onError={() => setPreviewFailed(true)}
                />
              ) : name.trim() ? (
                <div
                  className={`w-full h-full bg-gradient-to-br ${pickAppColorClass(
                    name
                  )} text-white font-bold text-sm flex items-center justify-center`}
                >
                  {getAppInitials(name)}
                </div>
              ) : (
                <Globe className="h-6 w-6 text-gray-400 dark:text-slate-500" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 dark:text-slate-100 truncate">
                {name.trim() || 'Pratinjau Shortcut'}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate mt-0.5">
                {displayHost}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <button
                  type="button"
                  disabled={!parsedPreviewUrl.ok || fetchingMeta}
                  onClick={() => fetchSiteMetadata(url, true)}
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${fetchingMeta ? 'animate-spin' : ''}`} />
                  Ambil Icon URL
                </button>
                <span className="text-gray-300 dark:text-slate-600">&bull;</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-medium text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1"
                >
                  <Upload className="h-3 w-3" />
                  Upload Icon
                </button>
                <span className="text-gray-300 dark:text-slate-600">&bull;</span>
                <button
                  type="button"
                  onClick={() => setCustomIconMode((v) => !v)}
                  className="text-[11px] font-medium text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1"
                >
                  <LinkIcon className="h-3 w-3" />
                  {customIconMode ? 'Sembunyikan Link' : 'Link Icon'}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="shortcut-name" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              Name
            </label>
            <input
              id="shortcut-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Qontak CRM, MikroTik, Rekap Sheet..."
              maxLength={80}
              required
              autoFocus
              className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px]"
            />
          </div>

          {/* URL */}
          <div>
            <label htmlFor="shortcut-url" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              URL
            </label>
            <input
              id="shortcut-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => {
                if (url.trim()) {
                  void fetchSiteMetadata(url, false);
                }
              }}
              placeholder="https://contoh-aplikasi.com"
              required
              className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px]"
            />
          </div>

          {/* Custom Icon URL Input (Optional) */}
          {customIconMode && (
            <div>
              <label htmlFor="shortcut-icon-url" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                URL Icon Kustom (Opsional)
              </label>
              <input
                id="shortcut-icon-url"
                type="text"
                value={iconUrl}
                onChange={(e) => {
                  setIconUrl(e.target.value);
                  setPreviewFailed(false);
                }}
                placeholder="https://.../icon.png (kosongkan untuk otomatis)"
                className="w-full px-3.5 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px]"
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-900/60">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-full border border-gray-300 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors min-h-[38px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid || saving}
              className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 text-white text-xs font-semibold transition-colors min-h-[38px] inline-flex items-center gap-1.5 shadow-xs"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Done
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
