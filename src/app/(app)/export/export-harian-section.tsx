'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Printer,
  ExternalLink,
  Mail,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { formatIndonesia, todayWITA } from '@/lib/dates';
import { showAlert, showConfirm } from '@/lib/swal';
import { sendDailyRecapNowAction } from '@/app/(app)/pengaturan/rekapan/actions';
import { getDailyExportData } from './actions';
import type { DailyAttendanceRecapResult } from '@/lib/data/daily-attendance-recap';

interface ExportHarianSectionProps {
  initialDate: string;
  initialRecap: DailyAttendanceRecapResult;
  isMaster: boolean;
  emailRecipientsCount: number;
}

export function ExportHarianSection({
  initialDate,
  initialRecap,
  isMaster,
  emailRecipientsCount,
}: ExportHarianSectionProps) {
  const [currentDate, setCurrentDate] = useState<string>(initialDate);
  const [recap, setRecap] = useState<DailyAttendanceRecapResult>(initialRecap);
  const [loading, setLoading] = useState<boolean>(false);
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);

  const today = todayWITA();
  const isToday = currentDate === today;

  async function loadDateData(dateStr: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    try {
      setLoading(true);
      setCurrentDate(dateStr);
      const res = await getDailyExportData(dateStr);
      setRecap(res);
    } catch {
      showAlert('Gagal', 'Terjadi kesalahan saat memuat rekapan tanggal tersebut.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function changeDate(deltaDays: number) {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() + deltaDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const newDateStr = `${y}-${m}-${day}`;
    loadDateData(newDateStr);
  }

  async function handleSendEmail() {
    const confirmed = await showConfirm(
      'Kirim Rekapan Magang via Email?',
      `Laporan kehadiran anak magang tanggal ${formatIndonesia(currentDate)} akan dikirimkan ke ${emailRecipientsCount} alamat email penerima.`,
      'Ya, Kirim Sekarang'
    );
    if (!confirmed) return;

    try {
      setSendingEmail(true);
      const res = await sendDailyRecapNowAction(currentDate);
      if (res?.error) {
        showAlert('Gagal Mengirim Email', res.error, 'error');
      } else {
        showAlert(
          'Email Rekapan Terkirim!',
          `Laporan absensi harian (${recap.totalHadir} hadir, ${recap.totalTidakHadir} belum hadir) berhasil dikirim via Brevo API ke ${emailRecipientsCount} email tujuan.`,
          'success'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      showAlert('Gagal Mengirim', msg, 'error');
    } finally {
      setSendingEmail(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const presentRecords = recap.records.filter((r) => r.isHadir);
  const absentRecords = recap.records.filter((r) => !r.isHadir);

  return (
    <div className="space-y-6">
      {/* 1. KARTU KONTROL REKAP HARIAN (Non-Printable on paper) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-gray-100 dark:border-slate-800 shadow-sm space-y-5 no-print transition-colors">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex-shrink-0">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm sm:text-base">
                Rekap Kehadiran Harian Anak Magang
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Absen Harian
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Pantau dan cetak laporan presensi siapa saja anak magang yang Hadir dan Belum Hadir.
            </p>
          </div>
        </div>

        {/* Date Selector & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Navigasi Tanggal */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changeDate(-1)}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-800/60 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 transition"
              title="Hari Sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="relative">
              <input
                type="date"
                value={currentDate}
                onChange={(e) => loadDateData(e.target.value)}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer min-h-[38px]"
              />
            </div>

            <button
              type="button"
              onClick={() => changeDate(1)}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-800/60 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 transition"
              title="Hari Berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {!isToday && (
              <button
                type="button"
                onClick={() => loadDateData(today)}
                disabled={loading}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition whitespace-nowrap min-h-[38px]"
              >
                Hari Ini
              </button>
            )}

            {loading && <Loader2 className="h-4 w-4 animate-spin text-emerald-600 ml-1" />}
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Tombol Cetak Langsung / Simpan PDF */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
              title="Cetak Laporan / Simpan PDF lewat Browser"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Cetak / Simpan PDF</span>
            </button>

            {/* Tombol Buka Halaman Rekap Lengkap */}
            <Link
              href={`/rekap-harian?date=${currentDate}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition shadow-2xs"
              title="Buka Halaman Rekap Harian Lengkap"
            >
              <ExternalLink className="h-3.5 w-3.5 text-blue-500" />
              <span>Rekap Detail</span>
            </Link>

            {/* Tombol Kirim Email */}
            {isMaster && emailRecipientsCount > 0 && (
              <button
                type="button"
                disabled={sendingEmail || loading}
                onClick={handleSendEmail}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition"
                title="Kirimkan rekapan magang ini ke email sekarang"
              >
                {sendingEmail ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                ) : (
                  <Mail className="h-3.5 w-3.5 text-blue-600" />
                )}
                <span>Kirim Email</span>
              </button>
            )}
          </div>
        </div>

        {/* Ringkasan Statistik Status */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl p-3 text-center">
            <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">Total Magang</p>
            <p className="text-xl sm:text-2xl font-black text-blue-900 dark:text-blue-100 mt-0.5">
              {recap.totalInterns}
            </p>
          </div>

          <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-3 text-center">
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Hadir</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-0.5">
              {recap.totalHadir}{' '}
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ({recap.persentaseHadir}%)
              </span>
            </p>
          </div>

          <div className="bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3 text-center">
            <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">Belum Hadir</p>
            <p className="text-xl sm:text-2xl font-black text-rose-900 dark:text-rose-100 mt-0.5">
              {recap.totalTidakHadir}
            </p>
          </div>
        </div>
      </div>

      {/* 2. DOKUMEN REKAPITULASI PRINT-READY (Tampil saat preview layar & dicetak ke PDF/kertas) */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-sm space-y-6">
        {/* Header Dokumen Rekap */}
        <div className="border-b-2 border-gray-900 dark:border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                ICONNET BALI &amp; NUSA TENGGARA
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-gray-900 dark:text-slate-100 mt-0.5">
              Laporan Kehadiran Harian Anak Magang
            </h2>
            <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
              Tanggal:{' '}
              <strong className="text-gray-900 dark:text-slate-100">
                {formatIndonesia(currentDate)}
              </strong>{' '}
              • Waktu Rekap: {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' })} WITA
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right sm:text-right">
              <span className="text-[11px] text-gray-500 dark:text-slate-400 block font-medium">
                Tingkat Kehadiran
              </span>
              <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                {recap.totalHadir} / {recap.totalInterns} ({recap.persentaseHadir}%)
              </span>
            </div>
          </div>
        </div>

        {/* 1. DAFTAR ANAK MAGANG HADIR */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              1. Daftar Anak Magang Hadir ({presentRecords.length})
            </h4>
          </div>

          {presentRecords.length === 0 ? (
            <div className="text-center py-6 px-4 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 text-xs text-gray-500">
              Belum ada anak magang yang tercatat hadir pada tanggal ini.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100/80 dark:bg-slate-800/80 text-gray-700 dark:text-slate-300 font-semibold border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">NO</th>
                    <th className="py-2.5 px-3">NAMA ANAK MAGANG</th>
                    <th className="py-2.5 px-3 w-28 text-center">STATUS</th>
                    <th className="py-2.5 px-3 w-28 text-center">WAKTU (WITA)</th>
                    <th className="py-2.5 px-3">METODE ABSEN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-800 dark:text-slate-200">
                  {presentRecords.map((rec, idx) => (
                    <tr key={rec.user.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-center text-gray-500 font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-slate-100">
                        {rec.user.full_name || rec.user.email}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          ✓ Hadir
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium">
                        {rec.attendanceTime || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-slate-400">
                        {rec.methodLabel || 'Absen Harian'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 2. DAFTAR ANAK MAGANG TIDAK HADIR / BELUM ABSEN */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
              2. Daftar Anak Magang Belum Hadir ({absentRecords.length})
            </h4>
          </div>

          {absentRecords.length === 0 ? (
            <div className="text-center py-4 px-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
              🎉 Luar biasa! Seluruh anak magang ({recap.totalInterns} orang) hadir lengkap pada hari ini.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100/80 dark:bg-slate-800/80 text-gray-700 dark:text-slate-300 font-semibold border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">NO</th>
                    <th className="py-2.5 px-3">NAMA ANAK MAGANG</th>
                    <th className="py-2.5 px-3 w-32 text-center">STATUS</th>
                    <th className="py-2.5 px-3">KETERANGAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-800 dark:text-slate-200">
                  {absentRecords.map((rec, idx) => (
                    <tr key={rec.user.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-center text-gray-500 font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-slate-100">
                        {rec.user.full_name || rec.user.email}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                          Belum Hadir
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 dark:text-slate-400 italic">
                        Tidak ada catatan presensi hingga jam rekap
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Cetak Catatan */}
        <div className="pt-4 border-t border-gray-200 dark:border-slate-800 text-[11px] text-gray-400 dark:text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} ICONNET • Sistem Absensi &amp; Rekapitulasi Magang</p>
          <p>Dokumen ini digenerate secara otomatis melalui aplikasi Absen ICONNET.</p>
        </div>
      </div>
    </div>
  );
}
