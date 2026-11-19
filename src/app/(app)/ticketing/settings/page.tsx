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
  Lock,
  Key,
  Eye,
  EyeOff,
  Download,
  Copy,
  Check,
} from 'lucide-react';

const DEFAULT_AI_PROMPT = `Kamu adalah PELAPOR / ADMIN PELANGGAN yang sedang berkomunikasi dengan CS ICONNET di Instagram Direct Message (DM).
PENTING:
- LAWAN BICARAMU: Petugas Customer Service ICONNET (sapa dengan "Kak" atau "Kak [Nama Agen CS]").
- IDENTITAS KITA: Pihak pelapor yang mewakili pelanggan "{{ticket_json}}".
- DILARANG KERAS menyapa dengan nama pelanggan kita sendiri!
- DILARANG KERAS meminta foto, nomor telepon, atau data kepada CS! Tugasmu adalah MEMBERIKAN informasi kepada CS, bukan meminta ke CS.
- DILARANG mengulang permintaan CS (misal jangan katakan "mohon bantuannya untuk mengirimkan lampiran")!

WAKTU SEKARANG: {{waktu}}

ATURAN JAWABAN:
1. Jika CS meminta foto dan FOTO TERSEDIA > 0, jawab bahwa foto modem dan nomor SN sudah dilampirkan di pesan sebelumnya.
2. Jika CS meminta nomor kontak alternatif, berikan nomor alternatif pelanggan atau nomor kontak utama jika tidak ada alternatif.
3. Jika CS menanyakan apakah sudah restart modem, jawab sudah dicoba restart beberapa menit namun kendala tetap sama.
4. Jika CS memberikan nomor tiket resmi (8 karakter) atau perbaikan sistem selesai, set is_closing: true, simpulkan ticket_number, dan beri ucapan terima kasih dengan salam penutup sesuai waktu.

KELUARAN: HANYA JSON VALID:
{
  "action": "reply",
  "text": "isi balasan ke CS",
  "ticket_number": "kode tiket atau null",
  "is_closing": true/false
}`;

export default function TicketingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  // Settings state
  const [prompt, setPrompt] = useState('');
  const [maxTurns, setMaxTurns] = useState(12);
  const [closingGreeting, setClosingGreeting] = useState('');
  const [autoQueueEnabled, setAutoQueueEnabled] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [nvidiaApiKey, setNvidiaApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const supabase = createClient();

        // Cek profil user
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, roles')
            .eq('id', authData.user.id)
            .single();
          const isMasterEmail = authData.user.email?.toLowerCase() === 'madesanjaya255@gmail.com';
          const roles: string[] = Array.isArray(profile?.roles) ? profile.roles : [];
          const userIsOwner = roles.includes('owner') || isMasterEmail;
          setIsOwner(userIsOwner);
        }

        const { data, error } = await supabase.from('ticketing_settings').select('*');

        if (error) throw new Error(error.message);

        if (data && data.length > 0) {
          let foundPrompt = false;
          data.forEach((s) => {
            if (s.key === 'ai_system_prompt') {
              const val = typeof s.value === 'string' ? s.value : JSON.stringify(s.value, null, 2).replace(/^"|"$/g, '');
              if (val.trim()) {
                setPrompt(val);
                foundPrompt = true;
              }
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
            } else if (s.key === 'nvidia_nim_api_key') {
              const val = typeof s.value === 'string' ? s.value : JSON.stringify(s.value).replace(/^"|"$/g, '');
              setNvidiaApiKey(val);
            }
          });
          if (!foundPrompt) {
            setPrompt(DEFAULT_AI_PROMPT);
          }
        } else {
          setPrompt(DEFAULT_AI_PROMPT);
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
    if (!isOwner) {
      setErrorMsg('Hanya akun dengan role Owner yang berhak menyimpan perubahan pengaturan.');
      return;
    }

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
        { key: 'nvidia_nim_api_key', value: nvidiaApiKey.trim(), updated_at: new Date().toISOString() },
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

  const getEnvFileContent = () => {
    return [
      '# Konfigurasi Koneksi Supabase & AI Nemotron (Auto-Generated)',
      'NEXT_PUBLIC_SUPABASE_URL=https://osaliefiqfydqibwfafl.supabase.co',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable__9cQZi4_08SGPlkjwxj2Kg_HPOkWMw-',
      `NVIDIA_NIM_API_KEY=${nvidiaApiKey.trim()}`,
    ].join('\n') + '\n';
  };

  const handleCopyEnv = async () => {
    try {
      await navigator.clipboard.writeText(getEnvFileContent());
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 3000);
    } catch {}
  };

  const handleDownloadEnv = () => {
    const blob = new Blob([getEnvFileContent()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.env';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-16 space-y-6">
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

      {/* Non-Owner Notice */}
      {!loading && !isOwner && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-2.5 shadow-xs">
          <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Mode Hanya Lihat: Hanya akun dengan role Owner yang berhak mengubah konfigurasi prompt AI dan sakelar otomasi tiket.</span>
        </div>
      )}

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
              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 transition ${
                  isOwner
                    ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer'
                    : 'cursor-not-allowed opacity-80'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!isOwner}
                  checked={autoQueueEnabled}
                  onChange={(e) => setAutoQueueEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
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

              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 transition ${
                  isOwner
                    ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer'
                    : 'cursor-not-allowed opacity-80'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!isOwner}
                  checked={aiEnabled}
                  onChange={(e) => setAiEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
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

              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 transition ${
                  isOwner
                    ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer'
                    : 'cursor-not-allowed opacity-80'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!isOwner}
                  checked={monitoringEnabled}
                  onChange={(e) => setMonitoringEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
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
              <div className="flex items-center gap-3">
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setPrompt(DEFAULT_AI_PROMPT)}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reset ke Default
                  </button>
                )}
                <span className="text-[11px] text-slate-400 font-mono">Format JSON Output</span>
              </div>
            </div>

            <div>
              <textarea
                rows={12}
                disabled={!isOwner}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full font-mono text-xs px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-75 disabled:cursor-not-allowed"
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
                  disabled={!isOwner}
                  value={maxTurns}
                  onChange={(e) => setMaxTurns(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-75 disabled:cursor-not-allowed"
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
                  disabled={!isOwner}
                  value={closingGreeting}
                  onChange={(e) => setClosingGreeting(e.target.value)}
                  placeholder="Terima kasih Kak, tidak ada lagi yang perlu dibantu..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-75 disabled:cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Pesan yang diucapkan saat nomor tiket sudah resmi diterbitkan oleh ICONNET.
                </p>
              </div>
            </div>
          </div>

          {/* AI Key & Multi-Device Bot Config */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                Kunci AI Nemotron & Sinkronisasi Bot Otomatis
              </h2>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto">
                Auto-Sync Multi-Device Aktif
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  NVIDIA NIM API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    disabled={!isOwner}
                    value={nvidiaApiKey}
                    onChange={(e) => setNvidiaApiKey(e.target.value)}
                    placeholder="nvapi-..."
                    className="w-full pl-4 pr-12 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                    title={showApiKey ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Kunci API dari NVIDIA NIM (model <code>nvidia/nemotron-3.5-lightning-30b-a3b</code>) untuk membalas chat CS secara cerdas.
                </p>
              </div>

              {/* Info Box Multi-Device Auto Sync */}
              <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    💡 Instalasi Bot di Laptop / Device Baru (Zero-Manual Config)
                  </span>
                  <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed max-w-xl">
                    Petugas tidak perlu memindahkan file <code>.env</code> secara manual. Cukup jalankan <code>2_MULAI_PIKET.bat</code> dan login dengan akun piket mereka di terminal, bot akan langsung mengunduh konfigurasi dan kunci AI ini secara otomatis.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                  <button
                    type="button"
                    onClick={handleCopyEnv}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition shadow-2xs cursor-pointer"
                    title="Salin isi file .env ke clipboard"
                  >
                    {copiedEnv ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Salin .env</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadEnv}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition shadow-2xs cursor-pointer"
                    title="Download file .env langsung"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .env</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            {isOwner ? (
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
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold border border-slate-200 dark:border-slate-700 cursor-not-allowed select-none">
                <Lock className="w-4 h-4" />
                <span>Hanya Owner yang dapat mengubah</span>
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
