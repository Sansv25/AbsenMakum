'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft,
  Bot,
  Sliders,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Shield,
  Layers,
} from 'lucide-react';

export default function TicketingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Settings state
  const [prompt, setPrompt] = useState('');
  const [maxTurns, setMaxTurns] = useState(12);
  const [closingGreeting, setClosingGreeting] = useState('');
  const [autoQueueEnabled, setAutoQueueEnabled] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const supabase = createClient();
        const { data, error } = await supabase.from('ticketing_settings').select('*');

        if (error) throw new Error(error.message);

        if (data) {
          data.forEach((s) => {
            if (s.key === 'ai_system_prompt') {
              setPrompt(typeof s.value === 'string' ? s.value : JSON.stringify(s.value, null, 2).replace(/^"|"$/g, ''));
            } else if (s.key === 'max_ai_turns') {
              setMaxTurns(Number(s.value) || 12);
            } else if (s.key === 'closing_greeting_template') {
              setClosingGreeting(typeof s.value === 'string' ? s.value : JSON.stringify(s.value).replace(/^"|"$/g, ''));
            } else if (s.key === 'auto_queue_enabled') {
              setAutoQueueEnabled(Boolean(s.value));
            } else if (s.key === 'ai_auto_enabled') {
              setAiEnabled(Boolean(s.value));
            } else if (s.key === 'ai_monitoring_enabled') {
              setMonitoringEnabled(Boolean(s.value));
            }
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal memuat pengaturan';
        setErrorMsg(msg);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      const supabase = createClient();

      const updates = [
        { key: 'ai_system_prompt', value: prompt, updated_at: new Date().toISOString() },
        { key: 'max_ai_turns', value: maxTurns, updated_at: new Date().toISOString() },
        { key: 'closing_greeting_template', value: closingGreeting, updated_at: new Date().toISOString() },
        { key: 'auto_queue_enabled', value: autoQueueEnabled, updated_at: new Date().toISOString() },
        { key: 'ai_auto_enabled', value: aiEnabled, updated_at: new Date().toISOString() },
        { key: 'ai_monitoring_enabled', value: monitoringEnabled, updated_at: new Date().toISOString() },
      ];

      const { error } = await supabase.from('ticketing_settings').upsert(updates);
      if (error) throw new Error(error.message);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/ticketing"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Antrean Tiket
            </Link>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-xs text-slate-500">Pengaturan</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Sliders className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Pengaturan Sistem Tiket & AI
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Konfigurasi prompt AI, giliran balasan n8n, dan otomatisasi alur antrean tiket ICONNET.
          </p>
        </div>
      </div>

      {/* Status Alerts */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Pengaturan sistem tiket berhasil disimpan ke Supabase!</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Memuat pengaturan...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Automation Switches */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Layers className="w-4 h-4 text-blue-500" />
              Kontrol Sakelar Global
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={autoQueueEnabled}
                  onChange={(e) => setAutoQueueEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Auto-Queue
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Otomatis mulai tiket antrean berikutnya saat tiket aktif ditutup.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => setAiEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    AI Auto Chat
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Mengizinkan bot AI menjawab percakapan ICONNET secara mandiri.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={monitoringEnabled}
                  onChange={(e) => setMonitoringEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Mode Monitoring
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    AI membuat draf jawaban, tetapi harus di-approve admin sebelum dikirim.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* AI Prompt Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-500" />
                System Prompt AI (LLM / n8n)
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">Format JSON Output</span>
            </div>

            <div>
              <textarea
                rows={12}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full font-mono text-xs px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tulis sistem prompt AI..."
              />
              <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <span className="font-bold block text-slate-700 dark:text-slate-300">Variabel Dinamis yang Disediakan n8n:</span>
                <p>
                  <code className="text-blue-600 dark:text-blue-400 font-mono">{`{{ticket_json}}`}</code> : Data lengkap pelanggan, ID PLN, alamat, keluhan.
                </p>
                <p>
                  <code className="text-blue-600 dark:text-blue-400 font-mono">{`{{jumlah_foto}}`}</code> : Jumlah foto keluhan yang tersimpan di bucket.
                </p>
                <p>
                  <code className="text-blue-600 dark:text-blue-400 font-mono">{`{{waktu}}`}</code> : Waktu terkini dalam zona WITA.
                </p>
                <p>
                  <code className="text-blue-600 dark:text-blue-400 font-mono">{`{{riwayat}}`}</code> : Riwayat percakapan sebelumnya.
                </p>
                <p>
                  <code className="text-blue-600 dark:text-blue-400 font-mono">{`{{pesan}}`}</code> : Pesan terbaru yang baru saja dikirim CS ICONNET.
                </p>
              </div>
            </div>
          </div>

          {/* Limits & Templates */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Shield className="w-4 h-4 text-emerald-500" />
              Batas Giliran & Template Salam
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  Batas Maksimal Giliran AI per Tiket
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Jika giliran AI melampaui batas ini, status tiket otomatis berpindah ke <strong>Butuh Admin</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  Template Salam Penutup
                </label>
                <input
                  type="text"
                  value={closingGreeting}
                  onChange={(e) => setClosingGreeting(e.target.value)}
                  placeholder="Terima kasih Kak, tidak ada lagi yang perlu dibantu..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Pesan yang diucapkan saat nomor tiket sudah resmi diterbitkan oleh ICONNET.
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
