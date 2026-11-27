'use client';

import { useState, useEffect } from 'react';
import { X, Shield, Loader2, AlertCircle } from 'lucide-react';
import { AccessSelector } from './access-selector';
import { isRestrictedApp } from '@/lib/more-apps-utils';
import type { AppRole, MoreAppItem, MoreAppUserOption } from '@/lib/supabase/types';

interface AppAccessModalProps {
  item: MoreAppItem;
  userOptions: MoreAppUserOption[];
  onClose: () => void;
  onSave: (
    id: string,
    payload: { allowedRoles: AppRole[]; allowedUserIds: string[] }
  ) => Promise<{ success: boolean; error?: string }>;
}

export function AppAccessModal({
  item,
  userOptions,
  onClose,
  onSave,
}: AppAccessModalProps) {
  const [isRestricted, setIsRestricted] = useState(isRestrictedApp(item));
  const [allowedRoles, setAllowedRoles] = useState<AppRole[]>(item.allowed_roles ?? []);
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>(item.allowed_user_ids ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [saving, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isRestricted && allowedRoles.length === 0 && allowedUserIds.length === 0) {
      setError('Pilih minimal 1 role atau 1 orang, atau ubah ke "Semua Pengguna".');
      return;
    }

    setSaving(true);
    const res = await onSave(item.id, {
      allowedRoles: isRestricted ? allowedRoles : [],
      allowedUserIds: isRestricted ? allowedUserIds : [],
    });

    if (!res.success) {
      setError(res.error || 'Gagal memperbarui akses.');
      setSaving(false);
      return;
    }

    setSaving(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 !mt-0 z-[95] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2 truncate">
              <Shield className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span className="truncate">Kelola Akses: {item.name}</span>
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Tentukan siapa saja yang dapat melihat shortcut ini (Khusus Owner).
            </p>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Tutup modal akses"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <AccessSelector
            isRestricted={isRestricted}
            allowedRoles={allowedRoles}
            allowedUserIds={allowedUserIds}
            userOptions={userOptions}
            onChange={(next) => {
              setIsRestricted(next.isRestricted);
              setAllowedRoles(next.allowedRoles);
              setAllowedUserIds(next.allowedUserIds);
              setError(null);
            }}
          />

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-900/60">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-full border border-gray-300 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors min-h-[38px]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors min-h-[38px] inline-flex items-center gap-1.5 shadow-xs"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Simpan Akses
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
