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
    if (isMasterEmail && profile.role !== 'master') {
      await supabase
        .from('profiles')
        .update({ role: 'master' })
        .eq('id', user.id);
      return {
        userId: user.id,
        email: user.email ?? null,
        role: 'master',
        isMaster: true,
      };
    }

    const isMaster = profile.role === 'master';
    return {
      userId: user.id,
      email: user.email ?? null,
      role: profile.role,
      isMaster,
    };
  }

  // Jika belum ada di tabel profiles (fallback self-healing)
  const defaultRole: UserRole = isMasterEmail ? 'master' : 'user';

  await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email ?? '',
    role: defaultRole,
  });

  return {
    userId: user.id,
    email: user.email ?? null,
    role: defaultRole,
    isMaster: defaultRole === 'master',
  };
}
