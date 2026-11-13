import Link from 'next/link';
import { SlidersHorizontal, Users, HardDrive, Mail } from 'lucide-react';

interface SettingsTabsProps {
  activeTab: 'shifts' | 'users' | 'monitoring' | 'rekapan';
}

export function SettingsTabs({ activeTab }: SettingsTabsProps) {
  const tabs = [
    {
      id: 'shifts',
      label: 'Pengaturan Shift',
      href: '/pengaturan',
      icon: SlidersHorizontal,
    },
    {
      id: 'users',
      label: 'Manajemen Akun',
      href: '/pengaturan/users',
      icon: Users,
    },
    {
      id: 'monitoring',
      label: 'Monitoring Supabase',
      href: '/pengaturan/monitoring',
      icon: HardDrive,
    },
    {
      id: 'rekapan',
      label: 'Rekapan Email',
      href: '/pengaturan/rekapan',
      icon: Mail,
    },
  ] as const;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 border-b border-gray-200 dark:border-slate-800 pb-2 overflow-x-auto no-scrollbar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${
              isActive
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 shadow-xs'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 border border-transparent'
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}`} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

