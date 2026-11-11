'use client';

import { useEffect, useState, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // Jangan trigger jika klik kanan atau tombol khusus
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (
        href &&
        href.startsWith('/') &&
        !href.startsWith('#') &&
        !target.hasAttribute('download') &&
        target.target !== '_blank'
      ) {
        const fullCurrent = window.location.pathname + window.location.search;
        if (href !== fullCurrent) {
          setLoading(true);
        }
      }
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  if (!loading) return null;

  return (
    <>
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-blue-100 overflow-hidden">
        <div
          className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.7)]"
          style={{
            animation: 'navBarProgress 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
            width: '40%',
          }}
        />
      </div>

      {/* Floating loading indicator */}
      <div className="fixed bottom-20 md:bottom-6 right-6 z-[9999] bg-gray-900/90 text-white text-xs px-3.5 py-2.5 rounded-xl shadow-xl backdrop-blur-sm flex items-center gap-2 border border-gray-700/50">
        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
        <span className="font-medium">Memuat halaman...</span>
      </div>

      <style jsx global>{`
        @keyframes navBarProgress {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(150%);
          }
          100% {
            transform: translateX(350%);
          }
        }
      `}</style>
    </>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}

