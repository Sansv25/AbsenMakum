'use client';

import { useState, useEffect, useRef } from 'react';
import { saveNoteAction } from '@/app/(app)/absen/[date]/[shift]/actions';
import { Loader2, CheckCircle2, Lock } from 'lucide-react';

interface NoteAutosaveProps {
  attendanceId: string;
  initialNote: string | null;
  canEdit?: boolean;
  deviceId?: string;
  deviceInfo?: string;
}

export function NoteAutosave({
  attendanceId,
  initialNote,
  canEdit = true,
  deviceId,
  deviceInfo,
}: NoteAutosaveProps) {
  const [note, setNote] = useState(initialNote ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setNote(initialNote ?? '');
  }, [initialNote, attendanceId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleChange(val: string) {
    if (!canEdit) return;
    setNote(val);
    setSaved(false);

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setSaving(true);
      await saveNoteAction(attendanceId, val, deviceId, deviceInfo);
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 1000);
  }

  async function handleBlur() {
    if (!canEdit) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaving(true);
    await saveNoteAction(attendanceId, note, deviceId, deviceInfo);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="attendance-note" className="font-semibold text-gray-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
          Catatan Piket (Opsional)
          {!canEdit && (
            <span className="text-[11px] font-normal text-gray-400 dark:text-slate-500 flex items-center gap-1">
              <Lock className="h-3 w-3" /> (Hanya Lihat)
            </span>
          )}
        </label>
        <div className="text-xs flex items-center gap-1 min-h-[20px]">
          {saving && (
            <span className="text-gray-400 dark:text-slate-400 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Menyimpan...
            </span>
          )}
          {saved && (
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="h-3 w-3" /> Tersimpan
            </span>
          )}
        </div>
      </div>
      <textarea
        id="attendance-note"
        rows={3}
        value={note}
        readOnly={!canEdit}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={canEdit ? "Tuliskan catatan kondisi, insiden, atau informasi tambahan selama piket..." : "Tidak ada catatan piket."}
        className={`w-full p-3 border rounded-xl text-sm transition-shadow ${
          canEdit
            ? 'border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500'
            : 'border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300 cursor-default'
        }`}
      />
    </div>
  );
}
