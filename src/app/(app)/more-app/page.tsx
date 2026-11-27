import { getCurrentUserProfile } from '@/lib/data/profile';
import { getMoreApps, getMoreAppUserOptions } from '@/lib/data/more-apps';
import { MoreAppClient } from './more-app-client';

export const dynamic = 'force-dynamic';

export default async function MoreAppPage() {
  const [profile, { items }] = await Promise.all([
    getCurrentUserProfile(),
    getMoreApps(),
  ]);

  const userOptions = profile.isOwner ? await getMoreAppUserOptions() : [];

  return (
    <MoreAppClient
      initialItems={items}
      canManage={profile.canManageSettings}
      isOwner={profile.isOwner}
      userOptions={userOptions}
    />
  );
}
