'use client';

import { useState } from 'react';
import type { EmailRecapSettings } from '@/lib/data/email-recap';
import { saveRecapSettingsAction, sendRecapNowAction } from './actions';
import { showAlert, showConfirm } from '@/lib/swal';
import {
  Mail,
  Plus,
  X,
  Send,
  Calendar,
  Key,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';

interface EmailRecapFormProps {
  initialSettings: EmailRecapSettings;
}

export function EmailRecapForm({ initialSettings }: EmailRecapFormProps) {
  const [settings, setSettings] = useState<EmailRecapSettings>(initialSettings);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState<'mingguan' | 'bulanan' | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Tambah email penerima
  function handleAddEmail() {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    // Validasi format email sederhana
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert('Format Email Tidak Valid', 'Pastikan memasukkan alamat email yang benar.', 'warning');
      return;
    }

    if (settings.recipients.includes(email)) {
      showAlert('Email Sudah Ada', 'Alamat email ini sudah terdaftar di daftar penerima.', 'info');
      return;
    }

    setSettings((prev) => ({
      ...prev,
      recipients: [...prev.recipients, email],
    }));
    setNewEmail('');
  }

  // Hapus email penerima
  function handleRemoveEmail(emailToRemove: string) {
    setSettings((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((e) => e !== emailToRemove),
    }));
  }

  // Simpan pengaturan
  async function handleSaveSettings(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await saveRecapSettingsAction(settings);
      if (!res.success) {
        showAlert('Gagal Menyimpan', res.error || 'Terjadi kesalahan sistem.', 'error');
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      showAlert('Error', 'Gagal menyimpan pengaturan.', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Test kirim PDF sekarang
  async function handleSendTest(periodType: 'mingguan' | 'bulanan') {
    if (settings.recipients.length === 0) {
      showAlert('Penerima Kosong', 'Tambahkan minimal 1 alamat email penerima sebelum menguji pengiriman.', 'warning');
      return;
    }

    if (!settings.senderEmail.trim()) {
      showAlert('Email Pengirim Kosong', 'Harap isi alamat Email Pengirim (Sender Email) yang terdaftar di akun Brevo Anda.', 'warning');
      return;
    }

    const periodLabel = periodType === 'mingguan' ? 'Mingguan (7 hari terakhir)' : 'Bulanan (1 bulan saat ini)';
    const confirmed = await showConfirm(
      `Kirim Rekapan ${periodType === 'mingguan' ? 'Mingguan' : 'Bulanan'} Sekarang?`,
      `Sistem akan mengompilasi laporan rekapan ${periodLabel} menjadi dokumen PDF resmi dan langsung mengirimkannya ke ${settings.recipients.length} email penerima.`,
      'Ya, Kirim Sekarang'
    );

    if (!confirmed) return;

    setSendingTest(periodType);

    try {
      // Simpan pengaturan terlebih dahulu jika ada perubahan
      await saveRecapSettingsAction(settings);

      const res = await sendRecapNowAction(periodType);
      if (res.success) {
        showAlert(
          'Email Berhasil Dikirim! 🚀',
          res.message || 'Laporan PDF rekapan piket telah berhasil dikirim ke seluruh email tujuan.',
          'success'
        );
        // Update local state last sent
        setSettings((prev) => ({
          ...prev,
          lastSentAt: new Date().toISOString(),
          lastStatus: res.message || 'Berhasil terkirim via Brevo',
        }));
      } else {
        showAlert(
          'Pengiriman Gagal',
          `Brevo menolak pengiriman: ${res.error}\n\nPastikan Brevo API Key valid dan Email Pengirim sudah terverifikasi di akun Brevo Anda.`,
          'error'
        );
      }
    } catch {
      showAlert('Error', 'Terjadi kesalahan saat memproses pengiriman email.', 'error');
    } finally {
      setSendingTest(null);
    }
  }

  return (
    <form onSubmit={handleSaveSettings} className="space-y-6">
      {/* 1. STATUS PENGIRIMAN OTOMATIS (TOGGLE) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-500" />
            Pengiriman Rekapan Otomatis
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Aktifkan untuk mengirimkan PDF rekapan kehadiran secara berkala ke email tujuan.
          </p>
        </div>

        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={settings.isActive}
            onChange={(e) => setSettings({ ...settings, isActive: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* 2. DAFTAR EMAIL PENERIMA (MULTI-RECIPIENTS) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <User className="h-4 w-4 text-indigo-500" />
              Daftar Email Penerima Rekapan
            </h3>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900">
              {settings.recipients.length} Penerima
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Bisa di-set masuk ke email siapa saja (Manager, SPV, Admin, PIC Area, dll).
          </p>
        </div>

        {/* Input Tambah Email */}
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddEmail();
              }
            }}
            placeholder="Ketik email penerima (contoh: spv@iconnet.id)..."
            className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAddEmail}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-1.5 flex-shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah</span>
          </button>
        </div>

        {/* Tags / List Email */}
        {settings.recipients.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 text-center text-xs text-gray-400 dark:text-slate-500">
            Belum ada email yang didaftarkan. Masukkan email di atas untuk menerima laporan rekapan.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            {settings.recipients.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              >
                <Mail className="h-3 w-3 text-blue-500" />
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveEmail(email)}
                  className="p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-500 hover:text-blue-700 transition-colors ml-0.5"
                  title="Hapus email ini"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 3. FREKUENSI & JADWAL REKAPAN */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-500" />
            Pilihan Periode &amp; Frekuensi Rekapan
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Tentukan apakah ingin menerima laporan mingguan, bulanan, atau keduanya.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Opsi 1: Mingguan */}
          <label
            className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
              settings.frequency === 'mingguan'
                ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/20'
                : 'bg-gray-50/50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-gray-900 dark:text-slate-100">
                1. Mingguan
              </span>
              <input
                type="radio"
                name="frequency"
                checked={settings.frequency === 'mingguan'}
                onChange={() => setSettings({ ...settings, frequency: 'mingguan' })}
                className="text-blue-600 focus:ring-blue-500"
              />
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-snug">
              Dikirim setiap hari Senin pagi, merangkum piket 7 hari terakhir.
            </p>
          </label>

          {/* Opsi 2: Bulanan */}
          <label
            className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
              settings.frequency === 'bulanan'
                ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/20'
                : 'bg-gray-50/50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-gray-900 dark:text-slate-100">
                2. Bulanan
              </span>
              <input
                type="radio"
                name="frequency"
                checked={settings.frequency === 'bulanan'}
                onChange={() => setSettings({ ...settings, frequency: 'bulanan' })}
                className="text-blue-600 focus:ring-blue-500"
              />
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-snug">
              Dikirim setiap tanggal 1, merangkum absensi 1 bulan penuh sebelumnya.
            </p>
          </label>

          {/* Opsi 3: Keduanya */}
          <label
            className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
              settings.frequency === 'keduanya'
                ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/20'
                : 'bg-gray-50/50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-gray-900 dark:text-slate-100">
                3. Keduanya
              </span>
              <input
                type="radio"
                name="frequency"
                checked={settings.frequency === 'keduanya'}
                onChange={() => setSettings({ ...settings, frequency: 'keduanya' })}
                className="text-blue-600 focus:ring-blue-500"
              />
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-snug">
              Menerima laporan rutin mingguan dan laporan akbar bulanan.
            </p>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Hari Pengiriman Mingguan
            </label>
            <select
              value={settings.sendDayWeekly}
              onChange={(e) => setSettings({ ...settings, sendDayWeekly: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none"
            >
              <option value={1}>Hari Senin</option>
              <option value={2}>Hari Selasa</option>
              <option value={5}>Hari Jumat</option>
              <option value={6}>Hari Sabtu</option>
              <option value={7}>Hari Minggu</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Jam Pengiriman (WITA)
            </label>
            <div className="relative">
              <input
                type="time"
                value={settings.sendTime}
                onChange={(e) => setSettings({ ...settings, sendTime: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. KONFIGURASI PENGIRIM BREVO */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Key className="h-4 w-4 text-amber-500" />
            Konfigurasi Akun Pengirim (Brevo)
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Digunakan oleh server untuk memproses pengiriman PDF rekapan via Brevo API.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Nama Pengirim (Sender Name)
            </label>
            <input
              type="text"
              value={settings.senderName}
              onChange={(e) => setSettings({ ...settings, senderName: e.target.value })}
              placeholder="Absensi Piket ICONNET"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Email Pengirim (Sender Email Brevo)
            </label>
            <input
              type="email"
              value={settings.senderEmail}
              onChange={(e) => setSettings({ ...settings, senderEmail: e.target.value })}
              placeholder="Email yang terdaftar di Brevo..."
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
            Brevo API Key (Master Key)
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={settings.brevoApiKey || ''}
              onChange={(e) => setSettings({ ...settings, brevoApiKey: e.target.value })}
              placeholder="xkeysib-..."
              className="w-full px-3.5 py-2 pr-10 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none font-mono"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
            >
              {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          {settings.brevoApiKey && settings.brevoApiKey.trim().startsWith('xsmtpsib-') && (
            <div className="mt-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs leading-relaxed flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Perhatian:</strong> Kunci yang Anda tempel adalah <strong>SMTP Key</strong> (berawalan <code>xsmtpsib-</code>).<br />
                Untuk fitur kirim email otomatis ini, Anda membutuhkan <strong>API Key</strong>. Caranya:<br />
                Buka Brevo &rarr; <strong>SMTP &amp; API</strong> &rarr; klik tab <strong>API Keys</strong> (di sebelah kanan tab SMTP) &rarr; klik tombol <strong>Generate a new API key</strong>. Kunci yang benar akan berawalan <code>xkeysib-...</code>.
              </div>
            </div>
          )}
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
            Ambil di dashboard Brevo &rarr; <strong>SMTP &amp; API</strong> &rarr; klik tab <strong>API Keys</strong> &rarr; <strong>Generate a new API key</strong> (kuncinya berawalan <code>xkeysib-...</code>).
          </p>
        </div>
      </div>

      {/* 5. LOG / STATUS TERAKHIR */}
      {settings.lastSentAt && (
        <div className="bg-gray-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-gray-100 dark:border-slate-800 text-xs space-y-1">
          <div className="flex items-center justify-between text-gray-600 dark:text-slate-300">
            <span className="font-semibold">Pengiriman Terakhir:</span>
            <span>{new Date(settings.lastSentAt).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })} WITA</span>
          </div>
          {settings.lastStatus && (
            <div className="text-[11px] text-gray-500 dark:text-slate-400">
              Status: <strong className="text-gray-700 dark:text-slate-200">{settings.lastStatus}</strong>
            </div>
          )}
        </div>
      )}

      {/* 6. TOMBOL SIMPAN & TEST KIRIM */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-colors disabled:opacity-50 shadow-xs"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan Rekapan'}</span>
          </button>
        </div>

        {saveSuccess && (
          <div className="p-3 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>Pengaturan rekapan email berhasil disimpan!</span>
          </div>
        )}

        {/* KARTU TEST KIRIM SEKARANG */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-850 p-4 rounded-2xl border border-blue-100 dark:border-slate-700 space-y-3">
          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Uji Coba Kirim PDF Rekapan Sekarang
            </h4>
            <p className="text-[11px] text-gray-600 dark:text-slate-400 mt-0.5">
              Kirimkan dokumen PDF rekapan detik ini juga ke seluruh email penerima di atas untuk memastikan Brevo bekerja normal.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              disabled={sendingTest !== null}
              onClick={() => handleSendTest('mingguan')}
              className="inline-flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-2xs"
            >
              {sendingTest === 'mingguan' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-emerald-500" />
              )}
              <span>{sendingTest === 'mingguan' ? 'Mengirim PDF...' : 'Kirim Rekap Mingguan (PDF)'}</span>
            </button>

            <button
              type="button"
              disabled={sendingTest !== null}
              onClick={() => handleSendTest('bulanan')}
              className="inline-flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-2xs"
            >
              {sendingTest === 'bulanan' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-blue-500" />
              )}
              <span>{sendingTest === 'bulanan' ? 'Mengirim PDF...' : 'Kirim Rekap Bulanan (PDF)'}</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

