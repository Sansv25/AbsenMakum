'use client';

import { useEffect } from 'react';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // Cek paling cepat setiap 5 menit
const STORAGE_KEY = 'icnt_auto_recap_last_ping';

/**
 * Watcher ringan yang berjalan di latar belakang khusus untuk akun Master/Admin.
 * Berfungsi sebagai catch-up otomatis berbasis sesi terautentikasi Master apabila
 * cron server belum dipicu atau service role env belum terpasang.
 */
export function AutoRecapWatcher({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const triggerCheck = async () => {
      try {
        const lastPingRaw = window.localStorage.getItem(STORAGE_KEY);
        const now = Date.now();
        if (lastPingRaw) {
          const lastPing = Number(lastPingRaw);
          if (!Number.isNaN(lastPing) && now - lastPing < CHECK_INTERVAL_MS) {
            return;
          }
        }
        window.localStorage.setItem(STORAGE_KEY, String(now));
        await fetch('/api/cron/send-recap', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
      } catch {
        // Abaikan error jaringan latar belakang
      }
    };

    const timer = setTimeout(triggerCheck, 4000);
    const interval = setInterval(triggerCheck, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [enabled]);

  return null;
}
