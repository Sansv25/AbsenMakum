'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { parseCustomerBlock } from '@/lib/ticketing/parseCustomerBlock';
import { ticketInputSchema } from '@/lib/ticketing/validation';
import { TicketImageUploader } from '@/components/ticketing/ticket-image-uploader';
import type { CompressedImageResult } from '@/lib/ticketing/compressImage';
import {
  ArrowLeft,
  ClipboardPaste,
  Sparkles,
  Ticket,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  Trash2,
} from 'lucide-react';
import { showToast } from '@/lib/swal';

export default function NewTicketPage() {
  const router = useRouter();

  const [pasteInput, setPasteInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedImages, setSelectedImages] = useState<CompressedImageResult[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

  const [formData, setFormData] = useState({
    customer_id: '',
    pln_id: '',
    phone: '',
    name: '',
    address: '',
    email: '',
    regional: '',
    office: '',
    complaint: '',
  });

  // Ambil info akun yang sedang login untuk dicatat sebagai pembuat tiket
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        supabase
          .from('profiles')
          .select('id, full_name, email, role, roles')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => {
            const displayName = profile?.full_name?.trim() || data.user.email?.split('@')[0] || 'Petugas';
            setCurrentUser({ id: data.user.id, name: displayName });
          });
      }
    });
  }, []);

  const handleParse = (text: string) => {
    setPasteInput(text);
    if (!text.trim()) {
      setFormData({
        customer_id: '',
        pln_id: '',
        phone: '',
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
    setFormData({
      customer_id: parsed.customer_id || '',
      pln_id: parsed.pln_id || '',
      phone: parsed.phone || '',
      name: parsed.name || '',
      address: parsed.address || '',
      email: parsed.email || '',
      regional: parsed.regional || '',
      office: parsed.office || '',
      complaint: parsed.complaint || '',
    });
    setFormErrors({});
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

Lampu indikator LOS berkedip merah sejak pagi hari, internet tidak bisa digunakan.`;
    handleParse(demo);
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        showToast('Browser tidak mendukung akses clipboard otomatis. Silakan gunakan Ctrl+V.', 'info');
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        showToast('Clipboard masih kosong. Silakan salin (copy) teks keluhan terlebih dahulu.', 'info');
        return;
      }
      handleParse(text);
      showToast('Teks berhasil ditempel dari clipboard!', 'success');
    } catch (err) {
      console.warn('Clipboard read error:', err);
      showToast('Gagal membaca clipboard. Izinkan izin clipboard browser atau tekan Ctrl+V di kotak teks.', 'info');
    }
  };

  const handleClearPaste = () => {
    handleParse('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setErrorMsg('Mohon lengkapi kolom yang wajib diisi (ID Pelanggan, Nama, Keluhan).');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // 1. Simpan tiket baru
      const insertPayload = {
        customer_id: formData.customer_id.trim(),
        pln_id: formData.pln_id.trim() || null,
        phone: formData.phone.trim() || null,
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

      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert(insertPayload)
        .select('id')
        .single();

      if (ticketError) {
        throw new Error(ticketError.message);
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

      showToast('Tiket keluhan berhasil dibuat dan masuk antrean!', 'success');
      router.push(`/ticketing/${ticket.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat tiket.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header & Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/ticketing"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition"
            title="Kembali ke Daftar Tiket"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Ticket className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Buat Tiket Keluhan Baru
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Tempel teks data pelanggan untuk mengisi formulir otomatis, lalu lampirkan foto keluhan.
            </p>
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 self-start sm:self-center">
            <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Pencatat: <strong>{currentUser.name}</strong></span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-center gap-2.5 text-xs text-rose-900 dark:text-rose-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid: Kiri Smart Paste, Kanan Form Fields */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kolom Kiri: Smart Paste Box */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                  <ClipboardPaste className="h-4 w-4 text-sky-500" />
                  <span>Tempel Blok Teks Pelanggan</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                    title="Tempel teks langsung dari clipboard"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    <span>Paste Teks</span>
                  </button>
                  {pasteInput && (
                    <button
                      type="button"
                      onClick={handleClearPaste}
                      className="p-1 rounded-lg text-gray-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 transition cursor-pointer"
                      title="Bersihkan teks"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleFillDemoData}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 ml-0.5 cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Contoh</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={pasteInput}
                  onChange={(e) => handleParse(e.target.value)}
                  rows={11}
                  placeholder={`Contoh:\nID Pelanggan\n151000663039\nID PLN\n551400201269\nTelepon\n+6281775447019\nNama\nI NYOMAN MUDANA\nAlamat\nBANJAR SILADAN DESA TAMANBALI\n\nKeluhan: Lampu LOS berkedip merah...`}
                  className="w-full p-3 rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800 text-xs font-mono text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition leading-relaxed pb-10"
                />
                {!pasteInput && (
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20 backdrop-blur-xs transition hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    <span>Paste dari Clipboard</span>
                  </button>
                )}
              </div>

              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl text-[11px] text-blue-800 dark:text-blue-300 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Parser Otomatis Aktif
                </span>
                <p className="text-gray-500 dark:text-slate-400 text-[10px]">
                  Teks yang ditempel langsung mengekstrak nomor ID, nama, kontak, dan keluhan ke formulir di sebelah kanan.
                </p>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Detail Formulir */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100 border-b border-gray-100 dark:border-slate-800 pb-2.5">
                Konfirmasi Data Pelanggan
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    ID Pelanggan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="customer_id"
                    required
                    value={formData.customer_id}
                    onChange={handleChange}
                    placeholder="Contoh: 151000663039"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  />
                  {formErrors.customer_id && (
                    <span className="text-[10px] text-rose-500 mt-0.5 block">{formErrors.customer_id}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Nama Pelanggan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Contoh: I NYOMAN MUDANA"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  />
                  {formErrors.name && (
                    <span className="text-[10px] text-rose-500 mt-0.5 block">{formErrors.name}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    ID PLN / No. Meter
                  </label>
                  <input
                    type="text"
                    name="pln_id"
                    value={formData.pln_id}
                    onChange={handleChange}
                    placeholder="Contoh: 551400201269"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    No. Telepon / WhatsApp
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Contoh: +6281775447019"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Email Pelanggan
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="mudana63@yahoo.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Regional / Kantor
                  </label>
                  <input
                    type="text"
                    name="regional"
                    value={formData.regional}
                    onChange={handleChange}
                    placeholder="BALI & NUSA TENGGARA"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Alamat Instalasi
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="BANJAR SILADAN DESA TAMANBALI KEC BANGLI"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Keluhan Gangguan <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    name="complaint"
                    required
                    rows={3}
                    value={formData.complaint}
                    onChange={handleChange}
                    placeholder="Jelaskan kendala: lampu LOS merah, internet putus, dll."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  />
                  {formErrors.complaint && (
                    <span className="text-[10px] text-rose-500 mt-0.5 block">{formErrors.complaint}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section Upload Foto Keluhan */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
          <TicketImageUploader
            images={selectedImages}
            onChange={setSelectedImages}
            maxFiles={6}
          />
        </div>

        {/* Action Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/ticketing"
            className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-semibold transition"
          >
            Batal
          </Link>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold transition shadow-xs flex items-center gap-2 min-h-[42px]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Menyimpan Tiket...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Simpan Tiket &amp; Masuk Antrean</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
