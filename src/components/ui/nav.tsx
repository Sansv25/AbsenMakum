'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  History,
  CalendarOff,
  Settings,
  FileDown,
  User,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  masterOnly?: boolean;
}

const allNavItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/riwayat', label: 'Riwayat', icon: History },
  { href: '/libur', label: 'Libur', icon: CalendarOff, masterOnly: true },
  { href: '/pengaturan', label: 'Pengaturan', icon: Settings, masterOnly: true },
  { href: '/export', label: 'Export', icon: FileDown },
];

interface NavProps {
  isMaster?: boolean;
  userName?: string | null;
  userEmail?: string | null;
}

export function BottomNav({ isMaster = false }: NavProps) {
  const pathname = usePathname();
  const baseItems = isMaster ? allNavItems : allNavItems.filter((item) => !item.masterOnly);
  const navItems = [
    ...baseItems,
    { href: '/profil', label: 'Profil', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 md:hidden transition-colors">
      <ul className="flex">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-xs transition-colors ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px]">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Sidebar({ isMaster = false, userName, userEmail }: NavProps) {
  const pathname = usePathname();
  const navItems = isMaster ? allNavItems : allNavItems.filter((item) => !item.masterOnly);
  const displayName = userName || userEmail || 'Pengguna';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 p-4 gap-1 fixed top-0 left-0 bottom-0 transition-colors">
      {/* Brand Header */}
      <div className="mb-5 px-2 flex flex-col items-start gap-3">
        <div className="p-2 rounded-2xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 shadow-sm inline-flex items-center justify-center">
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
          <h1 className="text-base font-bold text-gray-900 dark:text-slate-100 leading-tight">Absensi Piket</h1>
          <p className="text-[11px] text-sky-700 dark:text-sky-400 font-semibold tracking-wide mt-0.5">
            ICONNET &bull; Macan Kumbang
          </p>
        </div>
      </div>

      {/* Main Nav Items */}
      <div className="flex-1 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100'
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Bottom Profile Anchor */}
      <div className="pt-3 border-t border-gray-100 dark:border-slate-800">
        <Link
          href="/profil"
          className={`flex items-center gap-2.5 p-2 rounded-xl transition-all ${
            pathname === '/profil'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
              : 'hover:bg-gray-100 dark:hover:bg-slate-800/70 text-gray-700 dark:text-slate-300 border border-transparent'
          }`}
          title="Buka Pengaturan Profil & Dark Mode"
        >
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-sky-400 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate leading-tight">
              {displayName}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 truncate mt-0.5">
              {isMaster ? 'Master' : 'Petugas'} &bull; Profil
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
        </Link>
      </div>
    </aside>
  );
}
