import { redirect } from 'next/navigation';
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

  const { email, isMaster } = profile;

  return (
    <div className="min-h-screen flex">
      <NavigationProgress />
      <Sidebar isMaster={isMaster} />

      <div className="flex-1 md:ml-56 flex flex-col min-h-screen">
        {/* Header (mobile) */}
        <header className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-sky-50/80 border border-sky-100 shadow-xs flex items-center justify-center flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/iconnet-colored.svg"
                alt="ICONNET"
                className="h-6 w-auto object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-gray-900 text-sm leading-none">Absensi Piket</span>
                {isMaster ? (
                  <span className="text-[10px] bg-amber-100 border border-amber-300 text-amber-800 font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                    <Crown className="h-2.5 w-2.5" /> Master
                  </span>
                ) : (
                  <span className="text-[10px] bg-blue-50 border border-blue-200 text-blue-700 font-medium px-1.5 py-0.2 rounded-full">
                    Petugas
                  </span>
                )}
              </div>
              <p className="text-[10px] text-sky-700 font-semibold tracking-wide">
                ICONNET &bull; Macan Kumbang
              </p>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors min-h-[44px] px-2"
              aria-label="Keluar"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </header>

        {/* Desktop header with logout */}
        <header className="hidden md:flex items-center justify-end px-6 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2 mr-4">
            <span className="text-sm text-gray-600">{email}</span>
            {isMaster ? (
              <span className="text-xs bg-amber-100 border border-amber-300 text-amber-800 font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                <Crown className="h-3 w-3" /> Master
              </span>
            ) : (
              <span className="text-xs bg-gray-100 border border-gray-200 text-gray-600 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                <UserIcon className="h-3 w-3" /> Petugas
              </span>
            )}
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors px-3 py-2 rounded-lg hover:bg-red-50 min-h-[44px]"
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
