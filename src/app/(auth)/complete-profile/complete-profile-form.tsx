'use client';

import { useState } from 'react';
import { saveProfileDetails } from './actions';
import {
  User,
  Phone,
  Mail,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface CompleteProfileFormProps {
  email: string;
  initialFullName: string;
  initialPhone: string;
}

export function CompleteProfileForm({
  email,
  initialFullName,
  initialPhone,
}: CompleteProfileFormProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Nama lengkap wajib diisi.');
      return;
    }

    const cleanedPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanedPhone.length < 9) {
      setError('Nomor Telepon tidak valid (minimal 9 digit).');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok dengan password yang dibuat.');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('fullName', fullName.trim());
    formData.append('phone', cleanedPhone);
    formData.append('password', password.trim());
    formData.append('confirmPassword', confirmPassword.trim());

    const res = await saveProfileDetails(formData);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl p-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Email Terhubung (Read-only) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
            Email Google
          </label>
          <span className="text-[10px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 px-2 py-0.2 rounded-full inline-flex items-center gap-1">
            <CheckCircle2 className="h-2.5 w-2.5" /> Terverifikasi
          </span>
        </div>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
          <input
            type="email"
            disabled
            value={email}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-500 dark:text-slate-400 text-sm cursor-not-allowed font-medium"
          />
        </div>
      </div>

      {/* Nama Lengkap */}
      <div>
        <label
          htmlFor="fullName"
          className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1"
        >
          Nama Lengkap Petugas <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Contoh: Budi Santoso"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Nomor Telepon / WhatsApp */}
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
            name="phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Contoh: 081234567890"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
          Nomor aktif untuk koordinasi piket operasional.
        </p>
      </div>

      {/* Buat Password Baru */}
      <div>
        <label
          htmlFor="password"
          className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1"
        >
          Buat Password Akun <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimal 6 karakter"
            className="w-full pl-10 pr-11 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors"
            title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Konfirmasi Password */}
      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1"
        >
          Konfirmasi Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ulangi password di atas"
            className="w-full pl-10 pr-11 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1 rounded-lg transition-colors"
            title={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Tip Info Login di Perangkat Lain */}
      <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 rounded-xl flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
        <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Akses Lintas Perangkat:</strong> Password ini memungkinkan Anda untuk login manual menggunakan <strong>Email &amp; Password</strong> di perangkat atau browser lain tanpa harus login ke akun Google.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-900 text-white font-semibold text-sm rounded-xl transition-colors min-h-[44px] shadow-sm mt-3"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Menyimpan &amp; Membuat Kredensial...</span>
          </>
        ) : (
          <span>Simpan Profil &amp; Password</span>
        )}
      </button>
    </form>
  );
}

