'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Receipt,
  ArrowLeftRight,
  CreditCard,
  Settings,
} from 'lucide-react';

const navigation = [
  { name: 'ダッシュボード', href: '/dashboard', icon: LayoutDashboard },
  { name: 'レシート', href: '/receipts', icon: Receipt },
  { name: '取引', href: '/transactions', icon: ArrowLeftRight },
  { name: 'サブスク', href: '/subscriptions', icon: CreditCard },
  { name: '設定', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname() || '';

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
      <div className="flex flex-col flex-grow pt-5 bg-card border-r overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <Link href="/dashboard" className="text-2xl font-bold">
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
      </div>
    </aside>
  );
}
