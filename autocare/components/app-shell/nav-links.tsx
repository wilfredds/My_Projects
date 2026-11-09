'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Home,
  ClipboardList,
  Users,
  Car,
  Wrench,
  BarChart3,
  ShieldCheck,
  Settings,
  History,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/lib/rbac';

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  clipboard: ClipboardList,
  users: Users,
  car: Car,
  wrench: Wrench,
  chart: BarChart3,
  shield: ShieldCheck,
  settings: Settings,
  history: History,
  trash: Trash2,
};

/**
 * Navigation entries: a large icon with a text label beside it, always.
 * Each row is 64px tall so it is comfortable to tap.
 *
 * The current page is marked with an orange bar and a pale orange fill rather
 * than a solid orange block — solid orange is kept for the one main action on
 * each screen, so the menu never competes with "Record a job".
 */
export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <nav className="flex flex-col gap-1" aria-label={t('menu')}>
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? Home;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-tap items-center gap-4 rounded-lg border-l-[6px] px-4 py-3 text-lg font-semibold',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
              active
                ? 'border-primary bg-primary-tint text-foreground'
                : 'border-transparent text-foreground hover:bg-accent',
            )}
          >
            <Icon
              className={cn('size-7 shrink-0', active ? 'text-primary-strong' : 'text-muted-foreground')}
              aria-hidden
            />
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
