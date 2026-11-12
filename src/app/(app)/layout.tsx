import { redirect } from 'next/navigation';
import Link from 'next/link';
import { logout } from '@/app/(auth)/login/actions';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { BottomNav, Sidebar } from '@/components/ui/nav';
import { NavigationProgress } from '@/components/ui/navigation-progress';
import { LogOut, Crown, User as UserIcon } from 'lucide-react';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile.isMaster && !profile.isApproved) {
    redirect('/pending-approval');
  }

  const { email, isMaster, fullName } = profile;

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors">
      <NavigationProgress />
      <Sidebar
        isMaster={isMaster}
        userName={fullName || email || undefined}
        userEmail={email ?? undefined}
      />

      <div className="flex-1 md:ml-56 flex flex-col min-h-screen">
        {/* Header (mobile) */}
        <header className="md:hidden sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between transition-colors">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 shadow-xs flex items-center justify-center flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/iconnet-colored.svg"
                alt="ICONNET"
                className="h-6 w-auto object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-gray-900 dark:text-slate-100 text-sm leading-none">Absensi Piket</span>
                {isMaster ? (
                  <span className="text-[10px] bg-amber-100 border border-amber-300 text-amber-800 font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                    <Crown className="h-2.5 w-2.5" /> Master
                  </span>
                ) : (
                  <span className="text-[10px] bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 font-medium px-1.5 py-0.2 rounded-full">
                    Petugas
                  </span>
                )}
              </div>
              <p className="text-[10px] text-sky-700 dark:text-sky-400 font-semibold tracking-wide">
                ICONNET &bull; Macan Kumbang
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/profil"
              className="p-2 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] flex items-center justify-center"
              title="Profil & Dark Mode"
              aria-label="Profil & Dark Mode"
            >
              <UserIcon className="h-4 w-4" />
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors min-h-[44px] px-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                aria-label="Keluar"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>

        {/* Desktop header with profile shortcut & logout */}
        <header className="hidden md:flex items-center justify-end px-6 py-3 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
          <Link
            href="/profil"
            className="flex items-center gap-2 mr-4 px-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors group cursor-pointer"
            title="Klik untuk membuka Profil & Ganti Tema Dark Mode"
          >
            <span className="text-sm text-gray-700 dark:text-slate-200 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {fullName || email}
            </span>
            {isMaster ? (
              <span className="text-xs bg-amber-100 border border-amber-300 text-amber-800 font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                <Crown className="h-3 w-3" /> Master
              </span>
            ) : (
              <span className="text-xs bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                <UserIcon className="h-3 w-3" /> Petugas
              </span>
            )}
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 min-h-[44px]"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </form>
        </header>

        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>

      <BottomNav isMaster={isMaster} />
    </div>
  );
}
