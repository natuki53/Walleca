'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  Bell,
  CalendarDays,
  Search,
  Settings,
} from 'lucide-react';

const navigation = [
  { name: 'ダッシュボード', href: '/dashboard', icon: LayoutDashboard },
  { name: '取引', href: '/transactions', icon: ArrowLeftRight },
  { name: 'サブスク', href: '/subscriptions', icon: CreditCard },
  { name: 'カレンダー', href: '/calendar', icon: CalendarDays },
  { name: '通知', href: '/notifications', icon: Bell },
  { name: '検索・エクスポート', href: '/search', icon: Search },
  { name: '設定', href: '/settings', icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname() || '';

  const navigationContent = (
    <>
      <div className="flex items-center flex-shrink-0 px-4">
        <Link href="/dashboard" className="text-2xl font-bold" onClick={onMobileClose}>
          Walleca
        </Link>
      </div>
      <nav className="mt-8 flex-1 px-2 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col flex-grow pt-5 bg-card border-r overflow-y-auto">
          {navigationContent}
        </div>
      </aside>

      <div
        aria-hidden={!mobileOpen}
        className={cn(
          'fixed inset-0 z-50 md:hidden transition-opacity duration-300 ease-out',
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        <button
          type="button"
          aria-label="メニューを閉じる"
          className="absolute inset-0 bg-black/50 transition-opacity duration-300 ease-out"
          onClick={onMobileClose}
        />
        <aside
          className={cn(
            'relative z-10 flex h-full w-64 flex-col border-r bg-card pt-5 shadow-xl transition-transform duration-300 ease-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {navigationContent}
        </aside>
      </div>
    </>
  );
}
