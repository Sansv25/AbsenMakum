'use client';

import { useState } from 'react';
import type { EmailRecapSettings } from '@/lib/data/email-recap';
import { saveRecapSettingsAction, sendRecapNowAction, sendDailyRecapNowAction } from './actions';
import { showAlert, showConfirm } from '@/lib/swal';
import {
  Mail,
  Plus,
  X,
  Send,
  Calendar,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  ShieldCheck,
  Eye,
  EyeOff,
  Info,
  GraduationCap,
  CalendarOff,
} from 'lucide-react';

interface EmailRecapFormProps {
  initialSettings: EmailRecapSettings;
}

export function EmailRecapForm({ initialSettings }: EmailRecapFormProps) {
  const [settings, setSettings] = useState<EmailRecapSettings>(initialSettings);
  const [newEmail, setNewEmail] = useState('');
  const [newDailyEmail, setNewDailyEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState<'mingguan' | 'bulanan' | null>(null);
  const [sendingDailyTest, setSendingDailyTest] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Tambah email penerima piket
  function handleAddEmail() {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert('Format Email Tidak Valid', 'Pastikan memasukkan alamat email yang benar.', 'warning');
      return;
    }

    if (settings.recipients.includes(email)) {
      showAlert('Email Sudah Ada', 'Alamat email ini sudah terdaftar di daftar penerima piket.', 'info');
      return;
    }

    const updated = [...settings.recipients, email];
    const newSettings = { ...settings, recipients: updated };
    setSettings(newSettings);
    setNewEmail('');
    // Simpan otomatis ke database agar tidak hilang saat di-refresh
    saveRecapSettingsAction(newSettings).catch(() => {});
  }

  // Hapus email penerima piket
  function handleRemoveEmail(emailToRemove: string) {
    const updated = settings.recipients.filter((e) => e !== emailToRemove);
    const newSettings = { ...settings, recipients: updated };
    setSettings(newSettings);
    // Simpan otomatis ke database agar tidak hilang saat di-refresh
    saveRecapSettingsAction(newSettings).catch(() => {});
  }

  // Tambah email penerima rekapan harian (anak magang)
  function handleAddDailyEmail() {
    const email = newDailyEmail.trim().toLowerCase();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert('Format Email Tidak Valid', 'Pastikan memasukkan alamat email yang benar.', 'warning');
      return;
    }

    const currentList = settings.dailyRecipients || [];
    if (currentList.includes(email)) {
      showAlert('Email Sudah Ada', 'Alamat email ini sudah terdaftar di daftar penerima rekapan magang.', 'info');
      return;
    }

    const updated = [...currentList, email];
    const newSettings = { ...settings, dailyRecipients: updated };
    setSettings(newSettings);
    setNewDailyEmail('');
    // Simpan otomatis ke database agar tidak hilang saat di-refresh
    saveRecapSettingsAction(newSettings).catch(() => {});
  }

  // Hapus email penerima rekapan harian
  function handleRemoveDailyEmail(emailToRemove: string) {
    const updated = (settings.dailyRecipients || []).filter((e) => e !== emailToRemove);
    const newSettings = { ...settings, dailyRecipients: updated };
    setSettings(newSettings);
    // Simpan otomatis ke database agar tidak hilang saat di-refresh
    saveRecapSettingsAction(newSettings).catch(() => {});
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
        if (res.error) {
          showAlert('Tersimpan dengan Catatan', res.error, 'info');
        }
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      showAlert('Error', 'Gagal menyimpan pengaturan.', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Test kirim PDF Piket sekarang
  async function handleSendTest(periodType: 'mingguan' | 'bulanan') {
    if (settings.recipients.length === 0) {
      showAlert('Penerima Kosong', 'Tambahkan minimal 1 alamat email penerima sebelum menguji pengiriman.', 'warning');
      return;
    }

    if (!settings.senderEmail.trim()) {
      showAlert('Email Pengirim Kosong', 'Harap isi alamat Email Pengirim (Sender Email) yang terdaftar di akun Brevo Anda.', 'warning');
      return;
    }

    const periodLabel = periodType === 'mingguan' ? 'Mingguan (Senin s/d Minggu)' : 'Bulanan (1 bulan saat ini)';
    const confirmed = await showConfirm(
      `Kirim Rekapan ${periodType === 'mingguan' ? 'Mingguan' : 'Bulanan'} Sekarang?`,
      `Sistem akan mengompilasi laporan rekapan ${periodLabel} menjadi dokumen PDF resmi dan langsung mengirimkannya ke ${settings.recipients.length} email penerima.`,
      'Ya, Kirim Sekarang'
    );

    if (!confirmed) return;

    setSendingTest(periodType);

    try {
      await saveRecapSettingsAction(settings);
      const res = await sendRecapNowAction(periodType);
      if (res.success) {
        showAlert(
          'Email Berhasil Dikirim! 🚀',
          res.message || 'Laporan PDF rekapan piket telah berhasil dikirim ke seluruh email tujuan.',
          'success'
        );
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

  // Test kirim Rekap Absensi Harian Magang Sekarang
  async function handleSendDailyTest() {
    const dailyList = settings.dailyRecipients || [];

    if (dailyList.length === 0) {
      showAlert(
        'Email Penerima Magang Belum Diisi',
        'Tambahkan minimal 1 alamat email pada daftar Penerima Rekapan Magang terlebih dahulu.',
        'warning'
      );
      return;
    }

    if (!settings.senderEmail.trim()) {
      showAlert(
        'Email Pengirim Kosong',
        'Harap isi alamat Email Pengirim (Sender Email) yang terdaftar di akun Brevo Anda pada bagian Konfigurasi Brevo di bawah.',
        'warning'
      );
      return;
    }

    const confirmed = await showConfirm(
      'Kirim Rekapan Absen Harian Hari Ini?',
      `Sistem akan mengompilasi data kehadiran anak magang hari ini (hadir vs tidak hadir) dan mengirimkannya HANYA ke ${dailyList.length} email tujuan rekapan magang:\n\n${dailyList.join('\n')}`,
      'Ya, Kirim Sekarang'
    );

    if (!confirmed) return;

    setSendingDailyTest(true);

    try {
      await saveRecapSettingsAction(settings);
      const res = await sendDailyRecapNowAction(undefined, dailyList);
      if (res.success) {
        showAlert(
          'Rekapan Magang Berhasil Dikirim! 🚀',
          res.message || 'Laporan rekapan absensi anak magang hari ini telah dikirim ke email tujuan.',
          'success'
        );
        setSettings((prev) => ({
          ...prev,
          dailyLastSentAt: new Date().toISOString(),
          dailyLastStatus: res.message || 'Berhasil terkirim via Brevo',
        }));
      } else {
        showAlert(
          'Pengiriman Gagal',
          `Gagal mengirim rekapan magang: ${res.error}`,
          'error'
        );
      }
    } catch {
      showAlert('Error', 'Terjadi kesalahan saat memproses pengiriman email.', 'error');
    } finally {
      setSendingDailyTest(false);
    }
  }

  return (
    <form onSubmit={handleSaveSettings} className="space-y-6">
      {/* ============================================================== */}
      {/* 0. PANDUAN DUA JALUR EMAIL REKAPAN ICONNET                     */}
      {/* ============================================================== */}
      <div className="bg-slate-50 dark:bg-slate-850/80 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
            Panduan 2 Jenis Email Rekapan ICONNET
          </h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">
          Sistem absensi ICONNET memisahkan laporan rekapan menjadi <strong>2 jalur email penerima yang berbeda</strong> agar target laporan tidak tertukar:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Box Magang */}
          <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <GraduationCap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>1. Rekapan Magang (Harian)</span>
            </div>
            <p className="text-[11px] text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
              <strong>Isi:</strong> Rekap presensi harian anak magang (menampilkan siapa yang <strong>hadir</strong> beserta jam/foto bukti &amp; siapa yang <strong>tidak hadir / absen</strong>).
            </p>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
              Format: Email HTML Interaktif &bull; Dikirim tiap hari kerja
            </p>
          </div>

          {/* Box Piket */}
          <div className="bg-blue-50/70 dark:bg-blue-950/30 p-3.5 rounded-xl border border-blue-200 dark:border-blue-800/60 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800 dark:text-blue-300">
              <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>2. Rekapan Piket (Shift Pagi &amp; Sore)</span>
            </div>
            <p className="text-[11px] text-blue-900/80 dark:text-blue-200/80 leading-relaxed">
              <strong>Isi:</strong> Laporan dokumen <strong>PDF resmi</strong> kegiatan petugas piket shift pagi (08.00–16.30) &amp; sore (16.30–08.00) lengkap dengan checklist tugas, foto lapangan, dan tanda tangan digital.
            </p>
            <p className="text-[10px] text-blue-700 dark:text-blue-400 font-semibold">
              Format: Lampiran Dokumen PDF &bull; Dikirim Mingguan / Bulanan
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. PENERIMA REKAPAN MAGANG (ABSEN HARIAN)                      */}
      {/* ============================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border-2 border-emerald-500/40 dark:border-emerald-500/50 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400">
                <GraduationCap className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                Penerima Rekapan Magang (Absen Harian)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Khusus Anak Magang
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
              <strong>Keterangan Penerima:</strong> Masukkan email pembimbing magang, HRD, atau supervisor yang memantau kehadiran anak magang. Laporan otomatis merinci siapa saja anak magang yang <strong>hadir</strong> dan yang <strong>tidak hadir</strong> pada hari kerja.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 hidden sm:inline">
              {settings.dailyIsActive ? 'Otomatis Aktif' : 'Nonaktif'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer shrink-0" title="Aktifkan/Nonaktifkan Pengiriman Rekapan Harian Magang">
              <input
                type="checkbox"
                checked={settings.dailyIsActive}
                onChange={(e) => setSettings({ ...settings, dailyIsActive: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        {/* Info Proteksi Hari Libur */}
        <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2.5">
          <CalendarOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Proteksi Hari Libur Aktif:</strong> Pengiriman rekapan harian otomatis dilewati pada tanggal merah yang diatur di menu <strong>Libur &amp; Shift</strong> serta akhir pekan (Sabtu &amp; Minggu).
          </span>
        </div>

        {/* Input Tambah Email Magang */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
              Daftar Alamat Email Penerima Rekapan Magang
            </label>
            <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              {(settings.dailyRecipients || []).length} Penerima Magang
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={newDailyEmail}
              onChange={(e) => setNewDailyEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddDailyEmail();
                }
              }}
              placeholder="Masukkan email pembimbing / SPV magang (contoh: spv.magang@iconnet.id)..."
              className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleAddDailyEmail}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah</span>
            </button>
          </div>

          {/* Chips Email Magang */}
          {(settings.dailyRecipients || []).length === 0 ? (
            <div className="p-3.5 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 text-center text-xs text-gray-400 dark:text-slate-500">
              Belum ada email khusus rekapan magang yang didaftarkan. Masukkan email di atas untuk menerima laporan absensi anak magang.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {(settings.dailyRecipients || []).map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                >
                  <Mail className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDailyEmail(email)}
                    className="p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-600 hover:text-emerald-800 transition-colors ml-0.5"
                    title="Hapus email ini"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Jam Kirim Harian & Tombol Uji Coba */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-slate-800">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
              Jadwal Kirim Otomatis Rekapan Magang (WITA)
            </label>
            <div className="relative">
              <input
                type="time"
                value={settings.dailySendTime || '18:00'}
                onChange={(e) => setSettings({ ...settings, dailySendTime: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
              Laporan dikirim otomatis pada jam ini setiap hari kerja.
            </p>
          </div>

          <div className="flex flex-col justify-end">
            <button
              type="button"
              disabled={sendingDailyTest}
              onClick={handleSendDailyTest}
              className="w-full py-2.5 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs"
            >
              {sendingDailyTest ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Mengirim Rekap Magang...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Kirim Tes Rekap Magang Sekarang</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Terakhir Rekapan Magang */}
        {settings.dailyLastSentAt && (
          <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 text-[11px] text-gray-500 dark:text-slate-400 flex items-center justify-between">
            <span>
              Pengiriman terakhir rekapan magang: <strong>{new Date(settings.dailyLastSentAt).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })} WITA</strong>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[200px]">
              {settings.dailyLastStatus || 'Berhasil'}
            </span>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 2. PENERIMA REKAPAN PIKET (SHIFT PAGI & SORE)                  */}
      {/* ============================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border-2 border-blue-500/40 dark:border-blue-500/50 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                Penerima Rekapan Piket (Shift Pagi &amp; Sore)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Petugas Piket &amp; Shift
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
              <strong>Keterangan Penerima:</strong> Masukkan email manajemen (Manager, SPV, Admin Piket, PIC Area). Sistem akan mengirimkan dokumen <strong>PDF resmi rekapan piket ICONNET</strong> (Shift Pagi 08.00–16.30 WITA &amp; Shift Sore 16.30–08.00 WITA) yang mencakup checklist tugas, bukti foto lapangan, checklist inventaris, dan riwayat presensi.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 hidden sm:inline">
              {settings.isActive ? 'Otomatis Aktif' : 'Nonaktif'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer shrink-0" title="Aktifkan/Nonaktifkan Pengiriman Rekapan Piket">
              <input
                type="checkbox"
                checked={settings.isActive}
                onChange={(e) => setSettings({ ...settings, isActive: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Input Tambah Email Piket */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
              Daftar Alamat Email Penerima Rekapan Piket (PDF)
            </label>
            <span className="text-xs text-blue-700 dark:text-blue-300 font-semibold bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              {settings.recipients.length} Penerima Piket
            </span>
          </div>
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
              placeholder="Ketik email Manager / SPV Piket (contoh: spv.piket@iconnet.id)..."
              className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAddEmail}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah</span>
            </button>
          </div>

          {/* Chips Email Piket */}
          {settings.recipients.length === 0 ? (
            <div className="p-3.5 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 text-center text-xs text-gray-400 dark:text-slate-500">
              Belum ada email khusus rekapan piket yang didaftarkan. Masukkan email di atas untuk menerima laporan PDF piket.
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
      </div>

      {/* ============================================================== */}
      {/* 3. PERIODE & FREKUENSI REKAPAN PIKET (PDF)                    */}
      {/* ============================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Pilihan Periode &amp; Frekuensi Rekapan Piket (PDF)
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Tentukan jadwal pengiriman otomatis dokumen PDF rekapan piket ke email penerima piket di atas.
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
              placeholder="Magang ICONNET"
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

        {/* KARTU TEST KIRIM REKAPAN PIKET SEKARANG */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-850 p-4 rounded-2xl border border-blue-100 dark:border-slate-700 space-y-3">
          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Uji Coba Kirim PDF Rekapan Piket Sekarang
            </h4>
            <p className="text-[11px] text-gray-600 dark:text-slate-400 mt-0.5">
              Kirimkan dokumen PDF rekapan piket detik ini juga ke seluruh email penerima piket di atas untuk memastikan Brevo bekerja normal.
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
              <span>{sendingTest === 'mingguan' ? 'Mengirim PDF Piket...' : 'Kirim Rekap Piket Mingguan (PDF)'}</span>
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
              <span>{sendingTest === 'bulanan' ? 'Mengirim PDF Piket...' : 'Kirim Rekap Piket Bulanan (PDF)'}</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

