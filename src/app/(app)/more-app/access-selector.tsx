'use client';

import { useState } from 'react';
import { Globe, Lock, Search, Check, Users, X } from 'lucide-react';
import { ROLE_SHORT_LABELS, VALID_APP_ROLES } from '@/lib/more-apps-utils';
import type { AppRole, MoreAppUserOption } from '@/lib/supabase/types';

interface AccessSelectorProps {
  isRestricted: boolean;
  allowedRoles: AppRole[];
  allowedUserIds: string[];
  userOptions: MoreAppUserOption[];
  onChange: (next: {
    isRestricted: boolean;
    allowedRoles: AppRole[];
    allowedUserIds: string[];
  }) => void;
}

export function AccessSelector({
  isRestricted,
  allowedRoles,
  allowedUserIds,
  userOptions,
  onChange,
}: AccessSelectorProps) {
  const [userSearch, setUserSearch] = useState('');

  function toggleRole(role: AppRole) {
    const exists = allowedRoles.includes(role);
    const nextRoles = exists
      ? allowedRoles.filter((r) => r !== role)
      : [...allowedRoles, role];
    onChange({ isRestricted: true, allowedRoles: nextRoles, allowedUserIds });
  }

  function toggleUser(userId: string) {
    const exists = allowedUserIds.includes(userId);
    const nextUsers = exists
      ? allowedUserIds.filter((id) => id !== userId)
      : [...allowedUserIds, userId];
    onChange({ isRestricted: true, allowedRoles, allowedUserIds: nextUsers });
  }

  const q = userSearch.toLowerCase().trim();
  const filteredUsers = q
    ? userOptions.filter(
        (u) =>
          (u.full_name && u.full_name.toLowerCase().includes(q)) ||
          u.email.toLowerCase().includes(q)
      )
    : userOptions;

  const selectedUsers = userOptions.filter((u) => allowedUserIds.includes(u.id));

  return (
    <div className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700/80 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-amber-500" />
          Pengaturan Akses (Khusus Owner)
        </span>
      </div>

      {/* Mode Switch */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() =>
            onChange({ isRestricted: false, allowedRoles: [], allowedUserIds: [] })
          }
          className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold border transition-all flex items-center justify-center gap-1.5 ${
            !isRestricted
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          <span>Semua Pengguna</span>
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({ isRestricted: true, allowedRoles, allowedUserIds })
          }
          className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold border transition-all flex items-center justify-center gap-1.5 ${
            isRestricted
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
              : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          <Lock className="h-3.5 w-3.5" />
          <span>Role / Orang Tertentu</span>
        </button>
      </div>

      {!isRestricted ? (
        <p className="text-[11px] text-gray-500 dark:text-slate-400">
          Shortcut ini dapat dilihat dan dibuka oleh semua pengguna yang login.
        </p>
      ) : (
        <div className="space-y-3 pt-1">
          {/* Role Tertentu */}
          <div>
            <p className="text-[11px] font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              Berdasarkan Role:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {VALID_APP_ROLES.map((role) => {
                const selected = allowedRoles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors inline-flex items-center gap-1 ${
                      selected
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-amber-300'
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" />}
                    <span>{ROLE_SHORT_LABELS[role]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Orang Tertentu */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-1">
                <Users className="h-3 w-3 text-blue-500" />
                Berdasarkan Orang Tertentu ({allowedUserIds.length}):
              </p>
            </div>

            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedUsers.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-semibold"
                  >
                    <span className="truncate max-w-[140px]">{u.full_name || u.email}</span>
                    <button
                      type="button"
                      onClick={() => toggleUser(u.id)}
                      className="hover:text-red-500"
                      aria-label={`Hapus ${u.full_name || u.email}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative mb-1.5">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Cari nama atau email petugas..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-gray-900 dark:text-slate-100 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-gray-100 dark:divide-slate-800">
              {filteredUsers.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-3">
                  Tidak ada user yang cocok.
                </p>
              ) : (
                filteredUsers.map((u) => {
                  const checked = allowedUserIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUser(u.id)}
                          className="h-3.5 w-3.5 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-gray-800 dark:text-slate-100 truncate">
                            {u.full_name || u.email}
                          </p>
                          {u.full_name && (
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">
                              {u.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex-shrink-0">
                        {u.roles.map((r) => ROLE_SHORT_LABELS[r] || r).join(', ')}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-snug">
            Owner selalu memiliki akses ke semua shortcut. Pilih minimal 1 role atau 1 orang untuk membatasi akses.
          </p>
        </div>
      )}
    </div>
  );
}
