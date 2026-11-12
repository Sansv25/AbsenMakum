import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/supabase/types';

export const MASTER_EMAIL = 'madesanjaya255@gmail.com';

/**
 * Mengambil profil dan role pengguna yang sedang login.
 * Jika profil belum ada (misal user lama sebelum migrasi),
 * otomatis dibuatkan dengan role master untuk email master dan user untuk lainnya.
 */
export async function getCurrentUserProfile(): Promise<{
  userId: string | null;
  email: string | null;
  role: UserRole;
  isMaster: boolean;
  fullName: string | null;
  phone: string | null;
  isApproved: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: null,
      email: null,
      role: 'user',
      isMaster: false,
      fullName: null,
      phone: null,
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
    // Jika email adalah master_email tapi rolenya bukan master di db, perbarui
    if (isMasterEmail && (profile.role !== 'master' || profile.is_approved !== true)) {
      await supabase
        .from('profiles')
        .update({ role: 'master', is_approved: true })
        .eq('id', user.id);
      return {
        userId: user.id,
        email: user.email ?? null,
        role: 'master',
        isMaster: true,
        fullName: profile.full_name ?? null,
        phone: profile.phone ?? null,
        isApproved: true,
      };
    }

    const isMaster = profile.role === 'master' || isMasterEmail;
    const isApproved = isMaster ? true : (profile.is_approved ?? false);

    return {
      userId: user.id,
      email: user.email ?? null,
      role: profile.role,
      isMaster,
      fullName: profile.full_name ?? null,
      phone: profile.phone ?? null,
      isApproved,
    };
  }

  // Jika belum ada di tabel profiles (fallback self-healing)
  const defaultRole: UserRole = isMasterEmail ? 'master' : 'user';
  const metaFullName = (user.user_metadata?.full_name || user.user_metadata?.name || '') as string;
  const metaPhone = (user.user_metadata?.phone || user.user_metadata?.phone_number || '') as string;
  const isApproved = isMasterEmail;

  await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email ?? '',
    role: defaultRole,
    full_name: metaFullName || null,
    phone: metaPhone || null,
    is_approved: isApproved,
  });

  return {
    userId: user.id,
    email: user.email ?? null,
    role: defaultRole,
    isMaster: isMasterEmail,
    fullName: metaFullName || null,
    phone: metaPhone || null,
    isApproved,
  };
}

/**
 * Memperbarui data nama dan nomor telepon pengguna aktif
 */
export async function updateCurrentUserProfile(
  fullName: string,
  phone: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Tidak terautentikasi.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName.trim(),
      phone: phone.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
