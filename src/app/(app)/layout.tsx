import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/data/profile';
import { AppNavigation } from '@/components/ui/nav';
import { NavigationProgress } from '@/components/ui/navigation-progress';
import { AutoRecapWatcher } from '@/components/recap/auto-recap-watcher';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile.phone || profile.phone.trim() === '') {
    redirect('/complete-profile');
  }

  if (!profile.canManageSettings && !profile.isApproved) {
    redirect('/pending-approval');
  }

  const {
    email,
    fullName,
    roles,
    canManageSettings,
    canCreateTicket,
    canAccessPiket,
    canAccessRekapHarian,
    isMagang,
    isSenior,
  } = profile;

  return (
    <>
      <NavigationProgress />
      <AutoRecapWatcher enabled={canManageSettings} />
      <AppNavigation
        isMaster={canManageSettings}
        canAccessTicketing={canCreateTicket}
        canAccessPiket={canAccessPiket}
        canAccessRekapHarian={canAccessRekapHarian}
        isMagang={isMagang}
        isSenior={isSenior}
        userName={fullName || email || undefined}
        userEmail={email ?? undefined}
        roles={roles}
      >
        {children}
      </AppNavigation>
    </>
  );
}
