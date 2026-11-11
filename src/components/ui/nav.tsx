'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  History,
  CalendarOff,
  Settings,
  FileDown,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/riwayat', label: 'Riwayat', icon: History },
  { href: '/libur', label: 'Libur', icon: CalendarOff },
  { href: '/pengaturan', label: 'Pengaturan', icon: Settings },
  { href: '/export', label: 'Export', icon: FileDown },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden">
      <ul className="flex">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-xs transition-colors ${
                  isActive
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-white border-r border-gray-200 p-4 gap-1 fixed top-0 left-0 bottom-0">
      <div className="mb-6 px-2 flex flex-col items-start gap-3">
        <div className="p-2 rounded-2xl bg-sky-50/80 border border-sky-100 shadow-sm inline-flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/iconnet-colored.svg"
            alt="ICONNET"
            className="h-9 w-auto object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (!target.src.includes('logo.svg')) {
                target.src = '/images/logo.svg';
              }
            }}
          />
        </div>
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Absensi Piket</h1>
          <p className="text-[11px] text-sky-700 font-semibold tracking-wide mt-0.5">
            ICONNET &bull; Macan Kumbang
          </p>
        </div>
      </div>
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
              isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
