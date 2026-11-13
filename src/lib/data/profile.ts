import { createClient } from '@/lib/supabase/server';
import type { UserRole, AppRole } from '@/lib/supabase/types';

export const MASTER_EMAIL = 'madesanjaya255@gmail.com';

export interface UserProfileInfo {
  userId: string | null;
  email: string | null;
  role: UserRole;
  roles: AppRole[];
  isOwner: boolean;
  isAdmin: boolean;
  isSenior: boolean;
  isMagang: boolean;
  isMaster: boolean; // true if isOwner || isAdmin || isSenior (general admin rights)
  canManageSettings: boolean; // isOwner || isAdmin || isSenior
  canManageAdvanced: boolean; // isOwner only (monitoring, email recap, reset data)
  fullName: string | null;
  phone: string | null;
  description: string | null;
  isApproved: boolean;
}

/**
 * Mengambil profil dan role pengguna yang sedang login dengan dukungan Multi-Role.
 */
export async function getCurrentUserProfile(): Promise<UserProfileInfo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: null,
      email: null,
      role: 'user',
      roles: ['magang'],
      isOwner: false,
      isAdmin: false,
      isSenior: false,
      isMagang: true,
      isMaster: false,
      canManageSettings: false,
      canManageAdvanced: false,
      fullName: null,
      phone: null,
      description: null,
      isApproved: false,
    };
  }

  const isMasterEmail = user.email?.toLowerCase() === MASTER_EMAIL.toLowerCase();

  // Ambil profil dari tabel public.profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profile) {
    // Tentukan daftar roles yang valid
    let roles: AppRole[] = [];
    if (Array.isArray(profile.roles) && profile.roles.length > 0) {
      roles = profile.roles as AppRole[];
    } else {
      if (isMasterEmail) {
        roles = ['owner', 'magang'];
      } else if (profile.role === 'master') {
        roles = ['admin'];
      } else {
        roles = ['magang'];
      }
    }

    // Pastikan email master selalu memiliki role owner
    if (isMasterEmail && !roles.includes('owner')) {
      roles = Array.from(new Set(['owner', ...roles]));
    }

    const isOwner = roles.includes('owner') || isMasterEmail;
    const isAdmin = roles.includes('admin');
    const isSenior = roles.includes('senior');
    const isMagang = roles.includes('magang');
    const isMaster = isOwner || isAdmin || isSenior || profile.role === 'master';
    const canManageSettings = isMaster;
    const canManageAdvanced = isOwner;
    const isApproved = isMaster ? true : (profile.is_approved ?? false);

    // Sinkronisasi self-healing jika master_email belum tercatat sebagai master/owner di db
    if (isMasterEmail && (profile.role !== 'master' || !profile.roles?.includes('owner') || profile.is_approved !== true)) {
      try {
        await supabase
          .from('profiles')
          .update({
            role: 'master',
            roles,
            is_approved: true,
            exclude_from_recap: !isMagang,
          })
          .eq('id', user.id);
      } catch {
        // Abaikan jika kolom roles belum ada
      }
    }

    return {
      userId: user.id,
      email: user.email ?? null,
      role: isMaster ? 'master' : 'user',
      roles,
      isOwner,
      isAdmin,
      isSenior,
      isMagang,
      isMaster,
      canManageSettings,
      canManageAdvanced,
      fullName: profile.full_name ?? null,
      phone: profile.phone ?? null,
      description: profile.description ?? null,
      isApproved,
    };
  }

  // Jika belum ada di tabel profiles (fallback self-healing)
  const defaultRole: UserRole = isMasterEmail ? 'master' : 'user';
  const defaultRoles: AppRole[] = isMasterEmail ? ['owner', 'magang'] : ['magang'];
  const metaFullName = (user.user_metadata?.full_name || user.user_metadata?.name || '') as string;
  const metaPhone = (user.user_metadata?.phone || user.user_metadata?.phone_number || '') as string;
  const isApproved = isMasterEmail;

  try {
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email ?? '',
      role: defaultRole,
      roles: defaultRoles,
      full_name: metaFullName || null,
      phone: metaPhone || null,
      is_approved: isApproved,
      exclude_from_recap: !defaultRoles.includes('magang'),
    });
  } catch {
    // Fallback jika roles belum ada
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email ?? '',
      role: defaultRole,
      full_name: metaFullName || null,
      phone: metaPhone || null,
      is_approved: isApproved,
    });
  }

  const isOwner = defaultRoles.includes('owner') || isMasterEmail;
  const isAdmin = defaultRoles.includes('admin');
  const isSenior = defaultRoles.includes('senior');
  const isMagang = defaultRoles.includes('magang');

  return {
    userId: user.id,
    email: user.email ?? null,
    role: defaultRole,
    roles: defaultRoles,
    isOwner,
    isAdmin,
    isSenior,
    isMagang,
    isMaster: isMasterEmail,
    canManageSettings: isMasterEmail,
    canManageAdvanced: isMasterEmail,
    fullName: metaFullName || null,
    phone: metaPhone || null,
    description: null,
    isApproved,
  };
}

/**
 * Memperbarui data nama, nomor telepon, dan deskripsi akun pengguna aktif
 */
export async function updateCurrentUserProfile(
  fullName: string,
  phone: string,
  description?: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Tidak terautentikasi.' };
  }

  const updatePayload: {
    full_name: string;
    phone: string;
    updated_at: string;
    description?: string | null;
  } = {
    full_name: fullName.trim(),
    phone: phone.trim(),
    updated_at: new Date().toISOString(),
  };

  if (description !== undefined) {
    updatePayload.description = description ? description.trim() : null;
  }

  const { error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
