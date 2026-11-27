import type { createClient } from '@/lib/supabase/server';
import type { WalletInfo } from '@/lib/wallet';

const FALLBACK_WALLETS_KEY = 'user_wallets_fallback';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export function isMissingWalletColumnError(
  error: { code?: string | null; message?: string | null } | null
): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') {
    const msg = (error.message || '').toLowerCase();
    return msg.includes('wallet_') || error.code === '42703';
  }
  const msg = (error.message || '').toLowerCase();
  return msg.includes('wallet_provider') || msg.includes('wallet_number') || msg.includes('wallet_type');
}

export async function readFallbackWalletsMap(
  supabase: SupabaseServerClient
): Promise<Record<string, WalletInfo>> {
  try {
    const { data } = await supabase
      .from('ticketing_settings')
      .select('value')
      .eq('key', FALLBACK_WALLETS_KEY)
      .maybeSingle();

    if (!data?.value || typeof data.value !== 'object' || Array.isArray(data.value)) {
      return {};
    }
    return data.value as Record<string, WalletInfo>;
  } catch {
    return {};
  }
}

export async function writeFallbackUserWallet(
  supabase: SupabaseServerClient,
  userId: string,
  wallet: WalletInfo
): Promise<{ error?: string }> {
  try {
    const current = await readFallbackWalletsMap(supabase);
    const nextMap: Record<string, WalletInfo> = { ...current };

    if (!wallet.wallet_provider && !wallet.wallet_number) {
      delete nextMap[userId];
    } else {
      nextMap[userId] = wallet;
    }

    const { error } = await supabase.from('ticketing_settings').upsert({
      key: FALLBACK_WALLETS_KEY,
      value: nextMap,
      updated_at: new Date().toISOString(),
    });

    return error ? { error: error.message } : {};
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Gagal menyimpan data wallet.' };
  }
}
