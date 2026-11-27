import { getCurrentUserProfile } from '@/lib/data/profile';
import { getMoreApps } from '@/lib/data/more-apps';
import { MoreAppClient } from './more-app-client';

export const dynamic = 'force-dynamic';

export default async function MoreAppPage() {
  const [{ canManageSettings }, { items }] = await Promise.all([
    getCurrentUserProfile(),
    getMoreApps(),
  ]);

  return <MoreAppClient initialItems={items} canManage={canManageSettings} />;
}
