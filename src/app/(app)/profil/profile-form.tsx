'use client';

import { useState } from 'react';
import { updateProfileAction } from './actions';
import { useTheme, type Theme } from '@/components/theme-provider';
import { showAlert } from '@/lib/swal';
import { logout } from '@/app/(auth)/login/actions';
import {
  User,
  Phone,
  Mail,
  FileText,
  Sun,
  Moon,
  Laptop,
  Check,
  Loader2,
  Crown,
  UserCheck,
  LogOut,
  Sparkles,
} from 'lucide-react';

interface ProfileFormProps {
  initialData: {
    email: string | null;
    fullName: string | null;
    phone: string | null;
    description: string | null;
    isMaster: boolean;
    role: string;
    isApproved: boolean;
  };
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const { theme, setTheme } = useTheme();

  const [fullName, setFullName] = useState(initialData.fullName ?? '');
  const [phone, setPhone] = useState(initialData.phone ?? '');
  const [description, setDescription] = useState(initialData.description ?? '');

  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSavedSuccess(false);

    if (!fullName.trim()) {
      setError('Nama wajib diisi.');
      return;
    }

    const cleanedPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanedPhone.length < 9) {
      setError('Nomor Telepon tidak valid (minimal 9 digit).');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('fullName', fullName.trim());
      formData.append('phone', cleanedPhone);
      formData.append('description', description.trim());

      const res = await updateProfileAction(formData);
      if (res?.error) {
        setError(res.error);
        showAlert('Gagal Menyimpan', res.error, 'error');
      } else {
        setSavedSuccess(true);
        showAlert('Berhasil', 'Perubahan profil dan deskripsi akun berhasil disimpan!', 'success');
      }
    } catch {
      setError('Terjadi kesalahan saat menyimpan profil.');
    } finally {
      setLoading(false);
    }
  }

  const themeOptions: { value: Theme; label: string; desc: string; icon: typeof Sun }[] = [
    {
      value: 'light',
      label: 'Terang',
      desc: 'Tampilan bersih & cerah',
      icon: Sun,
    },
    {
      value: 'dark',
      label: 'Gelap (Dark Mode)',
      desc: 'Nyaman untuk mata malam hari',
      icon: Moon,
    },
    {
      value: 'system',
      label: 'Sistem',
      desc: 'Ikuti tema perangkat Anda',
      icon: Laptop,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. KARTU TEMA / DARK MODE */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-slate-100 text-sm">Tema Tampilan (Dark Mode)</h2>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              Pilih mode tampilan aplikasi sesuai preferensi Anda.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all min-h-[58px] ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/50 dark:border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                <div
                  className={`p-2 rounded-lg flex-shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-gray-900 dark:text-slate-100">
                      {opt.label}
                    </span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5 leading-tight">
                    {opt.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. FORM EDIT DATA DIRI & DESKRIPSI AKUN */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-slate-100 text-sm">Informasi Akun & Pembayaran</h2>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                Perbarui nama, kontak, dan nomor rekening/e-wallet Anda.
              </p>
            </div>
            {initialData.isMaster ? (
              <span className="text-xs bg-amber-100 border border-amber-300 text-amber-800 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs">
                <Crown className="h-3 w-3" /> Master
              </span>
            ) : (
              <span className="text-xs bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                <UserCheck className="h-3 w-3" /> Petugas Aktif
              </span>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium">
              {error}
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl text-xs text-green-700 dark:text-green-400 font-medium flex items-center gap-2">
              <Check className="h-4 w-4 flex-shrink-0" />
              <span>Data profil dan deskripsi rekening berhasil diperbarui.</span>
            </div>
          )}

          {/* Email Terdaftar (Readonly) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
              Alamat Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
              <input
                type="email"
                disabled
                value={initialData.email ?? ''}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-500 dark:text-slate-400 text-xs cursor-not-allowed"
              />
            </div>
          </div>

          {/* Nama */}
          <div>
            <label
              htmlFor="fullName"
              className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1"
            >
              Nama <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px]"
              />
            </div>
          </div>

          {/* Nomor HP */}
          <div>
            <label
              htmlFor="phone"
              className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1"
            >
              Nomor Telepon / WhatsApp <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px]"
              />
            </div>
          </div>

          {/* Deskripsi Akun (Nomor Mandiri, No DANA, dll) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="description"
                className="block text-xs font-semibold text-gray-700 dark:text-slate-300"
              >
                Deskripsi Akun (Rekening Bank / E-Wallet)
              </label>
              <span className="text-[10px] text-gray-400 dark:text-slate-500">Opsional</span>
            </div>
            <div className="relative">
              <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="nomor mandiri no dana dll (Contoh: Rek Mandiri: 1234567890 a/n Made, DANA/GoPay: 08123456789)"
                className="w-full p-3 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
              <FileText className="h-3 w-3 text-blue-500 flex-shrink-0" />
              <span>
                Catatan informasi ini digunakan untuk pencatatan rekening Bank Mandiri, DANA, GoPay, atau catatan operasional Anda.
              </span>
            </p>
          </div>

          {/* Tombol Simpan */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors min-h-[44px] flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyimpan Perubahan...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Simpan Perubahan Profil</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* 3. KARTU KELUAR (LOGOUT) */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-gray-900 dark:text-slate-100">Keluar dari Akun</h3>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
            Akhiri sesi Anda pada perangkat ini.
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl text-xs font-semibold transition-colors min-h-[40px]"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar</span>
          </button>
        </form>
      </div>
    </div>
  );
}

