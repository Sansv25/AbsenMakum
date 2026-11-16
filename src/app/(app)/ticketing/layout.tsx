import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/data/profile';

export const dynamic = 'force-dynamic';

export default async function TicketingModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUserProfile();

  // Hanya pengguna dengan role 'tiket', 'admin', atau 'owner' yang diizinkan mengakses modul ticketing
  const canAccessTicketing = profile.isOwner || profile.isAdmin || profile.isTiket;

  if (!canAccessTicketing) {
    redirect('/');
  }

  return <>{children}</>;
}
