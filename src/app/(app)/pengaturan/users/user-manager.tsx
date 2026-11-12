'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserAction,
  changeUserRoleAction,
  resetPasswordAction,
  deleteUserAction,
  approveUserAction,
  updateUserProfileAdminAction,
  toggleExcludeRecapAction,
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
  Check,
  Edit3,
  Clock,
  UserCheck,
  EyeOff,
  BarChart2,
} from 'lucide-react';
import { formatIndonesia } from '@/lib/dates';
import { showAlert, showConfirm, showToast } from '@/lib/swal';

interface UserManagerProps {
  initialUsers: AdminUserItem[];
  fetchError?: string;
  currentUserId: string;
}

export function UserManager({ initialUsers, fetchError, currentUserId }: UserManagerProps) {
  const router = useRouter();

  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'approved'>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [resetModalUser, setResetModalUser] = useState<AdminUserItem | null>(null);
  const [editModalUser, setEditModalUser] = useState<AdminUserItem | null>(null);

  // State untuk form edit modal
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [editApproved, setEditApproved] = useState(true);
  const [editExcludeFromRecap, setEditExcludeFromRecap] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const pendingCount = initialUsers.filter((u) => !u.is_approved).length;
  const approvedCount = initialUsers.filter((u) => u.is_approved).length;

  // Lock body scroll when any modal is open
  useEffect(() => {
    const hasModal = createModalOpen || !!resetModalUser || !!editModalUser;
    if (!hasModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [createModalOpen, resetModalUser, editModalUser]);

  const filteredUsers = initialUsers.filter((u) => {
    if (filterTab === 'pending') return !u.is_approved;
    if (filterTab === 'approved') return u.is_approved;
    return true;
  });

  async function handleDirectApprove(user: AdminUserItem) {
    const name = user.full_name || user.email;
    const confirmed = await showConfirm(
      'Setujui Akun?',
      `Setujui akun ${name}? Pengguna ini akan langsung dapat masuk dan mengisi absensi piket.`,
      'Ya, Setujui Akun'
    );
    if (!confirmed) return;

    setLoadingAction(`approve-${user.id}`);
    const res = await approveUserAction(user.id);

    if (res.error) {
      showAlert('Gagal', `Gagal menyetujui akun: ${res.error}`, 'error');
    } else {
      showToast(`Akun ${name} berhasil disetujui!`, 'success');
      router.refresh();
    }
    setLoadingAction(null);
  }

  function handleOpenEditModal(user: AdminUserItem) {
    setEditModalUser(user);
    setEditFullName(user.full_name || '');
    setEditPhone(user.phone || '');
    setEditRole(user.role);
    setEditApproved(user.is_approved);
    setEditExcludeFromRecap(!!user.exclude_from_recap);
    setEditError(null);
  }

  async function handleSaveEditUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editModalUser) return;

    setEditError(null);
    setLoadingAction('edit-save');

    const res = await updateUserProfileAdminAction(
      editModalUser.id,
      editFullName,
      editPhone,
      editRole,
      editApproved,
      editExcludeFromRecap
    );

    if (res.error) {
      setEditError(res.error);
      setLoadingAction(null);
    } else {
      showToast('Data akun berhasil diperbarui!', 'success');
      setEditModalUser(null);
      setLoadingAction(null);
      router.refresh();
    }
  }

  async function handleToggleExcludeRecap(user: AdminUserItem) {
    const newStatus = !user.exclude_from_recap;
    const actionTitle = newStatus ? 'Kecualikan dari Rekapitulasi?' : 'Masukkan ke Rekapitulasi?';
    const actionDesc = newStatus
      ? `Akun ${user.full_name || user.email} akan disembunyikan dan TIDAK dihitung dalam tabel rekapitulasi piket di dashboard.`
      : `Akun ${user.full_name || user.email} akan dimasukkan kembali ke tabel rekapitulasi piket di dashboard.`;

    const confirmed = await showConfirm(
      actionTitle,
      actionDesc,
      newStatus ? 'Ya, Jangan Rekap' : 'Ya, Masukkan Rekap'
    );
    if (!confirmed) return;

    setLoadingAction(`recap-${user.id}`);
    const res = await toggleExcludeRecapAction(user.id, newStatus);
    if (res.error) {
      showAlert('Gagal', `Gagal mengubah status rekap: ${res.error}`, 'error');
    } else {
      showToast(
        newStatus
          ? `Akun ${user.full_name || user.email} berhasil diset Jangan Rekap.`
          : `Akun ${user.full_name || user.email} kembali masuk rekapitulasi.`,
        'success'
      );
      router.refresh();
    }
    setLoadingAction(null);
  }

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
      showToast('Akun pengguna berhasil dibuat!', 'success');
      router.refresh();
    }
  }

  async function handleToggleRole(user: AdminUserItem) {
    if (user.id === currentUserId) {
      showAlert('Perhatian', 'Anda tidak dapat mengubah role akun Anda sendiri.', 'warning');
      return;
    }

    const nextRole: UserRole = user.role === 'master' ? 'user' : 'master';
    const confirmMsg =
      nextRole === 'master'
        ? `Jadikan akun ${user.email} sebagai Akun Master? Pengguna ini akan memiliki akses penuh.`
        : `Ubah akun ${user.email} menjadi Akun Petugas biasa?`;

    const confirmed = await showConfirm('Ubah Role Akun?', confirmMsg, 'Ya, Ubah Role');
    if (!confirmed) return;

    setLoadingAction(`role-${user.id}`);
    const res = await changeUserRoleAction(user.id, nextRole);

    if (res.error) {
      showAlert('Gagal', `Gagal mengubah role: ${res.error}`, 'error');
    } else {
      showToast(`Role akun ${user.email} berhasil diubah!`, 'success');
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
      const email = resetModalUser.email;
      setResetModalUser(null);
      setLoadingAction(null);
      showToast(`Password untuk ${email} berhasil diubah!`, 'success');
      router.refresh();
    }
  }

  async function handleDeleteUser(user: AdminUserItem) {
    if (user.id === currentUserId) {
      showAlert('Perhatian', 'Anda tidak dapat menghapus akun Anda sendiri.', 'warning');
      return;
    }

    const confirmed = await showConfirm(
      'Hapus Akun?',
      `Hapus akun ${user.email}? Seluruh akses pengguna ini akan dicabut secara permanen.`,
      'Ya, Hapus Akun',
      true
    );
    if (!confirmed) return;

    setLoadingAction(`delete-${user.id}`);
    const res = await deleteUserAction(user.id);

    if (res.error) {
      showAlert('Gagal', `Gagal menghapus user: ${res.error}`, 'error');
    } else {
      showToast(`Akun ${user.email} berhasil dihapus!`, 'success');
      router.refresh();
    }
    setLoadingAction(null);
  }

  return (
    <div className="space-y-4">
      {fetchError && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold">Perhatian RPC Database:</p>
            <p className="mt-0.5">{fetchError}</p>
          </div>
        </div>
      )}

      {/* Banner Peringatan Akun Menunggu Review */}
      {pendingCount > 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
              <Clock className="h-5 w-5 animate-spin" style={{ animationDuration: '4s' }} />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 dark:text-amber-300 text-sm">
                {pendingCount} Akun Baru Menunggu Persetujuan
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Pendaftar baru belum dapat mengakses aplikasi sebelum Anda setujui atau edit datanya.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFilterTab('pending')}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors whitespace-nowrap min-h-[38px]"
          >
            Tinjau Sekarang
          </button>
        </div>
      )}

      {/* Header bar with Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-100 dark:border-slate-800 shadow-sm transition-colors">
        <div>
          <h2 className="font-bold text-gray-900 dark:text-slate-100 text-sm">Daftar Akun Pengguna</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
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
          Tambah Akun Manual
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-gray-100/80 dark:bg-slate-800/80 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filterTab === 'all'
              ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-xs'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
          }`}
        >
          Semua ({initialUsers.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('pending')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            filterTab === 'pending'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Menunggu Review</span>
          {pendingCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                filterTab === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200'
              }`}
            >
              {pendingCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('approved')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filterTab === 'approved'
              ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-xs'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
          }`}
        >
          Disetujui ({approvedCount})
        </button>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-100 dark:border-slate-800 shadow-sm text-center">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Tidak ada akun di kategori ini</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              {filterTab === 'pending'
                ? 'Semua akun pendaftar sudah disetujui.'
                : 'Belum ada data akun.'}
            </p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isSelf = user.id === currentUserId;
            const isUserMaster = user.role === 'master';
            const isPending = !user.is_approved;

            return (
              <div
                key={user.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm ${
                  isPending
                    ? 'border-amber-200 dark:border-amber-800/60 bg-amber-50/15 dark:bg-amber-950/20 hover:border-amber-300 dark:hover:border-amber-700'
                    : 'border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isPending
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        : isUserMaster
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    {isPending ? (
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    ) : isUserMaster ? (
                      <Crown className="h-5 w-5" />
                    ) : (
                      <UserIcon className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm truncate">
                        {user.full_name ? user.full_name : user.email}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                          Anda
                        </span>
                      )}
                      {isPending ? (
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-300 dark:border-amber-800 animate-pulse">
                          <Clock className="h-2.5 w-2.5" /> Menunggu Review
                        </span>
                      ) : isUserMaster ? (
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-300 dark:border-amber-800">
                          <Crown className="h-2.5 w-2.5" /> Master
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                          <UserCheck className="h-2.5 w-2.5" /> Aktif
                        </span>
                      )}
                      {user.exclude_from_recap && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 flex items-center gap-1" title="Dikecualikan dari tabel rekapitulasi piket di dashboard">
                          <EyeOff className="h-2.5 w-2.5 text-amber-500" /> Jangan Rekap
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                      <span>{user.email}</span>
                      {user.phone && (
                        <>
                          <span className="text-gray-300 dark:text-slate-600">&bull;</span>
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{user.phone}</span>
                        </>
                      )}
                      <span className="text-gray-300 dark:text-slate-600">&bull;</span>
                      <span className="text-gray-400 dark:text-slate-500">
                        Daftar: {formatIndonesia(user.created_at.slice(0, 10))}
                      </span>
                    </div>

                    {user.description && (
                      <p className="text-[11px] text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700 rounded-lg px-2.5 py-1 mt-1.5 font-normal">
                        <span className="font-semibold text-gray-700 dark:text-slate-200">Catatan/Rekening:</span> {user.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-center">
                  {/* Tombol Khusus Akun Pending */}
                  {isPending && (
                    <button
                      type="button"
                      onClick={() => handleDirectApprove(user)}
                      disabled={loadingAction === `approve-${user.id}`}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1 min-h-[38px]"
                    >
                      {loadingAction === `approve-${user.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      <span>Setujui</span>
                    </button>
                  )}

                  {/* Edit Data Akun (Nama, HP, Role, Status) */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(user)}
                    className="px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-400 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 min-h-[38px] border border-gray-200 dark:border-slate-700"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-gray-500 dark:text-slate-400" />
                    <span>{isPending ? 'Edit & Review' : 'Edit'}</span>
                  </button>

                  {/* Ganti Role (hanya untuk akun aktif dan bukan diri sendiri) */}
                  {!isPending && !isSelf && (
                    <button
                      type="button"
                      onClick={() => handleToggleRole(user)}
                      disabled={loadingAction === `role-${user.id}`}
                      title="Ubah Role"
                      className="px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1 min-h-[38px]"
                    >
                      {loadingAction === `role-${user.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <ShieldAlert className="h-3.5 w-3.5 text-gray-500 dark:text-slate-400" />
                          <span>{isUserMaster ? 'Ke Petugas' : 'Ke Master'}</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Toggle Jangan Rekap */}
                  {!isPending && (
                    <button
                      type="button"
                      onClick={() => handleToggleExcludeRecap(user)}
                      disabled={loadingAction === `recap-${user.id}`}
                      title={
                        user.exclude_from_recap
                          ? 'Klik untuk memasukkan akun ini ke tabel rekap piket dashboard'
                          : 'Klik agar akun ini tidak dihitung dalam rekap piket dashboard (monitoring saja)'
                      }
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 min-h-[38px] border ${
                        user.exclude_from_recap
                          ? 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                          : 'text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 border-gray-200 dark:border-slate-700'
                      }`}
                    >
                      {loadingAction === `recap-${user.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : user.exclude_from_recap ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          <span className="hidden sm:inline">Tidak Direkap</span>
                          <span className="sm:hidden">Off</span>
                        </>
                      ) : (
                        <>
                          <BarChart2 className="h-3.5 w-3.5 text-gray-500 dark:text-slate-400" />
                          <span className="hidden sm:inline">Jangan Rekap</span>
                          <span className="sm:hidden">Rekap</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Reset Password */}
                  <button
                    type="button"
                    onClick={() => {
                      setResetError(null);
                      setResetModalUser(user);
                    }}
                    title="Ganti Password"
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>

                  {/* Hapus / Tolak Akun */}
                  {!isSelf && (
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user)}
                      disabled={loadingAction === `delete-${user.id}`}
                      title={isPending ? 'Tolak & Hapus Akun' : 'Hapus Akun'}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                    >
                      {loadingAction === `delete-${user.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Edit Pengguna */}
      {editModalUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Edit Data Akun Pengguna
              </h3>
              <button
                type="button"
                onClick={() => setEditModalUser(null)}
                className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  disabled
                  value={editModalUser.email}
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Nama
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Role Akun</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                >
                  <option value="user">Petugas (Absen hari ini & Device lock)</option>
                  <option value="master">Master (Akses Penuh)</option>
                </select>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editApproved}
                    onChange={(e) => setEditApproved(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-gray-900 dark:text-slate-100 block">
                      Status Akun: Disetujui (Approved)
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-slate-400 block">
                      Centang untuk mengizinkan pengguna masuk dan mengisi piket.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-1">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editExcludeFromRecap}
                    onChange={(e) => setEditExcludeFromRecap(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                      <EyeOff className="h-3.5 w-3.5 text-amber-500" />
                      Jangan Rekap (Kecualikan dari Tabel Dashboard)
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                      Centang opsi ini untuk akun Master / Monitoring yang tidak piket agar namanya tidak muncul di tabel rekap piket dashboard.
                    </span>
                  </div>
                </label>
              </div>

              {editError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-200 dark:border-red-900/60">
                  {editError}
                </p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalUser(null)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors min-h-[44px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loadingAction === 'edit-save'}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-xl transition-colors min-h-[44px] flex items-center justify-center gap-2"
                >
                  {loadingAction === 'edit-save' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : !editModalUser.is_approved && editApproved ? (
                    'Simpan & Setujui'
                  ) : (
                    'Simpan Perubahan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah User Manual */}
      {createModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Tambah Akun Pengguna
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="petugas@icnt.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">Role Akun</label>
                <select
                  name="role"
                  defaultValue="user"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                >
                  <option value="user">Petugas (Hanya absen hari ini + Device lock)</option>
                  <option value="master">Master (Akses Penuh)</option>
                </select>
              </div>

              {createError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-200 dark:border-red-900/60">
                  {createError}
                </p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors min-h-[44px]"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Reset Password
              </h3>
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400">
              Masukkan password baru untuk akun <strong>{resetModalUser.email}</strong>.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Password Baru
                </label>
                <input
                  type="password"
                  name="new_password"
                  required
                  minLength={6}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>

              {resetError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-200 dark:border-red-900/60">
                  {resetError}
                </p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors min-h-[44px]"
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
