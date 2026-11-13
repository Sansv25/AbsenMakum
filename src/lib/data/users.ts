import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile, MASTER_EMAIL } from '@/lib/data/profile';
import type { UserRole, AppRole } from '@/lib/supabase/types';

export interface AdminUserItem {
  id: string;
  email: string;
  role: UserRole;
  roles: AppRole[];
  full_name?: string | null;
  phone?: string | null;
  description?: string | null;
  is_approved: boolean;
  exclude_from_recap?: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export async function adminGetUsers(): Promise<{ users: AdminUserItem[]; error?: string }> {
  const supabase = await createClient();
  const { canManageSettings } = await getCurrentUserProfile();
  if (!canManageSettings) {
    return { users: [], error: 'Hanya Admin atau Owner yang diizinkan mengakses data user.' };
  }

  const { data, error } = await supabase.rpc('admin_get_users');
  if (error) {
    return { users: [], error: error.message };
  }

  const users = (data ?? []) as AdminUserItem[];

  // Ambil opsi exclude_from_recap dan roles dari tabel profiles
  try {
    const { data: recapProfiles } = await supabase
      .from('profiles')
      .select('id, exclude_from_recap, roles');

    if (recapProfiles && recapProfiles.length > 0) {
      const recapMap = new Map(recapProfiles.map((p) => [p.id, !!p.exclude_from_recap]));
      const rolesMap = new Map(recapProfiles.map((p) => [p.id, p.roles as AppRole[] | null]));
      users.forEach((u) => {
        u.exclude_from_recap = recapMap.get(u.id) ?? false;
        const rawRoles = rolesMap.get(u.id);
        if (Array.isArray(rawRoles) && rawRoles.length > 0) {
          u.roles = rawRoles;
        } else {
          if (u.email.toLowerCase() === MASTER_EMAIL.toLowerCase()) {
            u.roles = ['owner', 'magang'];
          } else if (u.role === 'master') {
            u.roles = ['admin'];
          } else {
            u.roles = ['magang'];
          }
        }
      });
    }
  } catch {
    users.forEach((u) => {
      u.roles = u.email.toLowerCase() === MASTER_EMAIL.toLowerCase() ? ['owner', 'magang'] : u.role === 'master' ? ['admin'] : ['magang'];
    });
  }

  return { users };
}

export async function adminCreateUser(
  email: string,
  password: string,
  role: UserRole = 'user',
  roles: AppRole[] = ['magang']
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { canManageSettings } = await getCurrentUserProfile();
  if (!canManageSettings) {
    return { success: false, error: 'Hanya Admin atau Owner yang diizinkan membuat user baru.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await supabase.rpc('admin_create_user', {
    new_email: normalizedEmail,
    new_password: password,
    new_role: role,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Simpan roles di profiles
  try {
    await supabase
      .from('profiles')
      .update({
        roles: roles.length > 0 ? roles : ['magang'],
        exclude_from_recap: !roles.includes('magang'),
      })
      .eq('email', normalizedEmail);
  } catch {
    // Abaikan jika kolom roles belum ada
  }

  return { success: true };
}

export async function adminUpdateUserRoles(
  targetUserId: string,
  newRoles: AppRole[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const currentUser = await getCurrentUserProfile();
  if (!currentUser.canManageSettings) {
    return { success: false, error: 'Hanya Admin atau Owner yang diizinkan mengubah role.' };
  }

  // Dapatkan profil target
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetUserId)
    .single();

  if (!targetProfile) {
    return { success: false, error: 'User tidak ditemukan.' };
  }

  const isTargetOwner = targetProfile.email.toLowerCase() === MASTER_EMAIL.toLowerCase();

  // Aturan: Owner cuma satu orang (MASTER_EMAIL). Tidak bisa melepas 'owner' dari akun owner utama
  if (isTargetOwner && !newRoles.includes('owner')) {
    newRoles.push('owner');
  }

  // Non-owner tidak boleh mengangkat diri sendiri atau orang lain menjadi 'owner'
  if (!isTargetOwner && newRoles.includes('owner')) {
    return { success: false, error: 'Hanya ada 1 akun Owner yang diizinkan di sistem.' };
  }

  if (newRoles.length === 0) {
    newRoles = ['magang'];
  }

  const hasAdminRights = newRoles.some((r) => r === 'owner' || r === 'admin' || r === 'senior');
  const syncedRole: UserRole = hasAdminRights ? 'master' : 'user';
  const excludeFromRecap = !newRoles.includes('magang');

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        roles: newRoles,
        role: syncedRole,
        exclude_from_recap: excludeFromRecap,
      })
      .eq('id', targetUserId);

    if (error) {
      await supabase.rpc('admin_set_user_role', {
        target_user_id: targetUserId,
        target_role: syncedRole,
      });
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal memperbarui role user.';
    return { success: false, error: msg };
  }
}

export async function adminSetUserRole(
  targetUserId: string,
  targetRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { canManageSettings } = await getCurrentUserProfile();
  if (!canManageSettings) {
    return { success: false, error: 'Hanya Admin atau Owner yang diizinkan mengubah role.' };
  }

  const { error } = await supabase.rpc('admin_set_user_role', {
    target_user_id: targetUserId,
    target_role: targetRole,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Sync roles
  try {
    const newRoles: AppRole[] = targetRole === 'master' ? ['admin'] : ['magang'];
    await supabase
      .from('profiles')
      .update({
        roles: newRoles,
        exclude_from_recap: !newRoles.includes('magang'),
      })
      .eq('id', targetUserId);
  } catch {
    // Abaikan
  }

  return { success: true };
}

export async function adminUpdateUserPassword(
  targetUserId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { canManageSettings } = await getCurrentUserProfile();
  if (!canManageSettings) {
    return { success: false, error: 'Hanya Admin atau Owner yang diizinkan mengganti password.' };
  }

  const { error } = await supabase.rpc('admin_update_user_password', {
    target_user_id: targetUserId,
    new_password: newPassword,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function adminDeleteUser(
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { canManageSettings } = await getCurrentUserProfile();
  if (!canManageSettings) {
    return { success: false, error: 'Hanya Admin atau Owner yang diizinkan menghapus akun.' };
  }

  // Cek apakah target adalah Owner
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('email, roles')
    .eq('id', targetUserId)
    .single();

  if (targetProfile) {
    if (targetProfile.email.toLowerCase() === MASTER_EMAIL.toLowerCase() || targetProfile.roles?.includes('owner')) {
      return { success: false, error: 'Akun Owner tidak dapat dihapus demi keamanan sistem.' };
    }
  }

  const { error } = await supabase.rpc('admin_delete_user', {
    target_user_id: targetUserId,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function adminApproveUser(
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { canManageSettings } = await getCurrentUserProfile();
  if (!canManageSettings) {
    return { success: false, error: 'Hanya Admin atau Owner yang diizinkan menyetujui akun.' };
  }

  const { error } = await supabase.rpc('admin_approve_user', {
    target_user_id: targetUserId,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function adminUpdateUserProfile(
  targetUserId: string,
  newFullName: string,
  newPhone: string,
  newRole: UserRole,
  setApproved: boolean,
  excludeFromRecap?: boolean,
  newRoles?: AppRole[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { canManageSettings } = await getCurrentUserProfile();
  if (!canManageSettings) {
    return { success: false, error: 'Hanya Admin atau Owner yang diizinkan mengubah data akun.' };
  }

  const { error } = await supabase.rpc('admin_update_user_profile', {
    target_user_id: targetUserId,
    new_full_name: newFullName.trim(),
    new_phone: newPhone.trim(),
    new_role: newRole,
    set_approved: setApproved,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const updateFields: { exclude_from_recap?: boolean; roles?: AppRole[] } = {};
  if (typeof excludeFromRecap === 'boolean') {
    updateFields.exclude_from_recap = excludeFromRecap;
  }
  if (Array.isArray(newRoles) && newRoles.length > 0) {
    updateFields.roles = newRoles;
  }

  if (Object.keys(updateFields).length > 0) {
    try {
      await supabase
        .from('profiles')
        .update(updateFields)
        .eq('id', targetUserId);
    } catch {
      // Abaikan jika kolom belum ada
    }
  }

  return { success: true };
}

export async function adminToggleExcludeRecap(
  targetUserId: string,
  newExcludeStatus: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { canManageSettings } = await getCurrentUserProfile();
  if (!canManageSettings) {
    return { success: false, error: 'Hanya Admin atau Owner yang diizinkan mengubah opsi rekap.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ exclude_from_recap: newExcludeStatus })
    .eq('id', targetUserId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

