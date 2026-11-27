'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutGrid,
  Plus,
  Search,
  ExternalLink,
  Pencil,
  Trash2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  X,
  ShieldCheck,
} from 'lucide-react';
import {
  createMoreAppAction,
  deleteMoreAppAction,
  reorderMoreAppsAction,
  updateMoreAppAction,
} from './actions';
import { ShortcutModal, pickAppColorClass } from './shortcut-modal';
import {
  getAppInitials,
  getDefaultFaviconUrl,
  getDisplayHost,
  normalizeAppUrl,
} from '@/lib/more-apps-utils';
import { showAlert, showConfirm, showToast } from '@/lib/swal';
import type { MoreAppItem } from '@/lib/supabase/types';

interface MoreAppClientProps {
  initialItems: MoreAppItem[];
  canManage: boolean;
}

function AppIconImage({ item }: { item: MoreAppItem }) {
  const defaultS2 = getDefaultFaviconUrl(item.url);
  const initialSrc = item.icon_url || defaultS2;
  const [src, setSrc] = useState<string | null>(initialSrc);
  const [triedFallback, setTriedFallback] = useState(false);

  // Sync jika props icon_url berubah setelah edit
  const [prevIcon, setPrevIcon] = useState(item.icon_url);
  const [prevUrl, setPrevUrl] = useState(item.url);
  if (item.icon_url !== prevIcon || item.url !== prevUrl) {
    setPrevIcon(item.icon_url);
    setPrevUrl(item.url);
    setSrc(item.icon_url || defaultS2);
    setTriedFallback(false);
  }

  function handleImgError() {
    if (!triedFallback && defaultS2 && src !== defaultS2) {
      setTriedFallback(true);
      setSrc(defaultS2);
      return;
    }
    setSrc(null);
  }

  return (
    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700 shadow-xs flex items-center justify-center overflow-hidden flex-shrink-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={item.name}
          onError={handleImgError}
          className="w-9 h-9 object-contain"
        />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br ${pickAppColorClass(
            item.name
          )} text-white font-bold text-base flex items-center justify-center`}
        >
          {getAppInitials(item.name)}
        </div>
      )}
    </div>
  );
}

export function MoreAppClient({ initialItems, canManage }: MoreAppClientProps) {
  const router = useRouter();
  const [prevInitial, setPrevInitial] = useState(initialItems);
  const [items, setItems] = useState<MoreAppItem[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MoreAppItem | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (initialItems !== prevInitial) {
    setPrevInitial(initialItems);
    setItems(initialItems);
  }

  const normalizedQuery = searchQuery.toLowerCase().trim();
  const filteredItems = normalizedQuery
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(normalizedQuery) ||
          item.url.toLowerCase().includes(normalizedQuery)
      )
    : items;

  function openAddModal() {
    setEditingItem(null);
    setModalOpen(true);
  }

  function openEditModal(item: MoreAppItem) {
    setEditingItem(item);
    setModalOpen(true);
  }

  async function handleSaveModal(payload: {
    name: string;
    url: string;
    iconUrl: string | null;
  }) {
    if (editingItem) {
      const res = await updateMoreAppAction(editingItem.id, payload);
      if (res.success) {
        showToast(`Shortcut "${payload.name}" berhasil diperbarui`, 'success');
        router.refresh();
      }
      return res;
    }

    const res = await createMoreAppAction(payload);
    if (res.success) {
      showToast(`Shortcut "${payload.name}" berhasil ditambahkan`, 'success');
      router.refresh();
    }
    return res;
  }

  async function handleDelete(item: MoreAppItem) {
    const confirmed = await showConfirm(
      'Hapus Shortcut Aplikasi?',
      `Apakah Anda yakin ingin menghapus "${item.name}" dari daftar More App?`,
      'Ya, Hapus',
      true
    );
    if (!confirmed) return;

    setBusyId(item.id);
    const res = await deleteMoreAppAction(item.id);
    setBusyId(null);

    if (!res.success) {
      showAlert('Gagal', res.error || 'Gagal menghapus shortcut.', 'error');
      return;
    }

    setItems((prev) => prev.filter((i) => i.id !== item.id));
    showToast(`Shortcut "${item.name}" dihapus`, 'info');
    router.refresh();
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= items.length) return;

    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);

    setItems(reordered);
    const res = await reorderMoreAppsAction(reordered.map((i) => i.id));
    if (!res.success) {
      setItems(items);
      showAlert('Gagal', res.error || 'Gagal memperbarui urutan.', 'error');
      return;
    }
    router.refresh();
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/60 text-blue-600 dark:text-blue-400">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">More App</h1>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Kumpulan shortcut aplikasi &amp; tautan operasional yang dapat diakses seluruh pengguna.
              </p>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            {items.length > 1 && !normalizedQuery && (
              <button
                type="button"
                onClick={() => setReorderMode((v) => !v)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors min-h-[42px] inline-flex items-center gap-1.5 ${
                  reorderMode
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {reorderMode ? 'Selesai Urutkan' : 'Atur Urutan'}
              </button>
            )}
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors min-h-[42px] inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Tambah Shortcut
            </button>
          </div>
        )}
      </div>

      {/* Info & Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama aplikasi atau URL..."
            className="w-full pl-10 pr-9 py-2 border border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              aria-label="Bersihkan pencarian"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-slate-400 flex-shrink-0">
          <span>
            <strong className="text-gray-800 dark:text-slate-200">{filteredItems.length}</strong> aplikasi
          </span>
          {canManage && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-semibold">
              <ShieldCheck className="h-3 w-3" /> Mode Kelola Admin
            </span>
          )}
        </div>
      </div>

      {/* App Shortcuts Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 border border-gray-100 dark:border-slate-800 shadow-sm text-center">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-gray-400 dark:text-slate-500">
            <LayoutGrid className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">
            {normalizedQuery ? 'Shortcut tidak ditemukan' : 'Belum ada aplikasi yang ditambahkan'}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {normalizedQuery
              ? `Tidak ada aplikasi dengan nama atau URL "${searchQuery}".`
              : canManage
              ? 'Klik tombol "Tambah Shortcut" di atas untuk menyimpan URL aplikasi beserta icon-nya.'
              : 'Admin Piket atau Owner belum menambahkan daftar shortcut aplikasi.'}
          </p>
          {canManage && !normalizedQuery && (
            <button
              type="button"
              onClick={openAddModal}
              className="mt-4 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="h-4 w-4" /> Tambah Shortcut Pertama
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 sm:gap-4">
          {filteredItems.map((item, idx) => {
            const safeParsed = normalizeAppUrl(item.url);
            const href = safeParsed.ok ? safeParsed.url : '#';
            const displayHost = getDisplayHost(item.url);
            const isBusy = busyId === item.id;

            return (
              <div
                key={item.id}
                className={`relative group bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all flex flex-col ${
                  isBusy ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {/* Admin Controls (sibling to link so buttons are never nested inside <a>) */}
                {canManage && !reorderMode && (
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded-lg bg-white/90 dark:bg-slate-800/95 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 shadow-2xs transition-colors"
                      title={`Edit ${item.name}`}
                      aria-label={`Edit ${item.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="p-1.5 rounded-lg bg-white/90 dark:bg-slate-800/95 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-red-600 dark:text-slate-300 dark:hover:text-red-400 shadow-2xs transition-colors"
                      title={`Hapus ${item.name}`}
                      aria-label={`Hapus ${item.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex flex-col items-center text-center p-5 pt-6 gap-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <AppIconImage item={item} />

                  <div className="w-full min-w-0">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.name}
                    </h2>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate mt-1 inline-flex items-center justify-center gap-1 max-w-full">
                      <span className="truncate">{displayHost}</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-blue-500" />
                    </p>
                  </div>
                </a>

                {canManage && reorderMode && (
                  <div className="px-3 pb-3 pt-1 flex items-center justify-between gap-2 border-t border-gray-100 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, -1)}
                      className="flex-1 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center"
                      title="Geser ke kiri"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">
                      #{idx + 1}
                    </span>
                    <button
                      type="button"
                      disabled={idx === items.length - 1}
                      onClick={() => handleMove(idx, 1)}
                      className="flex-1 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center"
                      title="Geser ke kanan"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Quick "+ Add Shortcut" tile for Admins (like Browser New Tab shortcut) */}
          {canManage && !normalizedQuery && !reorderMode && (
            <button
              type="button"
              onClick={openAddModal}
              className="bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 p-5 flex flex-col items-center justify-center text-center gap-3 transition-all group min-h-[146px]"
            >
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/60 flex items-center justify-center text-gray-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-gray-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 block">
                  Add shortcut
                </span>
                <span className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5 block">
                  Simpan URL &amp; Icon
                </span>
              </div>
            </button>
          )}
        </div>
      )}

      {modalOpen && (
        <ShortcutModal
          key={editingItem?.id ?? 'new-shortcut'}
          editingItem={editingItem}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveModal}
        />
      )}
    </div>
  );
}
