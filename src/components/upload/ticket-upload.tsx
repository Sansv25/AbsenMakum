'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, ArrowUp, ArrowDown, Clipboard, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { compressImage } from '@/lib/image';
import { createClient } from '@/lib/supabase/client';
import { showAlert, showConfirm, showToast } from '@/lib/swal';
import type { AttachmentWithUrl } from '@/lib/data/attendance';
import type { ShiftType } from '@/lib/supabase/types';

interface TicketUploadProps {
  attendanceId: string;
  userId: string;
  workDate: string;
  shiftType: ShiftType;
  initialAttachments: AttachmentWithUrl[];
  onSaved: () => void;
  canEdit?: boolean;
}

export function TicketUpload({
  attendanceId,
  userId,
  workDate,
  shiftType,
  initialAttachments,
  onSaved,
  canEdit = true,
}: TicketUploadProps) {
  const [tickets, setTickets] = useState<AttachmentWithUrl[]>(
    initialAttachments.sort((a, b) => a.sort_order - b.sort_order)
  );
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Global Paste (Ctrl+V) listener
  useEffect(() => {
    if (!canEdit) return;

    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            handleUploadFiles([file]);
            break;
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, attendanceId, userId, workDate, shiftType, canEdit]);

  async function handleUploadFiles(files: File[]) {
    if (files.length === 0) return;
    try {
      setUploading(true);
      setStatusMsg('Mengompres dan mengunggah ticket...');

      const supabase = createClient();
      let currentOrder = tickets.length;
      const newItems: AttachmentWithUrl[] = [];

      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;

        const compressed = await compressImage(file);
        const uuid = crypto.randomUUID();
        const storagePath = `${userId}/${workDate}/${shiftType}/ticket-${uuid}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('evidence')
          .upload(storagePath, compressed, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw new Error(uploadError.message);

        const { data: inserted, error: dbError } = await supabase
          .from('attachments')
          .insert({
            attendance_id: attendanceId,
            user_id: userId,
            kind: 'ticket',
            storage_path: storagePath,
            sort_order: currentOrder++,
          })
          .select()
          .single();

        if (dbError) throw new Error(dbError.message);

        const { data: signed } = await supabase.storage
          .from('evidence')
          .createSignedUrl(storagePath, 3600);

        newItems.push({
          ...inserted,
          signedUrl: signed?.signedUrl ?? null,
        });
      }

      setTickets((prev) => [...prev, ...newItems]);
      setStatusMsg('Tersimpan');
      showToast('Screenshot tiket berhasil disimpan', 'success');
      setTimeout(() => setStatusMsg(null), 3000);
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunggah gambar tiket.';
      showAlert('Gagal Unggah', msg, 'error');
      setStatusMsg(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(ticket: AttachmentWithUrl) {
    const confirmed = await showConfirm(
      'Hapus Screenshot Tiket?',
      'Apakah Anda yakin ingin menghapus screenshot tiket ini?',
      'Ya, Hapus',
      true
    );
    if (!confirmed) return;

    try {
      const supabase = createClient();
      await supabase.storage.from('evidence').remove([ticket.storage_path]);
      await supabase.from('attachments').delete().eq('id', ticket.id);

      const remaining = tickets.filter((t) => t.id !== ticket.id);
      setTickets(remaining);
      showToast('Screenshot tiket dihapus', 'info');
      onSaved();
    } catch {
      showAlert('Gagal', 'Terjadi kesalahan saat menghapus screenshot tiket.', 'error');
    }
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tickets.length) return;

    const updated = [...tickets];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;

    // Update sort_order values
    const reordered = updated.map((item, idx) => ({
      ...item,
      sort_order: idx,
    }));
    setTickets(reordered);

    // Save to DB
    const supabase = createClient();
    for (const item of reordered) {
      await supabase
        .from('attachments')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            Picket Ticket
            <span className="text-xs text-gray-400 font-normal">
              ({tickets.length} screenshot)
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Screenshot tiket piket (opsional). Anda bisa paste langsung dengan <strong>Ctrl+V</strong>.
          </p>
        </div>
        {statusMsg && (
          <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            {statusMsg}
          </span>
        )}
      </div>

      {tickets.length === 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>Belum ada screenshot tiket piket. (Shift tetap dapat berstatus lengkap jika Mulai & Selesai ada).</span>
        </div>
      )}

      {/* Drag & Drop Zone */}
      {canEdit ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const files = Array.from(e.dataTransfer.files);
            handleUploadFiles(files);
          }}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
            isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <Clipboard className="h-8 w-8 text-blue-500" />
            <p className="text-xs font-medium text-gray-800">
              Tarik & lepas file di sini, atau tekan <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Ctrl+V</kbd> untuk paste screenshot
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="mt-2 py-2 px-4 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-xl transition-colors min-h-[44px] flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Pilih File Gambar
            </button>
          </div>
        </div>
      ) : null}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) {
            handleUploadFiles(files);
            e.target.value = '';
          }
        }}
      />

      {/* List of uploaded tickets */}
      {tickets.length > 0 && (
        <div className="space-y-3 pt-2">
          {tickets.map((ticket, index) => (
            <div
              key={ticket.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50"
            >
              <span className="text-xs font-bold text-gray-400 w-5 text-center">
                #{index + 1}
              </span>

              <div className="w-16 h-12 rounded-lg overflow-hidden bg-black/10 flex-shrink-0 relative">
                {ticket.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ticket.signedUrl}
                    alt={`Tiket #${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                    Foto
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">
                  Ticket #{index + 1}
                </p>
                <p className="text-[10px] text-gray-400">
                  {new Date(ticket.created_at).toLocaleTimeString('id-ID')} WITA
                </p>
              </div>

              {canEdit && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                    className="p-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-30 rounded-lg min-h-[44px] min-w-[36px] flex items-center justify-center"
                    aria-label="Pindah ke Atas"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === tickets.length - 1}
                    className="p-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-30 rounded-lg min-h-[44px] min-w-[36px] flex items-center justify-center"
                    aria-label="Pindah ke Bawah"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(ticket)}
                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg min-h-[44px] min-w-[36px] flex items-center justify-center"
                    aria-label="Hapus Tiket"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
