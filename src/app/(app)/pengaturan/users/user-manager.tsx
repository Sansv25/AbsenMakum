'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserAction,
  changeUserRoleAction,
  resetPasswordAction,
  deleteUserAction,
} from './actions';
import type { AdminUserItem } from '@/lib/data/users';
import type { UserRole } from '@/lib/supabase/types';
import {
  UserPlus,
  Crown,
  User as UserIcon,
  Trash2,
  KeyRound,
  ShieldAlert,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';
import { formatIndonesia } from '@/lib/dates';

interface UserManagerProps {
  initialUsers: AdminUserItem[];
  fetchError?: string;
  currentUserId: string;
}

export function UserManager({ initialUsers, fetchError, currentUserId }: UserManagerProps) {
  const router = useRouter();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [resetModalUser, setResetModalUser] = useState<AdminUserItem | null>(null);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setLoadingAction('create');

    const formData = new FormData(e.currentTarget);
    const res = await createUserAction(formData);

    if (res.error) {
      setCreateError(res.error);
      setLoadingAction(null);
    } else {
      setCreateModalOpen(false);
      setLoadingAction(null);
      alert('Akun pengguna berhasil dibuat!');
      router.refresh();
    }
  }

  async function handleToggleRole(user: AdminUserItem) {
    if (user.id === currentUserId) {
      alert('Anda tidak dapat mengubah role akun Anda sendiri.');
      return;
    }

    const nextRole: UserRole = user.role === 'master' ? 'user' : 'master';
    const confirmMsg = nextRole === 'master'
      ? `Jadikan akun ${user.email} sebagai Akun Master? Pengguna ini akan memiliki akses penuh.`
      : `Ubah akun ${user.email} menjadi Akun Petugas biasa?`;

    if (!confirm(confirmMsg)) return;

    setLoadingAction(`role-${user.id}`);
    const res = await changeUserRoleAction(user.id, nextRole);

    if (res.error) {
      alert(`Gagal mengubah role: ${res.error}`);
    } else {
      router.refresh();
    }
    setLoadingAction(null);
  }

  async function handleResetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resetModalUser) return;

    setResetError(null);
    setLoadingAction('reset');

    const formData = new FormData(e.currentTarget);
    const newPassword = formData.get('new_password') as string;

    const res = await resetPasswordAction(resetModalUser.id, newPassword);

    if (res.error) {
      setResetError(res.error);
      setLoadingAction(null);
    } else {
      setResetModalUser(null);
      setLoadingAction(null);
      alert(`Password untuk ${resetModalUser.email} berhasil diubah!`);
      router.refresh();
    }
  }

  async function handleDeleteUser(user: AdminUserItem) {
    if (user.id === currentUserId) {
      alert('Anda tidak dapat menghapus akun Anda sendiri.');
      return;
    }

    if (!confirm(`Hapus akun ${user.email}? Seluruh akses user ini akan dicabut permanen.`)) {
      return;
    }

    setLoadingAction(`delete-${user.id}`);
    const res = await deleteUserAction(user.id);

    if (res.error) {
      alert(`Gagal menghapus user: ${res.error}`);
    } else {
      alert(`Akun ${user.email} berhasil dihapus.`);
      router.refresh();
    }
    setLoadingAction(null);
  }

  return (
    <div className="space-y-4">
      {fetchError && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Database Function Belum Terpasang</p>
            <p>
              Fungsi SQL manajemen user belum aktif di database Supabase. Silakan jalankan script SQL migrasi di:
            </p>
            <code className="block bg-amber-100/70 p-1.5 rounded font-mono text-[11px] text-amber-950">
              d:\ABSEN_ICNT\supabase\migration_user_management.sql
            </code>
          </div>
        </div>
      )}

      {/* Header bar with Add Button */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div>
          <h2 className="font-bold text-gray-900 text-sm">Daftar Akun Pengguna</h2>
          <p className="text-xs text-gray-500">
            Total {initialUsers.length} akun terdaftar di sistem.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm min-h-[44px]"
        >
          <UserPlus className="h-4 w-4" />
          Tambah Akun
        </button>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {initialUsers.map((user) => {
          const isSelf = user.id === currentUserId;
          const isUserMaster = user.role === 'master';

          return (
            <div
              key={user.id}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-gray-200 transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isUserMaster
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {isUserMaster ? <Crown className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm truncate">
                      {user.email}
                    </span>
                    {isSelf && (
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                        Anda
                      </span>
                    )}
                    {isUserMaster ? (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-300">
                        <Crown className="h-2.5 w-2.5" /> Master
                      </span>
                    ) : (
                      <span className="text-[10px] bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded-full border border-blue-200">
                        Petugas
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-400 mt-1">
                    Dibuat: {formatIndonesia(user.created_at.slice(0, 10))}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 self-end sm:self-center">
                {/* Ganti Role */}
                <button
                  type="button"
                  onClick={() => handleToggleRole(user)}
                  disabled={isSelf || loadingAction === `role-${user.id}`}
                  title={isSelf ? 'Tidak dapat mengubah role sendiri' : 'Ubah Role'}
                  className="px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1 min-h-[38px]"
                >
                  {loadingAction === `role-${user.id}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5 text-gray-500" />
                      <span>{isUserMaster ? 'Jadikan Petugas' : 'Jadikan Master'}</span>
                    </>
                  )}
                </button>

                {/* Reset Password */}
                <button
                  type="button"
                  onClick={() => {
                    setResetError(null);
                    setResetModalUser(user);
                  }}
                  title="Ganti Password"
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                >
                  <KeyRound className="h-4 w-4" />
                </button>

                {/* Hapus User */}
                <button
                  type="button"
                  onClick={() => handleDeleteUser(user)}
                  disabled={isSelf || loadingAction === `delete-${user.id}`}
                  title={isSelf ? 'Tidak dapat menghapus akun sendiri' : 'Hapus Akun'}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-40 rounded-lg transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                >
                  {loadingAction === `delete-${user.id}` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Tambah User */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                Tambah Akun Pengguna
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="petugas@icnt.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Role Akun
                </label>
                <select
                  name="role"
                  defaultValue="user"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-h-[44px]"
                >
                  <option value="user">Petugas (Hanya absen hari ini + Device lock)</option>
                  <option value="master">Master (Akses Penuh)</option>
                </select>
              </div>

              {createError && (
                <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  {createError}
                </p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl transition-colors min-h-[44px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loadingAction === 'create'}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-xl transition-colors min-h-[44px] flex items-center justify-center gap-2"
                >
                  {loadingAction === 'create' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Buat Akun'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-blue-600" />
                Reset Password
              </h3>
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Masukkan password baru untuk akun <strong>{resetModalUser.email}</strong>.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Password Baru
                </label>
                <input
                  type="password"
                  name="new_password"
                  required
                  minLength={6}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>

              {resetError && (
                <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  {resetError}
                </p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl transition-colors min-h-[44px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loadingAction === 'reset'}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-xl transition-colors min-h-[44px] flex items-center justify-center gap-2"
                >
                  {loadingAction === 'reset' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Simpan Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

