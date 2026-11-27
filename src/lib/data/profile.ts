import { createClient } from '@/lib/supabase/server';
import type { UserRole, AppRole } from '@/lib/supabase/types';
import {
  isMissingWalletColumnError,
  readFallbackWalletsMap,
  writeFallbackUserWallet,
} from '@/lib/data/wallet-store';
import { inferWalletType, type WalletInfo, type WalletType } from '@/lib/wallet';

export const MASTER_EMAIL = 'madesanjaya255@gmail.com';

export interface UserProfileInfo {
  userId: string | null;
  email: string | null;
  role: UserRole;
  roles: AppRole[];
  isOwner: boolean;
  isAdmin: boolean;
  isSenior: boolean;
  isPiket: boolean;
  isFreelance: boolean;
  isMagang: boolean;
  isTiket: boolean;
  isMaster: boolean; // true if isOwner || isAdmin || isSenior (general admin rights)
  canManageSettings: boolean; // isOwner || isAdmin (senior tidak memiliki akses)
  canManageAdvanced: boolean; // isOwner only (monitoring, email recap, reset data)
  canCreateTicket: boolean; // isOwner || isTiket
  canAccessPiket: boolean; // isOwner || isAdmin || isSenior || isPiket || isFreelance
  canAccessRekapHarian: boolean; // isOwner || isAdmin || isSenior
  fullName: string | null;
  phone: string | null;
  description: string | null;
  walletType: WalletType | null;
  walletProvider: string | null;
  walletNumber: string | null;
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
      isPiket: false,
      isFreelance: false,
      isMagang: true,
      isTiket: false,
      isMaster: false,
      canManageSettings: false,
      canManageAdvanced: false,
      canCreateTicket: false,
      canAccessPiket: false,
      canAccessRekapHarian: false,
      fullName: null,
      phone: null,
      description: null,
      walletType: null,
      walletProvider: null,
      walletNumber: null,
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
    const isPiket = roles.includes('piket');
    const isFreelance = roles.includes('freelance');
    const isMagang = roles.includes('magang');
    const isTiket = roles.includes('tiket');
    const isMaster = isOwner || isAdmin || (profile.role === 'master' && !isSenior);
    const canManageSettings = isOwner || isAdmin || (profile.role === 'master' && !isSenior);
    const canManageAdvanced = isOwner;
    const canCreateTicket = isOwner || isTiket;
    const canAccessPiket = isOwner || isAdmin || isSenior || isPiket || isFreelance;
    const canAccessRekapHarian = isOwner || isAdmin || isSenior || isMaster;
    const isApproved = isMaster || isSenior ? true : (profile.is_approved ?? false);

    // Sinkronisasi self-healing jika master_email belum tercatat sebagai master/owner di db
    if (isMasterEmail && (profile.role !== 'master' || !profile.roles?.includes('owner') || profile.is_approved !== true)) {
      try {
        await supabase
          .from('profiles')
          .update({
            role: 'master',
            roles,
            is_approved: true,
            exclude_from_recap: (!isMagang && !isPiket && !isFreelance),
          })
          .eq('id', user.id);
      } catch {
        // Abaikan jika kolom roles belum ada
      }
    }

    let resolvedWalletType: WalletType | null =
      profile.wallet_type === 'bank' || profile.wallet_type === 'ewallet'
        ? profile.wallet_type
        : null;
    let resolvedWalletProvider: string | null = profile.wallet_provider ?? null;
    let resolvedWalletNumber: string | null = profile.wallet_number ?? null;

    if (!resolvedWalletProvider && !resolvedWalletNumber) {
      const fallbackWallets = await readFallbackWalletsMap(supabase);
      const fb = fallbackWallets[user.id];
      if (fb) {
        resolvedWalletType = fb.wallet_type ?? inferWalletType(fb.wallet_provider);
        resolvedWalletProvider = fb.wallet_provider ?? null;
        resolvedWalletNumber = fb.wallet_number ?? null;
      }
    } else if (!resolvedWalletType && resolvedWalletProvider) {
      resolvedWalletType = inferWalletType(resolvedWalletProvider);
    }

    return {
      userId: user.id,
      email: user.email ?? null,
      role: isMaster ? 'master' : 'user',
      roles,
      isOwner,
      isAdmin,
      isSenior,
      isPiket,
      isFreelance,
      isMagang,
      isTiket,
      isMaster,
      canManageSettings,
      canManageAdvanced,
      canCreateTicket,
      canAccessPiket,
      canAccessRekapHarian,
      fullName: profile.full_name ?? null,
      phone: profile.phone ?? null,
      description: profile.description ?? null,
      walletType: resolvedWalletType,
      walletProvider: resolvedWalletProvider,
      walletNumber: resolvedWalletNumber,
      isApproved,
    };
  }

  // Jika belum ada di tabel profiles (fallback self-healing)
  const defaultRole: UserRole = isMasterEmail ? 'master' : 'user';
  const metaRole = (user.user_metadata?.selected_role || user.user_metadata?.requested_role) as AppRole | undefined;
  const defaultRoleToUse: AppRole = metaRole && ['magang', 'piket', 'freelance', 'tiket'].includes(metaRole) ? metaRole : 'magang';
  const defaultRoles: AppRole[] = isMasterEmail ? ['owner', 'magang'] : [defaultRoleToUse];
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
      exclude_from_recap: (!defaultRoles.includes('magang') && !defaultRoles.includes('piket') && !defaultRoles.includes('freelance')),
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
  const isPiket = defaultRoles.includes('piket');
  const isFreelance = defaultRoles.includes('freelance');
  const isMagang = defaultRoles.includes('magang');
  const isTiket = defaultRoles.includes('tiket');
  const canCreateTicket = isOwner || isTiket;
  const canAccessPiket = isOwner || isAdmin || isSenior || isPiket || isFreelance;
  const canAccessRekapHarian = isOwner || isAdmin || isSenior || isMasterEmail;

  return {
    userId: user.id,
    email: user.email ?? null,
    role: defaultRole,
    roles: defaultRoles,
    isOwner,
    isAdmin,
    isSenior,
    isPiket,
    isFreelance,
    isMagang,
    isTiket,
    isMaster: isMasterEmail,
    canManageSettings: isMasterEmail,
    canManageAdvanced: isMasterEmail,
    canCreateTicket,
    canAccessPiket,
    canAccessRekapHarian,
    fullName: metaFullName || null,
    phone: metaPhone || null,
    description: null,
    walletType: null,
    walletProvider: null,
    walletNumber: null,
    isApproved,
  };
}

/**
 * Memperbarui data nama, nomor telepon, deskripsi akun, dan wallet pengguna aktif
 */
export async function updateCurrentUserProfile(
  fullName: string,
  phone: string,
  description?: string | null,
  requestedRole?: AppRole | null,
  wallet?: WalletInfo
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Tidak terautentikasi.' };
  }

  const basePayload: {
    full_name: string;
    phone: string;
    updated_at: string;
    description?: string | null;
    roles?: AppRole[];
    exclude_from_recap?: boolean;
  } = {
    full_name: fullName.trim(),
    phone: phone.trim(),
    updated_at: new Date().toISOString(),
  };

  if (description !== undefined) {
    basePayload.description = description ? description.trim() : null;
  }

  if (requestedRole && ['magang', 'piket', 'freelance', 'tiket'].includes(requestedRole)) {
    basePayload.roles = [requestedRole];
    basePayload.exclude_from_recap = (requestedRole !== 'magang' && requestedRole !== 'piket' && requestedRole !== 'freelance');
  }

  const updatePayload =
    wallet !== undefined
      ? {
          ...basePayload,
          wallet_type: wallet.wallet_type,
          wallet_provider: wallet.wallet_provider,
          wallet_number: wallet.wallet_number,
        }
      : basePayload;

  const { error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', user.id);

  if (error) {
    if (wallet !== undefined && isMissingWalletColumnError(error)) {
      const { error: baseErr } = await supabase
        .from('profiles')
        .update(basePayload)
        .eq('id', user.id);

      if (baseErr) {
        return { success: false, error: baseErr.message };
      }

      const fallbackRes = await writeFallbackUserWallet(supabase, user.id, wallet);
      if (fallbackRes.error) {
        return { success: false, error: fallbackRes.error };
      }
      return { success: true };
    }
    return { success: false, error: error.message };
  }

  // Pastikan fallback lama disinkronkan/dibersihkan saat kolom profiles sudah aktif
  if (wallet !== undefined) {
    await writeFallbackUserWallet(supabase, user.id, {
      wallet_type: null,
      wallet_provider: null,
      wallet_number: null,
    });
  }

  return { success: true };
}
