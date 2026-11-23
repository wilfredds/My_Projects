'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LogOut, Menu, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from './language-switcher';
import { NavLinks } from './nav-links';
import { ShopMark } from './shop-mark';
import { ShopLogo } from './shop-logo';
import type { NavItem } from '@/lib/rbac';
import { signOutAction } from '@/app/actions/sign-out';

function LogoutButton({ className }: { className?: string }) {
  const t = useTranslations('common');
  return (
    <form action={signOutAction} className={className}>
      <Button type="submit" variant="outline" size="compact" className="w-full">
        <LogOut aria-hidden />
        <span>{t('logout')}</span>
      </Button>
    </form>
  );
}

/**
 * The persistent top bar: shop name, language and a labelled Log out button.
 *
 * On a phone the bar holds only the Menu button and the shop name, so the name
 * is never cut off; language and Log out move into the menu, each still with
 * its words. From a tablet up, they sit in the bar itself.
 */
export function TopBar({
  shopName,
  shopLogo,
  userName,
  navItems,
}: {
  shopName: string;
  shopLogo: string | null;
  userName: string;
  navItems: NavItem[];
}) {
  const tn = useTranslations('nav');
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header className="app-header sticky top-0 z-40 border-b border-t-4 border-b-border border-t-primary bg-card">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:gap-4">
        {/* Mobile menu toggle — labelled, never a bare icon. */}
        <Button
          variant="outline"
          size="compact"
          className="shrink-0 lg:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
        >
          {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
          <span>{tn('menu')}</span>
        </Button>

        <Link
          href="/dashboard"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
        >
          <ShopLogo name={shopName} logo={shopLogo} className="size-10 text-base sm:size-12 sm:text-lg" />
          <span className="min-w-0">
            <span className="block font-display text-lg font-bold uppercase leading-tight tracking-wide [text-wrap:balance] sm:text-xl">
              <ShopMark name={shopName} />
            </span>
            {/* On a phone the name of who is signed in moves into the menu. */}
            <span className="hidden truncate text-base text-muted-foreground sm:block">{userName}</span>
          </span>
        </Link>

        <div className="hidden shrink-0 sm:block">
          <LanguageSwitcher signedIn />
        </div>

        <LogoutButton className="hidden shrink-0 sm:block" />
      </div>

      {menuOpen ? (
        <div id="mobile-nav" className="border-t border-border bg-background px-4 pb-5 pt-4 lg:hidden">
          <p className="mb-3 flex items-center gap-2 px-1 text-base text-muted-foreground sm:hidden">
            <UserRound aria-hidden className="size-5" />
            <span className="truncate">{userName}</span>
          </p>
          <NavLinks items={navItems} onNavigate={() => setMenuOpen(false)} />
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:hidden">
            <LanguageSwitcher signedIn />
            <LogoutButton />
          </div>
        </div>
      ) : null}
    </header>
  );
}
