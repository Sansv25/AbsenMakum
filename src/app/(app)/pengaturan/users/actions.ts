'use server';

import { revalidatePath } from 'next/cache';
import {
  adminCreateUser,
  adminSetUserRole,
  adminUpdateUserPassword,
  adminDeleteUser,
  adminApproveUser,
  adminUpdateUserProfile,
  adminToggleExcludeRecap,
  adminUpdateUserRoles,
} from '@/lib/data/users';
import type { UserRole, AppRole } from '@/lib/supabase/types';

export async function createUserAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const rolesRaw = formData.getAll('roles') as AppRole[];
  const roles: AppRole[] = rolesRaw.length > 0 ? rolesRaw : ['magang'];
  const hasAdminRights = roles.some((r) => r === 'owner' || r === 'admin' || r === 'senior');
  const role: UserRole = hasAdminRights ? 'master' : 'user';

  if (!email || !password) {
    return { error: 'Email dan password wajib diisi.' };
  }
  if (password.length < 6) {
    return { error: 'Password minimal 6 karakter.' };
  }

  const result = await adminCreateUser(email, password, role, roles);
  if (result.error) return { error: result.error };

  revalidatePath('/pengaturan/users');
  return { success: true };
}

export async function changeUserRoleAction(userId: string, role: UserRole) {
  const result = await adminSetUserRole(userId, role);
  if (result.error) return { error: result.error };

  revalidatePath('/pengaturan/users');
  return { success: true };
}

export async function resetPasswordAction(userId: string, newPassword: string) {
  if (!newPassword || newPassword.length < 6) {
    return { error: 'Password minimal 6 karakter.' };
  }

  const result = await adminUpdateUserPassword(userId, newPassword);
  if (result.error) return { error: result.error };

  revalidatePath('/pengaturan/users');
  return { success: true };
}

export async function deleteUserAction(userId: string) {
  const result = await adminDeleteUser(userId);
  if (result.error) return { error: result.error };

  revalidatePath('/pengaturan/users');
  return { success: true };
}

export async function approveUserAction(userId: string) {
  const result = await adminApproveUser(userId);
  if (result.error) return { error: result.error };

  revalidatePath('/pengaturan/users');
  return { success: true };
}

export async function updateUserProfileAdminAction(
  userId: string,
  fullName: string,
  phone: string,
  role: UserRole,
  setApproved: boolean,
  excludeFromRecap?: boolean,
  newRoles?: AppRole[]
) {
  const result = await adminUpdateUserProfile(
    userId,
    fullName,
    phone,
    role,
    setApproved,
    excludeFromRecap,
    newRoles
  );
  if (result.error) return { error: result.error };

  revalidatePath('/pengaturan/users');
  revalidatePath('/');
  return { success: true };
}

export async function updateUserRolesAction(userId: string, newRoles: AppRole[]) {
  const result = await adminUpdateUserRoles(userId, newRoles);
  if (result.error) return { error: result.error };

  revalidatePath('/pengaturan/users');
  revalidatePath('/');
  return { success: true };
}

export async function toggleExcludeRecapAction(userId: string, newExcludeStatus: boolean) {
  const result = await adminToggleExcludeRecap(userId, newExcludeStatus);
  if (result.error) return { error: result.error };

  revalidatePath('/pengaturan/users');
  revalidatePath('/');
  return { success: true, newStatus: newExcludeStatus };
}

