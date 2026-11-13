'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserAction,
  resetPasswordAction,
  deleteUserAction,
  approveUserAction,
  updateUserProfileAdminAction,
  updateUserRolesAction,
} from './actions';
import type { AdminUserItem } from '@/lib/data/users';
import type { AppRole } from '@/lib/supabase/types';
import {
  UserPlus,
  Crown,
  ShieldCheck,
  Star,
  GraduationCap,
  Shield,
  Trash2,
  KeyRound,
  Loader2,
  X,
  AlertCircle,
  Check,
  Edit3,
  Clock,
  EyeOff,
  BarChart3,
  Layers,
} from 'lucide-react';
import { formatIndonesia } from '@/lib/dates';
import { showAlert, showConfirm, showToast } from '@/lib/swal';

const MASTER_EMAIL = 'madesanjaya255@gmail.com';

export const ROLE_INFO: Record<
  AppRole,
  {
    label: string;
    badgeLabel: string;
    icon: typeof Crown;
    bg: string;
    text: string;
    border: string;
    badgeBg: string;
    description: string;
  }
> = {
  owner: {
    label: 'Owner',
    badgeLabel: 'Owner',
    icon: Crown,
    bg: 'bg-amber-100 dark:bg-amber-950/80',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-800',
    badgeBg: 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700',
    description: 'Pemilik tertinggi sistem (1 orang). Akses penuh Shift, Akun, Monitoring Supabase, Rekapan Email, & Reset Data.',
  },
  admin: {
    label: 'Admin',
    badgeLabel: 'Admin',
    icon: ShieldCheck,
    bg: 'bg-blue-100 dark:bg-blue-950/80',
    text: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-800',
    badgeBg: 'bg-blue-500/15 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    description: 'Pengelola operasional. Di menu Pengaturan hanya dapat mengakses Manajemen Shift dan Manajemen Akun.',
  },
  senior: {
    label: 'Senior',
    badgeLabel: 'Senior',
    icon: Star,
    bg: 'bg-purple-100 dark:bg-purple-950/80',
    text: 'text-purple-800 dark:text-purple-300',
    border: 'border-purple-300 dark:border-purple-800',
    badgeBg: 'bg-purple-500/15 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-700',
    description: 'Sama seperti Admin (akses Shift & Akun), namun otomatis TIDAK direkap kehadiran kecuali ditumpuk dengan Magang.',
  },
  magang: {
    label: 'Magang',
    badgeLabel: 'Magang',
    icon: GraduationCap,
    bg: 'bg-emerald-100 dark:bg-emerald-950/80',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-800',
    badgeBg: 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700',
    description: 'Petugas piket aktif (menggantikan nama Petugas Piket). Absensi dihitung dalam rekapitulasi, grafik, dan laporan PDF.',
  },
};

interface UserManagerProps {
  initialUsers: AdminUserItem[];
  fetchError?: string;
  currentUserId: string;
  currentUserIsOwner?: boolean;
}

export function UserManager({
  initialUsers,
  fetchError,
  currentUserId,
  currentUserIsOwner = false,
}: UserManagerProps) {
  const router = useRouter();

  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'approved'>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createRoles, setCreateRoles] = useState<AppRole[]>(['magang']);
  const [resetModalUser, setResetModalUser] = useState<AdminUserItem | null>(null);
  const [editModalUser, setEditModalUser] = useState<AdminUserItem | null>(null);

  // State untuk form edit modal
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRoles, setEditRoles] = useState<AppRole[]>(['magang']);
  const [editApproved, setEditApproved] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  // State untuk modal cepat ganti role
  const [roleModalUser, setRoleModalUser] = useState<AdminUserItem | null>(null);
  const [roleModalRoles, setRoleModalRoles] = useState<AppRole[]>(['magang']);
  const [roleModalError, setRoleModalError] = useState<string | null>(null);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const pendingCount = initialUsers.filter((u) => !u.is_approved).length;
  const approvedCount = initialUsers.filter((u) => u.is_approved).length;

  // Lock body scroll saat ada modal yang terbuka
  useEffect(() => {
    const hasModal = createModalOpen || !!resetModalUser || !!editModalUser || !!roleModalUser;
    if (!hasModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [createModalOpen, resetModalUser, editModalUser, roleModalUser]);

  const filteredUsers = initialUsers.filter((u) => {
    if (filterTab === 'pending') return !u.is_approved;
    if (filterTab === 'approved') return u.is_approved;
    return true;
  });

  function resolveUserRoles(user: AdminUserItem): AppRole[] {
    if (user.roles && user.roles.length > 0) return user.roles;
    if (user.email.toLowerCase() === MASTER_EMAIL.toLowerCase()) return ['owner', 'magang'];
    if (user.role === 'master') return ['admin'];
    return ['magang'];
  }

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
    setEditRoles(resolveUserRoles(user));
    setEditApproved(user.is_approved);
    setEditError(null);
  }

  function handleOpenRoleModal(user: AdminUserItem) {
    setRoleModalUser(user);
    setRoleModalRoles(resolveUserRoles(user));
    setRoleModalError(null);
  }

  async function handleSaveEditUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editModalUser) return;

    setEditError(null);
    setLoadingAction('edit-save');

    const isMasterUser = editRoles.some((r) => r === 'owner' || r === 'admin' || r === 'senior');
    const syncedRole = isMasterUser ? 'master' : 'user';
    const excludeFromRecap = !editRoles.includes('magang');

    const res = await updateUserProfileAdminAction(
      editModalUser.id,
      editFullName,
      editPhone,
      syncedRole,
      editApproved,
      excludeFromRecap,
      editRoles
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

  async function handleSaveRoles(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!roleModalUser) return;

    if (roleModalRoles.length === 0) {
      setRoleModalError('Setidaknya pilih 1 role untuk akun ini.');
      return;
    }

    setRoleModalError(null);
    setLoadingAction(`role-save-${roleModalUser.id}`);

    const res = await updateUserRolesAction(roleModalUser.id, roleModalRoles);

    if (res.error) {
      setRoleModalError(res.error);
      setLoadingAction(null);
    } else {
      showToast(`Role akun ${roleModalUser.email} berhasil diperbarui!`, 'success');
      setRoleModalUser(null);
      setLoadingAction(null);
      router.refresh();
    }
  }

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setLoadingAction('create');

    const formData = new FormData(e.currentTarget);
    formData.delete('roles');
    createRoles.forEach((role) => {
      formData.append('roles', role);
    });

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

    if (user.email.toLowerCase() === MASTER_EMAIL.toLowerCase()) {
      showAlert('Perhatian', 'Akun Utama Owner tidak dapat dihapus.', 'warning');
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

  function toggleRoleInList(list: AppRole[], role: AppRole, targetEmail?: string): AppRole[] {
    const isTargetOwner = targetEmail?.toLowerCase() === MASTER_EMAIL.toLowerCase();

    // Owner utama tidak boleh kehilangan role 'owner'
    if (role === 'owner' && isTargetOwner) {
      return list;
    }

    // Akun selain owner utama tidak boleh dijadikan owner
    if (role === 'owner' && !isTargetOwner) {
      return list;
    }

    if (list.includes(role)) {
      const next = list.filter((r) => r !== role);
      return next.length > 0 ? next : ['magang'];
    } else {
      return [...list, role];
    }
  }

  function renderRoleBadges(roles: AppRole[]) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {roles.map((r) => {
          const config = ROLE_INFO[r];
          if (!config) return null;
          const Icon = config.icon;
          return (
            <span
              key={r}
              className={`text-[10px] ${config.badgeBg} font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border shadow-2xs`}
            >
              <Icon className="h-2.5 w-2.5" />
              <span>{config.badgeLabel}</span>
            </span>
          );
        })}
      </div>
    );
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
                Pendaftar baru belum dapat mengakses aplikasi sebelum disetujui atau ditentukan role-nya.
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
          <h2 className="font-bold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Manajemen Akun &amp; Role Bertumpuk
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Role dapat ditumpuk (misal: Owner + Magang, Admin + Magang). Total {initialUsers.length} akun.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setCreateRoles(['magang']);
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
                filterTab === 'pending'
                  ? 'bg-amber-700 text-white'
                  : 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200'
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
            const isTargetOwner = user.email.toLowerCase() === MASTER_EMAIL.toLowerCase();
            const userRoles = resolveUserRoles(user);
            const isPending = !user.is_approved;
            const isMagang = userRoles.includes('magang');

            // Pilih icon utama untuk avatar
            let AvatarIcon = GraduationCap;
            let avatarClass = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';

            if (isPending) {
              AvatarIcon = Clock;
              avatarClass = 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
            } else if (userRoles.includes('owner')) {
              AvatarIcon = Crown;
              avatarClass = 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700';
            } else if (userRoles.includes('admin')) {
              AvatarIcon = ShieldCheck;
              avatarClass = 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
            } else if (userRoles.includes('senior')) {
              AvatarIcon = Star;
              avatarClass = 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
            }

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
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${avatarClass}`}>
                    <AvatarIcon className="h-5 w-5" />
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
                      ) : (
                        renderRoleBadges(userRoles)
                      )}

                      {/* Status Rekap Kehadiran */}
                      {!isPending && (
                        isMagang ? (
                          <span
                            className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1"
                            title="Akun Magang: Diikutsertakan dalam tabel rekapitulasi piket"
                          >
                            <BarChart3 className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Ikut Rekap</span>
                          </span>
                        ) : (
                          <span
                            className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 flex items-center gap-1"
                            title="Bukan Magang: Tidak dihitung dalam tabel rekap piket dashboard"
                          >
                            <EyeOff className="h-2.5 w-2.5 text-slate-500" />
                            <span>Tidak Direkap</span>
                          </span>
                        )
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

                  {/* Edit Profil Lengkap */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(user)}
                    className="px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-400 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 min-h-[38px] border border-gray-200 dark:border-slate-700"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-gray-500 dark:text-slate-400" />
                    <span>{isPending ? 'Edit & Review' : 'Edit'}</span>
                  </button>

                  {/* Kelola Role Bertumpuk */}
                  {!isPending && (
                    <button
                      type="button"
                      onClick={() => handleOpenRoleModal(user)}
                      disabled={loadingAction === `role-save-${user.id}`}
                      title="Ubah & tumpuk role akun"
                      className="px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-400 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 min-h-[38px] border border-gray-200 dark:border-slate-700"
                    >
                      <Shield className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Ubah Role</span>
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
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center border border-gray-200 dark:border-slate-700"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>

                  {/* Hapus Akun (Kecuali Owner Utama dan Akun Sendiri) */}
                  {!isSelf && !isTargetOwner && (
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user)}
                      disabled={loadingAction === `delete-${user.id}`}
                      title={isPending ? 'Tolak & Hapus Akun' : 'Hapus Akun'}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center border border-gray-200 dark:border-slate-700"
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

      {/* Modal Kelola Role Bertumpuk */}
      {roleModalUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Kelola Role Akun
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  {roleModalUser.full_name || roleModalUser.email} &bull; Role boleh ditumpuk
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoleModalUser(null)}
                className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoles} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Pilih Role (Dapat Dipilih Lebih Dari Satu):
                </label>

                {(['owner', 'admin', 'senior', 'magang'] as AppRole[]).map((roleKey) => {
                  const info = ROLE_INFO[roleKey];
                  const Icon = info.icon;
                  const isChecked = roleModalRoles.includes(roleKey);
                  const isTargetOwner = roleModalUser.email.toLowerCase() === MASTER_EMAIL.toLowerCase();

                  // Owner role lock logic
                  const isOwnerDisabled = roleKey === 'owner' && (!isTargetOwner || !currentUserIsOwner);

                  return (
                    <label
                      key={roleKey}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        isChecked
                          ? 'border-blue-400 dark:border-blue-600 bg-blue-50/40 dark:bg-blue-950/30'
                          : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40 hover:bg-gray-100/60 dark:hover:bg-slate-800'
                      } ${isOwnerDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        disabled={isOwnerDisabled}
                        checked={isChecked}
                        onChange={() => {
                          if (isOwnerDisabled) return;
                          setRoleModalRoles(toggleRoleInList(roleModalRoles, roleKey, roleModalUser.email));
                        }}
                        className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold flex items-center gap-1.5 ${info.text}`}>
                            <Icon className="h-3.5 w-3.5" />
                            {info.label}
                          </span>
                          {roleKey === 'owner' && (
                            <span className="text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-semibold px-2 py-0.2 rounded-full border border-amber-300 dark:border-amber-700">
                              Akun Utama
                            </span>
                          )}
                          {roleKey === 'magang' && (
                            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-semibold px-2 py-0.2 rounded-full border border-emerald-300 dark:border-emerald-700">
                              Ikut Rekap
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {info.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Status Rekap Kehadiran Realtime */}
              <div className="p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 space-y-1.5">
                <span className="text-[11px] font-semibold text-gray-700 dark:text-slate-300 block">
                  Status Rekapitulasi Kehadiran:
                </span>
                {roleModalRoles.includes('magang') ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                    <BarChart3 className="h-4 w-4" />
                    <span>DIHITUNG dalam rekapitulasi piket, grafik dashboard, &amp; laporan PDF.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 font-semibold">
                    <EyeOff className="h-4 w-4" />
                    <span>TIDAK DIHITUNG dalam rekapitulasi piket dashboard (hanya monitoring &amp; manajemen).</span>
                  </div>
                )}
              </div>

              {roleModalError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-200 dark:border-red-900/60">
                  {roleModalError}
                </p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRoleModalUser(null)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors min-h-[44px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loadingAction === `role-save-${roleModalUser.id}`}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-xl transition-colors min-h-[44px] flex items-center justify-center gap-2"
                >
                  {loadingAction === `role-save-${roleModalUser.id}` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Simpan Role'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Pengguna */}
      {editModalUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
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
                  Nama Lengkap
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

              {/* Pilihan Role Bertumpuk di Edit Modal */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Role Akun (Boleh Ditumpuk):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(['owner', 'admin', 'senior', 'magang'] as AppRole[]).map((roleKey) => {
                    const info = ROLE_INFO[roleKey];
                    const Icon = info.icon;
                    const isChecked = editRoles.includes(roleKey);
                    const isTargetOwner = editModalUser.email.toLowerCase() === MASTER_EMAIL.toLowerCase();
                    const isOwnerDisabled = roleKey === 'owner' && (!isTargetOwner || !currentUserIsOwner);

                    return (
                      <label
                        key={roleKey}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isChecked
                            ? 'border-blue-400 dark:border-blue-600 bg-blue-50/40 dark:bg-blue-950/30'
                            : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40 hover:bg-gray-100/60'
                        } ${isOwnerDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          disabled={isOwnerDisabled}
                          checked={isChecked}
                          onChange={() => {
                            if (isOwnerDisabled) return;
                            setEditRoles(toggleRoleInList(editRoles, roleKey, editModalUser.email));
                          }}
                          className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`text-xs font-bold flex items-center gap-1 ${info.text}`}>
                          <Icon className="h-3 w-3" />
                          {info.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status Persetujuan */}
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
                      Centang untuk mengizinkan pengguna masuk dan mengisi absensi piket.
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
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Tambah Akun Pengguna Baru
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
                  placeholder="nama@icnt.com"
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

              {/* Pilihan Role Bertumpuk */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Role Akun (Boleh Ditumpuk):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(['admin', 'senior', 'magang'] as AppRole[]).map((roleKey) => {
                    const info = ROLE_INFO[roleKey];
                    const Icon = info.icon;
                    const isChecked = createRoles.includes(roleKey);

                    return (
                      <label
                        key={roleKey}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isChecked
                            ? 'border-blue-400 dark:border-blue-600 bg-blue-50/40 dark:bg-blue-950/30'
                            : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40 hover:bg-gray-100/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setCreateRoles((prev) => {
                              if (prev.includes(roleKey)) {
                                const next = prev.filter((r) => r !== roleKey);
                                return next.length > 0 ? next : ['magang'];
                              } else {
                                return [...prev, roleKey];
                              }
                            });
                          }}
                          className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`text-xs font-bold flex items-center gap-1 ${info.text}`}>
                          <Icon className="h-3 w-3" />
                          {info.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
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
