'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessagesSquare,
  History,
  CalendarOff,
  Settings,
  FileDown,
  User,
  ChevronRight,
  Ticket,
  PlusCircle,
  Sparkles,
  Menu,
  X,
  LogOut,
  Crown,
  ShieldCheck,
  Star,
  GraduationCap,
  ClipboardCheck,
  Clock,
} from 'lucide-react';
import { logout } from '@/app/(auth)/login/actions';
import type { AppRole } from '@/lib/supabase/types';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  ticketOnly?: boolean;
  masterOnly?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface AppNavProps {
  isMaster?: boolean;
  canAccessTicketing?: boolean;
  canAccessPiket?: boolean;
  isMagang?: boolean;
  userName?: string | null;
  userEmail?: string | null;
  roles?: AppRole[];
  children: React.ReactNode;
}

export function RoleBadgeGroup({ roles, isMaster }: { roles?: AppRole[]; isMaster?: boolean }) {
  const activeRoles: AppRole[] =
    roles && roles.length > 0 ? roles : isMaster ? ['admin'] : ['magang'];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {activeRoles.map((role) => {
        if (role === 'owner') {
          return (
            <span
              key={role}
              className="text-[10px] bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
            >
              <Crown className="h-2.5 w-2.5" /> Owner
            </span>
          );
        }
        if (role === 'admin') {
          return (
            <span
              key={role}
              className="text-[10px] bg-blue-100 dark:bg-blue-950/80 border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
            >
              <ShieldCheck className="h-2.5 w-2.5" /> Admin
            </span>
          );
        }
        if (role === 'senior') {
          return (
            <span
              key={role}
              className="text-[10px] bg-purple-100 dark:bg-purple-950/80 border border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-300 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
            >
              <Star className="h-2.5 w-2.5" /> Senior
            </span>
          );
        }
        if (role === 'piket') {
          return (
            <span
              key={role}
              className="text-[10px] bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-300 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
            >
              <Clock className="h-2.5 w-2.5" /> Petugas Piket
            </span>
          );
        }
        if (role === 'tiket') {
          return (
            <span
              key={role}
              className="text-[10px] bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
            >
              <Ticket className="h-2.5 w-2.5" /> Tiket
            </span>
          );
        }
        return (
          <span
            key={role}
            className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
          >
            <GraduationCap className="h-2.5 w-2.5" /> Magang
          </span>
        );
      })}
    </div>
  );
}

function getNavigationSections(
  canAccessTicketing: boolean,
  isMaster: boolean,
  canAccessPiket: boolean,
  isMagang: boolean
): NavSection[] {
  const absensiItems: NavItem[] = [];

  // Halaman Piket HANYA untuk pengguna yang memiliki akses piket (Petugas Piket, Senior, Admin, Owner)
  if (canAccessPiket) {
    absensiItems.push({
      href: '/',
      label: 'Dashboard Absen Piket',
      icon: LayoutDashboard,
    });
  }

  // Presensi Harian HANYA untuk akun yang memiliki role magang
  if (isMagang) {
    absensiItems.push({
      href: '/absen-chat',
      label: 'Absen Harian',
      icon: MessagesSquare,
      badge: 'Baru',
      badgeColor: 'bg-blue-500 text-white',
    });
  }

  absensiItems.push({
    href: '/rekap-harian',
    label: 'Rekap Absen Harian',
    icon: ClipboardCheck,
  });

  // Riwayat Piket HANYA untuk pengguna yang memiliki akses piket
  if (canAccessPiket) {
    absensiItems.push({
      href: '/riwayat',
      label: 'Riwayat Absen Piket',
      icon: History,
    });
  }

  const sections: NavSection[] = [
    {
      title: canAccessPiket ? 'Absensi & Piket' : 'Absensi Harian Magang',
      items: absensiItems,
    },
  ];

  if (canAccessTicketing) {
    sections.push({
      title: 'Layanan & Tiket ICONNET',
      items: [
        { href: '/ticketing', label: 'Antrean Tiket', icon: Ticket, ticketOnly: true },
        { href: '/ticketing/new', label: 'Buat Tiket Baru', icon: PlusCircle, ticketOnly: true },
        { href: '/ticketing/settings', label: 'Pengaturan AI Tiket', icon: Sparkles, ticketOnly: true },
      ],
    });
  }

  if (isMaster) {
    sections.push({
      title: 'Manajemen & Rekapan',
      items: [
        { href: '/libur', label: 'Libur & Shift', icon: CalendarOff, masterOnly: true },
        { href: '/pengaturan', label: 'Pengaturan & User', icon: Settings, masterOnly: true },
        { href: '/export', label: 'Export Rekapan PDF', icon: FileDown },
      ],
    });
  } else {
    sections.push({
      title: 'Laporan',
      items: [{ href: '/export', label: 'Export Rekapan PDF', icon: FileDown }],
    });
  }

  sections.push({
    title: 'Akun & Preferensi',
    items: [{ href: '/profil', label: 'Profil Saya', icon: User }],
  });

  return sections;
}

function isNavItemActive(pathname: string, href: string, allItems: NavItem[]): boolean {
  if (pathname === href) return true;
  if (href === '/') return false;
  if (!pathname.startsWith(href)) return false;

  // Cek apakah ada nav item lain yang lebih spesifik cocok dengan pathname saat ini
  const hasMoreSpecific = allItems.some(
    (item) =>
      item.href !== href &&
      item.href.startsWith(href) &&
      (pathname === item.href || pathname.startsWith(item.href + '/'))
  );

  return !hasMoreSpecific;
}

export function AppNavigation({
  isMaster = false,
  canAccessTicketing = false,
  canAccessPiket = false,
  isMagang,
  userName,
  userEmail,
  roles,
  children,
}: AppNavProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const hasTicketAccess =
    canAccessTicketing ||
    Boolean(roles?.includes('tiket')) ||
    Boolean(roles?.includes('owner')) ||
    Boolean(roles?.includes('admin'));

  const userCanAccessPiket =
    canAccessPiket ||
    isMaster ||
    Boolean(roles?.includes('owner')) ||
    Boolean(roles?.includes('admin')) ||
    Boolean(roles?.includes('senior')) ||
    Boolean(roles?.includes('piket'));

  const userIsMagang = isMagang ?? Boolean(roles?.includes('magang'));

  const sections = getNavigationSections(hasTicketAccess, isMaster, userCanAccessPiket, userIsMagang);
  const allNavItems = useMemo(() => sections.flatMap((sec) => sec.items), [sections]);
  const displayName = userName || userEmail || 'Pengguna';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';

  // Tutup drawer secara otomatis jika berpindah halaman atau tombol ESC ditekan
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Kunci scroll body saat drawer terbuka di mobile atau saat berada di halaman chat absen
  const isChatPage = pathname.startsWith('/absen-chat');

  useEffect(() => {
    if (drawerOpen || isChatPage) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [drawerOpen, isChatPage]);

  return (
    <div
      className={`w-full max-w-full flex bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors overflow-x-hidden ${
        isChatPage ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-screen'
      }`}
    >
      {/* ============================================================== */}
      {/* 1. DESKTOP SIDEBAR (Lebar, Elegan, Terkategori)                */}
      {/* ============================================================== */}
      <aside className="hidden md:flex flex-col w-64 min-h-screen bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 p-4 fixed top-0 left-0 bottom-0 z-20 transition-colors select-none">
        {/* Brand Header */}
        <div className="mb-4 px-2 py-1 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 shadow-xs inline-flex items-center justify-center flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/iconnet-colored.svg"
              alt="ICONNET"
              className="h-7 w-auto object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.includes('logo.svg')) {
                  target.src = '/images/logo.svg';
                }
              }}
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-tight truncate">
              Magang ICONNET
            </h1>
            <p className="text-[10px] text-sky-700 dark:text-sky-400 font-semibold tracking-wide">
              ICONNET BALINUSRA
            </p>
          </div>
        </div>

        {/* Scrollable Categorized Nav Sections */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1 py-2 custom-scrollbar">
          {sections.map((sec, secIdx) => (
            <div key={secIdx} className="space-y-1">
              <p className="px-3 text-[10px] font-bold tracking-wider uppercase text-gray-400 dark:text-slate-500">
                {sec.title}
              </p>
              {sec.items.map(({ href, label, icon: Icon, badge, badgeColor }) => {
                const isActive = isNavItemActive(pathname, href, allNavItems);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
                      <span className="truncate">{label}</span>
                    </div>
                    {badge && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                          badgeColor || 'bg-blue-500 text-white'
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom User Card in Desktop */}
        <div className="pt-3 border-t border-gray-100 dark:border-slate-800 mt-auto">
          <Link
            href="/profil"
            className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800/70 transition-all text-gray-700 dark:text-slate-300 group"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-sky-400 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {displayName}
              </p>
              <div className="mt-0.5">
                <RoleBadgeGroup roles={roles} isMaster={isMaster} />
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
          </Link>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. MOBILE SLIDE-OVER DRAWER (Menu Hamburger Terorganisir)     */}
      {/* ============================================================== */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="relative w-4/5 max-w-xs h-full bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 shadow-2xl flex flex-col p-4 z-10 animate-in slide-in-from-left duration-250">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 dark:text-slate-100 truncate">
                    {displayName}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-400 truncate">
                    {userEmail || 'Pengguna'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Tutup Menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Badges Info in Drawer */}
            <div className="py-2.5">
              <RoleBadgeGroup roles={roles} isMaster={isMaster} />
            </div>

            {/* Drawer Categorized Navigation Links */}
            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1 -mr-1 custom-scrollbar">
              {sections.map((sec, secIdx) => (
                <div key={secIdx} className="space-y-1">
                  <p className="px-2 text-[10px] font-bold tracking-wider uppercase text-gray-400 dark:text-slate-500">
                    {sec.title}
                  </p>
                  {sec.items.map(({ href, label, icon: Icon, badge, badgeColor }) => {
                    const isActive = isNavItemActive(pathname, href, allNavItems);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors min-h-[42px] ${
                          isActive
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
                          <span className="truncate">{label}</span>
                        </div>
                        {badge && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                              badgeColor || 'bg-blue-500 text-white'
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Drawer Footer: Logout */}
            <div className="pt-3 border-t border-gray-100 dark:border-slate-800 mt-auto">
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors min-h-[42px]"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar dari Akun
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. MAIN CONTENT CONTAINER & HEADERS                            */}
      {/* ============================================================== */}
      <div
        className={`flex-1 min-w-0 max-w-full md:ml-64 flex flex-col transition-colors ${
          isChatPage ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-screen overflow-x-hidden'
        }`}
      >
        {/* Mobile Header with Hamburger Button ☰ */}
        <header className="md:hidden sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-3 py-2.5 flex items-center justify-between transition-colors shadow-xs">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="p-2 -ml-1 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors min-h-[40px] flex items-center justify-center"
              aria-label="Buka Menu Navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link href="/" className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 shadow-2xs flex items-center justify-center flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/iconnet-colored.svg"
                  alt="ICONNET"
                  className="h-5 w-auto object-contain"
                />
              </div>
              <div>
                <span className="font-bold text-gray-900 dark:text-slate-100 text-xs leading-none block">
                  Magang ICONNET
                </span>
                <span className="text-[9px] text-sky-700 dark:text-sky-400 font-semibold tracking-wide">
                  ICONNET
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-1">
            <Link
              href="/profil"
              className="p-2 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors min-h-[40px] flex items-center justify-center"
              title="Profil & Tema"
              aria-label="Profil"
            >
              <User className="h-4 w-4" />
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="p-2 text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors min-h-[40px] rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center"
                aria-label="Keluar"
                title="Keluar"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
          <div className="flex items-center gap-2">
            <RoleBadgeGroup roles={roles} isMaster={isMaster} />
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/profil"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors group cursor-pointer text-xs font-semibold text-gray-700 dark:text-slate-200"
              title="Klik untuk membuka Profil & Tema"
            >
              <span className="group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {displayName}
              </span>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <LogOut className="h-3.5 w-3.5" />
                Keluar
              </button>
            </form>
          </div>
        </header>

        {/* Page Content */}
        <main
          className={`flex-1 min-w-0 max-w-full ${
            isChatPage
              ? 'min-h-0 overflow-hidden flex flex-col pb-14 md:pb-0'
              : 'pb-20 md:pb-8 overflow-x-hidden'
          }`}
        >
          {children}
        </main>
      </div>

      {/* ============================================================== */}
      {/* 4. MOBILE QUICK BOTTOM BAR (Ringkas: Maksimal 4 Tombol)        */}
      {/* ============================================================== */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 md:hidden transition-colors shadow-lg">
        <ul className="flex items-center justify-around h-14">
          {/* 1. Tombol Utama (Absen Piket jika punya akses piket, atau Absen Harian untuk Magang, atau Rekap) */}
          <li className="flex-1">
            {userCanAccessPiket ? (
              <Link
                href="/"
                className={`flex flex-col items-center justify-center py-1.5 text-[10px] transition-colors ${
                  pathname === '/'
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                }`}
              >
                <LayoutDashboard className="h-4 w-4 mb-0.5" />
                <span>Absen Piket</span>
              </Link>
            ) : userIsMagang ? (
              <Link
                href="/absen-chat"
                className={`flex flex-col items-center justify-center py-1.5 text-[10px] transition-colors relative ${
                  pathname.startsWith('/absen-chat')
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                }`}
              >
                <div className="relative">
                  <MessagesSquare className="h-4 w-4 mb-0.5" />
                  <span className="absolute -top-1 -right-2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <span>Absen Harian</span>
              </Link>
            ) : (
              <Link
                href="/rekap-harian"
                className={`flex flex-col items-center justify-center py-1.5 text-[10px] transition-colors ${
                  pathname.startsWith('/rekap-harian')
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                }`}
              >
                <ClipboardCheck className="h-4 w-4 mb-0.5" />
                <span>Rekap</span>
              </Link>
            )}
          </li>

          {/* 2. Tombol Kedua (Absen Harian jika punya akses, atau Rekap Harian) */}
          <li className="flex-1">
            {userCanAccessPiket && userIsMagang ? (
              <Link
                href="/absen-chat"
                className={`flex flex-col items-center justify-center py-1.5 text-[10px] transition-colors relative ${
                  pathname.startsWith('/absen-chat')
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                }`}
              >
                <div className="relative">
                  <MessagesSquare className="h-4 w-4 mb-0.5" />
                  <span className="absolute -top-1 -right-2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <span>Absen Harian</span>
              </Link>
            ) : (
              <Link
                href="/rekap-harian"
                className={`flex flex-col items-center justify-center py-1.5 text-[10px] transition-colors ${
                  pathname.startsWith('/rekap-harian')
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                }`}
              >
                <ClipboardCheck className="h-4 w-4 mb-0.5" />
                <span>Rekap</span>
              </Link>
            )}
          </li>

          {/* 3. Ticketing (Jika punya akses) atau Riwayat (Piket) atau Profil */}
          <li className="flex-1">
            {hasTicketAccess ? (
              <Link
                href="/ticketing"
                className={`flex flex-col items-center justify-center py-1.5 text-[10px] transition-colors ${
                  pathname.startsWith('/ticketing')
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                }`}
              >
                <Ticket className="h-4 w-4 mb-0.5" />
                <span>Tiket</span>
              </Link>
            ) : userCanAccessPiket ? (
              <Link
                href="/riwayat"
                className={`flex flex-col items-center justify-center py-1.5 text-[10px] transition-colors ${
                  pathname.startsWith('/riwayat')
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                }`}
              >
                <History className="h-4 w-4 mb-0.5" />
                <span>Riwayat</span>
              </Link>
            ) : (
              <Link
                href="/profil"
                className={`flex flex-col items-center justify-center py-1.5 text-[10px] transition-colors ${
                  pathname.startsWith('/profil')
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100'
                }`}
              >
                <User className="h-4 w-4 mb-0.5" />
                <span>Profil</span>
              </Link>
            )}
          </li>

          {/* 4. Hamburger / Menu Lengkap */}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="w-full flex flex-col items-center justify-center py-1.5 text-[10px] text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition-colors"
              aria-label="Buka Menu Lengkap"
            >
              <Menu className="h-4 w-4 mb-0.5" />
              <span>Menu</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

// Kompatibilitas mundur jika ada modul yang mengimpor BottomNav atau Sidebar secara terpisah
export function BottomNav() {
  return null;
}

export function Sidebar() {
  return null;
}
