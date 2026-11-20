'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { parseCustomerBlock } from '@/lib/ticketing/parseCustomerBlock';
import { ticketInputSchema } from '@/lib/ticketing/validation';
import { TicketImageUploader } from '@/components/ticketing/ticket-image-uploader';
import type { CompressedImageResult } from '@/lib/ticketing/compressImage';
import type { Ticket } from '@/lib/ticketing/types';
import {
  X,
  ClipboardPaste,
  Sparkles,
  Ticket as TicketIcon,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ArrowRight,
  ArrowLeft,
  FileText,
  ImageIcon,
} from 'lucide-react';
import { showToast } from '@/lib/swal';
import { broadcastTicketChange } from '@/lib/ticketing/realtime';

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTicket: Ticket) => void;
  currentUser: { id: string; name: string } | null;
}

export function NewTicketModal({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
}: NewTicketModalProps) {
  // Wizard steps: 1 = Data Mentah, 2 = Form Input Manual, 3 = Upload Gambar Bukti
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [pasteInput, setPasteInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedImages, setSelectedImages] = useState<CompressedImageResult[]>([]);

  const [formData, setFormData] = useState({
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

  if (!isOpen) return null;

  const handleParse = (text: string) => {
    setPasteInput(text);
    if (!text.trim()) {
      setFormData({
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
      setFormErrors({});
      return;
    }

    const parsed = parseCustomerBlock(text);
    setFormData((prev) => ({
      ...prev,
      customer_id: parsed.customer_id || prev.customer_id,
      pln_id: parsed.pln_id || prev.pln_id,
      phone: parsed.phone || prev.phone,
      alt_phone: parsed.alt_phone || prev.alt_phone,
      name: parsed.name || prev.name,
      address: parsed.address || prev.address,
      email: parsed.email || prev.email,
      regional: parsed.regional || prev.regional,
      office: parsed.office || prev.office,
      complaint: parsed.complaint || prev.complaint,
    }));
    setFormErrors({});
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        showToast('Gunakan shortcut keyboard Ctrl+V di kotak teks.', 'info');
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        showToast('Clipboard masih kosong. Salin teks chat terlebih dahulu.', 'info');
        return;
      }
      handleParse(text);
      showToast('Teks mentah berhasil ditempel!', 'success');
    } catch {
      showToast('Gunakan shortcut keyboard Ctrl+V langsung di kotak teks.', 'info');
    }
  };

  const handleFillDemoData = () => {
    const demo = `ID Pelanggan
151000663039
ID PLN
551400201269
Telepon
+6281775447019
Nama
I NYOMAN MUDANA
Alamat
BANJAR SILADAN DESA TAMANBALI KEC BANGLI KAB BANGLI BALI
Email
mudana63@yahoo.com
Regional
BALI & NUSA TENGGARA
Kantor Perwakilan
BALI

Lampu indikator LOS berkedip merah sejak pagi hari, koneksi internet terputus.`;
    handleParse(demo);
  };

  const handleNextFromStep1 = () => {
    if (pasteInput.trim()) {
      handleParse(pasteInput);
    }
    setErrorMsg(null);
    setStep(2);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleNextFromStep2 = () => {
    setErrorMsg(null);
    setFormErrors({});

    const validation = ticketInputSchema.safeParse(formData);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        errors[path] = issue.message;
      });
      setFormErrors(errors);
      setErrorMsg('Mohon lengkapi kolom wajib: ID Pelanggan, Nama, dan Rincian Keluhan.');
      return;
    }

    setStep(3);
  };

  const handleSubmit = async () => {
    setErrorMsg(null);
    setLoading(true);

    try {
      const supabase = createClient();

      // 1. Simpan tiket baru
      const insertPayload: Record<string, unknown> = {
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
        status: 'queued' as const,
        mode: 'ai' as const,
        created_by: currentUser?.id || null,
        creator_name: currentUser?.name || null,
      };

      let { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert(insertPayload)
        .select('*')
        .single();

      // Fallback jika database Supabase belum menambahkan kolom alt_phone
      if (ticketError && ticketError.message?.includes('alt_phone')) {
        const fallbackComplaint = formData.alt_phone.trim()
          ? `${formData.complaint.trim()}\n\nCP Alt: ${formData.alt_phone.trim()}`
          : formData.complaint.trim();
        const fallbackPayload: Record<string, unknown> = { ...insertPayload, complaint: fallbackComplaint };
        delete fallbackPayload.alt_phone;

        const res = await supabase.from('tickets').insert(fallbackPayload).select('*').single();
        ticket = res.data;
        ticketError = res.error;
      }

      if (ticketError || !ticket) {
        throw new Error(ticketError?.message || 'Gagal menyimpan data tiket.');
      }

      // 2. Unggah foto keluhan jika ada
      if (selectedImages.length > 0) {
        for (let idx = 0; idx < selectedImages.length; idx++) {
          const item = selectedImages[idx];
          const ext = item.file.name.split('.').pop() || 'jpg';
          const fileName = `${ticket.id}/${Date.now()}_${idx + 1}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('ticket-images')
            .upload(fileName, item.file, {
              contentType: item.file.type,
              cacheControl: '3600',
              upsert: false,
            });

          if (!uploadError) {
            await supabase.from('ticket_images').insert({
              ticket_id: ticket.id,
              storage_path: fileName,
              mime: item.file.type,
              size_bytes: item.compressedSize,
            });
          }
        }
      }

      // 3. Catat riwayat di ticket_events
      await supabase.from('ticket_events').insert({
        ticket_id: ticket.id,
        event_type: 'created',
        title: 'Tiket Dibuat',
        description: `Tiket dibuat manual oleh ${currentUser?.name || 'Petugas'} dan dimasukkan ke antrean.`,
        created_by: currentUser?.id || null,
        creator_name: currentUser?.name || null,
      });

      // 4. Update antrean di ticket_settings
      try {
        const { data: currentQueue } = await supabase
          .from('ticket_settings')
          .select('value')
          .eq('key', 'queue_order')
          .single();

        let newOrder: string[] = [];
        if (currentQueue?.value && Array.isArray(currentQueue.value)) {
          newOrder = [...currentQueue.value, ticket.id];
        } else {
          newOrder = [ticket.id];
        }

        await supabase
          .from('ticket_settings')
          .upsert({ key: 'queue_order', value: newOrder, updated_at: new Date().toISOString() });
      } catch (queueErr) {
        console.warn('Could not update queue order:', queueErr);
      }

      // Siarkan penambahan tiket baru ke seluruh perangkat lain secara real-time
      await broadcastTicketChange(supabase, 'create', {
        ticketId: ticket.id,
        ticket,
      });

      showToast(`Tiket pelanggan ${ticket.name} berhasil dibuat!`, 'success');
      onSuccess(ticket as Ticket);
      handleResetAndClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setStep(1);
    setPasteInput('');
    setSelectedImages([]);
    setErrorMsg(null);
    setFormErrors({});
    setFormData({
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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 dark:bg-blue-950/80 rounded-xl text-blue-600 dark:text-blue-400">
              <TicketIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 leading-tight">
                Buat Tiket Keluhan Baru
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-slate-400">
                Alur cerdas 3 langkah: Data Mentah &bull; Input Terstruktur &bull; Bukti Foto
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            title="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* STEP PROGRESS WIZARD */}
        <div className="px-5 py-3 bg-gray-100/70 dark:bg-slate-800/50 border-b border-gray-200/60 dark:border-slate-700/60 grid grid-cols-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold transition text-left ${
              step === 1
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
              step === 1 ? 'bg-white text-blue-600' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
            }`}>
              1
            </span>
            <span className="truncate">Data Mentah</span>
          </button>

          <button
            type="button"
            onClick={handleNextFromStep1}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold transition text-left ${
              step === 2
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
              step === 2 ? 'bg-white text-blue-600' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
            }`}>
              2
            </span>
            <span className="truncate">Form Data</span>
          </button>

          <button
            type="button"
            onClick={handleNextFromStep2}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold transition text-left ${
              step === 3
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
              step === 3 ? 'bg-white text-blue-600' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
            }`}>
              3
            </span>
            <span className="truncate">Bukti Foto</span>
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ================= STEP 1: INPUT DATA MENTAH ================= */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ClipboardPaste className="h-4 w-4 text-blue-600" />
                  <span>Tempel Teks Mentah / Chat Pelanggan</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg transition"
                  >
                    <ClipboardPaste className="h-3 w-3" />
                    <span>Tempel Clipboard</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleFillDemoData}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg transition"
                  >
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    <span>Contoh Data</span>
                  </button>
                  {pasteInput && (
                    <button
                      type="button"
                      onClick={() => handleParse('')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                      title="Bersihkan Teks"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                rows={9}
                placeholder="Tempelkan chat keluhan pelanggan dari WhatsApp / Telegram / Email di sini...
Contoh format:
ID Pelanggan: 151000xxxxxx
Nama: Budi Santoso
Telepon: 081234567890
Alamat: Jl. Raya Denpasar No. 10
Kendala: Lampu LOS merah kedip-kedip, internet tidak bisa connect."
                className="w-full p-3.5 text-xs font-mono rounded-2xl border border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
              />

              <div className="p-3.5 bg-sky-50/70 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/60 rounded-2xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800 dark:text-sky-300">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Ekstraksi Otomatis:</span>
                </div>
                <p className="text-[11px] text-sky-700/90 dark:text-sky-300/80 leading-relaxed">
                  Saat menekan tombol <strong>Lanjut</strong>, sistem otomatis mendeteksi ID Pelanggan, No PLN, Nama, Telepon WhatsApp, Alamat, dan Keluhan ke kolom isian formulir langkah ke-2.
                </p>
              </div>
            </div>
          )}

          {/* ================= STEP 2: INPUT MANUAL TERSTRUKTUR ================= */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span>Periksa &amp; Lengkapi Data Tiket</span>
                </span>
                <span className="text-[11px] text-gray-400">
                  Kolom bertanda <span className="text-red-500">*</span> wajib diisi
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* ID Pelanggan */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    ID Pelanggan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="customer_id"
                    value={formData.customer_id}
                    onChange={handleChange}
                    placeholder="Contoh: 151000663039"
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${
                      formErrors.customer_id
                        ? 'border-red-500 focus:ring-red-500 bg-red-50/30'
                        : 'border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                    } text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono`}
                  />
                  {formErrors.customer_id && (
                    <p className="text-[10px] text-red-500 mt-0.5">{formErrors.customer_id}</p>
                  )}
                </div>

                {/* ID PLN */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    ID PLN (Opsional)
                  </label>
                  <input
                    type="text"
                    name="pln_id"
                    value={formData.pln_id}
                    onChange={handleChange}
                    placeholder="Contoh: 551400201269"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                {/* Nama Pelanggan */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Nama Pelanggan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Contoh: I Nyoman Mudana"
                    className={`w-full px-3 py-2 text-xs rounded-xl border ${
                      formErrors.name
                        ? 'border-red-500 focus:ring-red-500 bg-red-50/30'
                        : 'border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                    } text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                  />
                  {formErrors.name && (
                    <p className="text-[10px] text-red-500 mt-0.5">{formErrors.name}</p>
                  )}
                </div>

                {/* Nomor Telepon / WhatsApp */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    No. Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Contoh: 081234567890"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                {/* Telepon Alternatif */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    No. Telepon Alternatif (Opsional)
                  </label>
                  <input
                    type="text"
                    name="alt_phone"
                    value={formData.alt_phone}
                    onChange={handleChange}
                    placeholder="Contoh: 089876543210"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                {/* Email Pelanggan */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Email Pelanggan (Opsional)
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="pelanggan@email.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Regional */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Regional (Opsional)
                  </label>
                  <input
                    type="text"
                    name="regional"
                    value={formData.regional}
                    onChange={handleChange}
                    placeholder="BALI & NUSA TENGGARA"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Kantor Perwakilan */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Kantor Perwakilan (Opsional)
                  </label>
                  <input
                    type="text"
                    name="office"
                    value={formData.office}
                    onChange={handleChange}
                    placeholder="BALI"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Alamat Lengkap */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Alamat Lengkap Pelanggan
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Nama jalan, banjar, kelurahan, kecamatan, kabupaten/kota..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              {/* Rincian Keluhan / Kendala */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Rincian Keluhan / Kendala <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="complaint"
                  value={formData.complaint}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Jelaskan kendala koneksi, indikator lampu modem (LOS/PON), atau keluhan pelanggan..."
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${
                    formErrors.complaint
                      ? 'border-red-500 focus:ring-red-500 bg-red-50/30'
                      : 'border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                  } text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed`}
                />
                {formErrors.complaint && (
                  <p className="text-[10px] text-red-500 mt-0.5">{formErrors.complaint}</p>
                )}
              </div>
            </div>
          )}

          {/* ================= STEP 3: INPUT BUKTI FOTO ================= */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-blue-600" />
                  <span>Lampirkan Foto Bukti / Screenshot Keluhan</span>
                </span>
                <span className="text-[11px] text-gray-400">
                  Opsional (Maksimal 6 foto)
                </span>
              </div>

              {/* Uploader Komponen */}
              <div className="bg-gray-50/60 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-gray-200 dark:border-slate-700">
                <TicketImageUploader
                  images={selectedImages}
                  onChange={setSelectedImages}
                  maxFiles={6}
                />
              </div>

              {/* Ringkasan Tiket Singkat Sebelum Dibuat */}
              <div className="p-3.5 bg-gray-50 dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-2 text-xs">
                <span className="font-bold text-gray-700 dark:text-slate-300 block">
                  Ringkasan Tiket yang Akan Dibuat:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-gray-400 block">Pelanggan:</span>
                    <span className="font-bold text-gray-900 dark:text-slate-100">
                      {formData.name || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">ID Pelanggan:</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {formData.customer_id || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Telepon / WA:</span>
                    <span className="font-mono text-gray-700 dark:text-slate-300">
                      {formData.phone || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Status Awal:</span>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Dalam Antrean
                    </span>
                  </div>
                </div>
                <div className="pt-1 border-t border-gray-200/80 dark:border-slate-700/80">
                  <span className="text-gray-400 block text-[10px]">Kendala:</span>
                  <p className="text-gray-700 dark:text-slate-300 line-clamp-2 text-[11px] mt-0.5">
                    {formData.complaint || '-'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3.5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/60 flex items-center justify-between gap-3 shrink-0">
          <div>
            {step === 1 ? (
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl transition"
              >
                Batal
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev === 3 ? 2 : 1))}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition disabled:opacity-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Kembali</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 1 && (
              <button
                type="button"
                onClick={handleNextFromStep1}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <span>Lanjut ke Form Input</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleNextFromStep2}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <span>Lanjut ke Upload Foto</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Menyimpan Tiket...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Selesai &amp; Buat Tiket</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
