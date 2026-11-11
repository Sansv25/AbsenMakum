'use client';

import { useState } from 'react';
import { addHolidayAction, deleteHolidayAction } from './actions';
import { formatIndonesia } from '@/lib/dates';
import { showAlert, showConfirm, showToast } from '@/lib/swal';
import type { Holiday } from '@/lib/supabase/types';
import { Trash2, Plus, CalendarOff, Loader2 } from 'lucide-react';

interface HolidayManagerProps {
  initialHolidays: Holiday[];
  currentYear: number;
}

export function HolidayManager({ initialHolidays, currentYear }: HolidayManagerProps) {
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredHolidays = initialHolidays.filter((h) =>
    h.holiday_date.startsWith(`${selectedYear}-`)
  );

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const res = await addHolidayAction(formData);

    if (res.error) {
      setError(res.error);
    } else {
      form.reset();
    }
    setLoading(false);
  }

  async function handleDelete(id: string, name: string) {
    const confirmed = await showConfirm(
      'Hapus Tanggal Merah?',
      `Apakah Anda yakin ingin menghapus "${name}"?`,
      'Ya, Hapus',
      true
    );
    if (!confirmed) return;

    setDeletingId(id);
    const res = await deleteHolidayAction(id);
    if (res.error) {
      showAlert('Gagal', res.error, 'error');
    } else {
      showToast(`Tanggal merah "${name}" berhasil dihapus`, 'info');
    }
    setDeletingId(null);
  }

  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-6">
      {/* Form Tambah Tanggal Merah */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Plus className="h-5 w-5 text-blue-600" />
          Tambah Tanggal Merah
        </h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="holiday_date" className="block text-xs font-medium text-gray-700 mb-1">
                Tanggal
              </label>
              <input
                id="holiday_date"
                name="holiday_date"
                type="date"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">
                Keterangan / Nama Libur
              </label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Contoh: Hari Kemerdekaan RI"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-xs bg-red-50 p-2 rounded-lg border border-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full md:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl text-sm transition-colors min-h-[44px] flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Simpan Tanggal Merah
          </button>
        </form>
      </div>

      {/* Filter Tahun */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Daftar Tanggal Merah</h2>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${
                selectedYear === y
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Daftar Tanggal Merah */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
        {filteredHolidays.length === 0 ? (
          <div className="p-8 text-center">
            <CalendarOff className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Belum ada tanggal merah</p>
            <p className="text-xs text-gray-400 mt-1">
              Tambahkan tanggal merah tahun {selectedYear} melalui formulir di atas.
            </p>
          </div>
        ) : (
          filteredHolidays.map((holiday) => (
            <div
              key={holiday.id}
              className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="font-semibold text-gray-900 text-sm">{holiday.name}</p>
                <p className="text-xs text-red-600 font-medium mt-0.5">
                  {formatIndonesia(holiday.holiday_date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(holiday.id, holiday.name)}
                disabled={deletingId === holiday.id}
                className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Hapus"
              >
                {deletingId === holiday.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
