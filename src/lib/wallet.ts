export type WalletType = 'bank' | 'ewallet';

export const EWALLET_PROVIDERS = [
  'DANA',
  'GoPay',
  'OVO',
  'ShopeePay',
  'LinkAja',
  'QRIS',
] as const;

export const BANK_PROVIDERS = [
  'Mandiri',
  'BRI',
  'BCA',
  'BNI',
  'BSI',
  'CIMB Niaga',
  'SeaBank',
  'Bank Jago',
] as const;

export interface WalletInfo {
  wallet_type: WalletType | null;
  wallet_provider: string | null;
  wallet_number: string | null;
}

/**
 * Menentukan jenis wallet (ewallet vs bank) berdasarkan nama penyedia.
 */
export function inferWalletType(provider?: string | null, explicitType?: string | null): WalletType {
  if (explicitType === 'bank' || explicitType === 'ewallet') {
    return explicitType;
  }
  const normalized = (provider ?? '').trim().toLowerCase();
  if (!normalized) return 'ewallet';
  if (
    EWALLET_PROVIDERS.some((p) => p.toLowerCase() === normalized) ||
    normalized.includes('dana') ||
    normalized.includes('gopay') ||
    normalized.includes('ovo') ||
    normalized.includes('shopee') ||
    normalized.includes('linkaja') ||
    normalized.includes('qris') ||
    normalized.includes('wallet')
  ) {
    return 'ewallet';
  }
  return 'bank';
}

/**
 * Validasi dan normalisasi input wallet tunggal per akun (opsional).
 * Keduanya boleh kosong, tetapi jika salah satu diisi maka keduanya wajib terisi.
 */
export function validateWalletInput(input: {
  walletType?: string | null;
  walletProvider?: string | null;
  walletNumber?: string | null;
}):
  | { ok: true; value: WalletInfo }
  | { ok: false; error: string } {
  const provider = (input.walletProvider ?? '').trim();
  const number = (input.walletNumber ?? '').trim();

  if (!provider && !number) {
    return {
      ok: true,
      value: {
        wallet_type: null,
        wallet_provider: null,
        wallet_number: null,
      },
    };
  }

  if (!provider) {
    return { ok: false, error: 'Pilih atau isi nama Bank / E-Wallet terlebih dahulu.' };
  }

  if (!number) {
    return { ok: false, error: 'Nomor Rekening / E-Wallet wajib diisi jika memilih Bank / E-Wallet.' };
  }

  if (provider.length > 50) {
    return { ok: false, error: 'Nama Bank / E-Wallet maksimal 50 karakter.' };
  }

  if (number.length > 50) {
    return { ok: false, error: 'Nomor Rekening / E-Wallet maksimal 50 karakter.' };
  }

  return {
    ok: true,
    value: {
      wallet_type: inferWalletType(provider, input.walletType),
      wallet_provider: provider,
      wallet_number: number,
    },
  };
}
