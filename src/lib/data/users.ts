import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/data/profile';
import type { UserRole } from '@/lib/supabase/types';

export interface AdminUserItem {
  id: string;
  email: string;
  role: UserRole;
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
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { users: [], error: 'Hanya Akun Master yang diizinkan mengakses data user.' };
  }

  const { data, error } = await supabase.rpc('admin_get_users');
  if (error) {
    return { users: [], error: error.message };
  }

  const users = (data ?? []) as AdminUserItem[];

  // Ambil opsi exclude_from_recap dari tabel profiles
  try {
    const { data: recapProfiles } = await supabase
      .from('profiles')
      .select('id, exclude_from_recap');

    if (recapProfiles && recapProfiles.length > 0) {
      const recapMap = new Map(recapProfiles.map((p) => [p.id, !!p.exclude_from_recap]));
      users.forEach((u) => {
        u.exclude_from_recap = recapMap.get(u.id) ?? false;
      });
    }
  } catch {
    // Abaikan jika kolom exclude_from_recap belum dibuat di database
  }

  return { users };
}

export async function adminCreateUser(
  email: string,
  password: string,
  role: UserRole = 'user'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { success: false, error: 'Hanya Akun Master yang diizinkan membuat user baru.' };
  }

  const { error } = await supabase.rpc('admin_create_user', {
    new_email: email.trim().toLowerCase(),
    new_password: password,
    new_role: role,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function adminSetUserRole(
  targetUserId: string,
  targetRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { success: false, error: 'Hanya Akun Master yang diizinkan mengubah role.' };
  }

  const { error } = await supabase.rpc('admin_set_user_role', {
    target_user_id: targetUserId,
    target_role: targetRole,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function adminUpdateUserPassword(
  targetUserId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { success: false, error: 'Hanya Akun Master yang diizinkan mengganti password.' };
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
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { success: false, error: 'Hanya Akun Master yang diizinkan menghapus akun.' };
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
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { success: false, error: 'Hanya Akun Master yang diizinkan menyetujui akun.' };
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
  excludeFromRecap?: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { success: false, error: 'Hanya Akun Master yang diizinkan mengubah data akun.' };
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

  // Jika opsi excludeFromRecap disediakan, update langsung di profiles
  if (typeof excludeFromRecap === 'boolean') {
    try {
      await supabase
        .from('profiles')
        .update({ exclude_from_recap: excludeFromRecap })
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
  const { isMaster } = await getCurrentUserProfile();
  if (!isMaster) {
    return { success: false, error: 'Hanya Akun Master yang diizinkan mengubah opsi rekap.' };
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

