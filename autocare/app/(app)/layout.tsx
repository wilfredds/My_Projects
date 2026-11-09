import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requirePageUser } from '@/lib/session';
import { navItemsFor } from '@/lib/rbac';
import { getShopInfo } from '@/lib/settings';
import { TopBar } from '@/components/app-shell/top-bar';
import { NavLinks } from '@/components/app-shell/nav-links';

/**
 * The signed-in shell.
 *
 * Layout is deliberately identical on every page: the same top bar, the same
 * left navigation, the same footer — so nothing moves around between screens.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();

  // Belt and braces with the middleware: the policy must be acknowledged before
  // any part of the app is reachable.
  if (!user.policyAccepted) redirect('/policy?first=1');

  const [shop, t] = await Promise.all([getShopInfo(), getTranslations('footer')]);
  const navItems = navItemsFor(user.role);

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar shopName={shop.name} userName={user.name} navItems={navItems} />

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 pb-6 pt-5 sm:pt-8">
        {/* Persistent side navigation on large screens; the top bar holds the
            same links behind a labelled Menu button on small ones. */}
        <aside className="no-print hidden w-64 shrink-0 lg:block">
          <div className="sticky top-28">
            <NavLinks items={navItems} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-8">{children}</main>
      </div>

      <footer className="app-footer no-print border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-4">
          <p className="text-base text-muted-foreground">
            {t('copyright', { year: new Date().getFullYear(), shopName: shop.name })}
          </p>
          <Link
            href="/policy"
            className="inline-flex min-h-tap items-center rounded-lg text-base font-semibold text-primary-strong underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
          >
            {t('rules')}
          </Link>
        </div>
      </footer>
    </div>
  );
}
