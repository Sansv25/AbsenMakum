// Shared mutex lock to prevent concurrent Puppeteer launches using .chrome_instagram_profile

let isBrowserBusy = false;
let currentTask = '';

export async function withBrowserLock<T>(taskName: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  while (isBrowserBusy) {
    if (Date.now() - start > 60000) {
      throw new Error(`Timeout: Browser sedang sibuk menjalankan "${currentTask}" lebih dari 60 detik.`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  isBrowserBusy = true;
  currentTask = taskName;
  try {
    return await fn();
  } finally {
    isBrowserBusy = false;
    currentTask = '';
  }
}

export function isBrowserLocked(): boolean {
  return isBrowserBusy;
}

export function getCurrentBrowserTask(): string {
  return currentTask;
}
