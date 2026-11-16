'use client';

import { useState, useEffect } from 'react';
import type { Ticket, TicketStatus, TicketMode } from '@/lib/ticketing/types';
import { X, Save, Loader2, Edit3, Hash, ShieldAlert } from 'lucide-react';

interface TicketEditModalProps {
  isOpen: boolean;
  ticket: Ticket | null;
  onClose: () => void;
  onSuccess: (updated: Ticket) => void;
}

export function TicketEditModal({
  isOpen,
  ticket,
  onClose,
  onSuccess,
}: TicketEditModalProps) {
  const [formData, setFormData] = useState({
    ticket_number: '',
    status: 'queued' as TicketStatus,
    mode: 'ai' as TicketMode,
    customer_id: '',
    pln_id: '',
    phone: '',
    alt_phone: '',
    name: '',
    address: '',
    email: '',
    regional: '',
    office: '',
    complaint: '',
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (ticket) {
      setFormData({
        ticket_number: ticket.ticket_number || '',
        status: ticket.status || 'queued',
        mode: ticket.mode || 'ai',
        customer_id: ticket.customer_id || '',
        pln_id: ticket.pln_id || '',
        phone: ticket.phone || '',
        alt_phone: ticket.alt_phone || '',
        name: ticket.name || '',
        address: ticket.address || '',
        email: ticket.email || '',
        regional: ticket.regional || '',
        office: ticket.office || '',
        complaint: ticket.complaint || '',
      });
      setErrorMsg(null);
    }
  }, [ticket, isOpen]);

  if (!isOpen || !ticket) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.customer_id.trim()) {
      setErrorMsg('Nama Pelanggan dan ID Pelanggan wajib diisi.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/ticketing/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_number: formData.ticket_number.trim() || null,
          status: formData.status,
          mode: formData.mode,
          customer_id: formData.customer_id.trim(),
          pln_id: formData.pln_id.trim() || null,
          phone: formData.phone.trim() || null,
          alt_phone: formData.alt_phone.trim() || null,
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          email: formData.email.trim() || null,
          regional: formData.regional.trim() || null,
          office: formData.office.trim() || null,
          complaint: formData.complaint.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan pembaruan tiket.');
      }

      onSuccess(data.ticket);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Tiket &amp; Output ICONNET
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ubah informasi pelanggan atau koreksi nomor tiket resmi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Special Section: Output / Nomor Tiket Resmi */}
          <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border-2 border-emerald-300 dark:border-emerald-800 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              <label className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                Nomor Tiket Resmi / Output ICONNET (Koreksi Output)
              </label>
            </div>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-400">
              Ubah atau masukkan kode tiket resmi jika salah terdeteksi atau baru terbit dari CS:
            </p>
            <input
              type="text"
              name="ticket_number"
              value={formData.ticket_number}
              onChange={handleChange}
              placeholder="Contoh: R2J94RHH atau Belum Bayar"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-emerald-100 focus:ring-2 focus:ring-emerald-500 uppercase tracking-wider"
            />
          </div>

          {/* Status & Mode Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Status Tiket
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500"
              >
                <option value="queued">Antrean (queued)</option>
                <option value="in_conversation">Sedang Berjalan (in_conversation)</option>
                <option value="needs_admin">Butuh Admin (needs_admin)</option>
                <option value="ticket_issued">Tiket Terbit (ticket_issued)</option>
                <option value="closed">Selesai (closed)</option>
                <option value="failed">Gagal (failed)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mode Penanganan
              </label>
              <select
                name="mode"
                value={formData.mode}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500"
              >
                <option value="ai">AI Otomatis (Dijawab Bot)</option>
                <option value="manual">Manual (Admin Balas di HP)</option>
              </select>
            </div>
          </div>

          {/* Customer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Pelanggan *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                ID Pelanggan *
              </label>
              <input
                type="text"
                name="customer_id"
                value={formData.customer_id}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ID PLN
              </label>
              <input
                type="text"
                name="pln_id"
                value={formData.pln_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                No. Telepon / WA
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                No. Telepon / CP Alternatif
              </label>
              <input
                type="text"
                name="alt_phone"
                value={formData.alt_phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Regional
              </label>
              <input
                type="text"
                name="regional"
                value={formData.regional}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kantor Perwakilan
              </label>
              <input
                type="text"
                name="office"
                value={formData.office}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Alamat Instalasi
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Keluhan Gangguan
            </label>
            <textarea
              name="complaint"
              value={formData.complaint}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
