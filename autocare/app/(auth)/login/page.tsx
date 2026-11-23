import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Rocket } from 'lucide-react';
import { getShopInfo } from '@/lib/settings';
import { prisma } from '@/lib/prisma';
import { setupState } from '@/lib/setup';
import { Button } from '@/components/ui/button';
import { ShopLogo } from '@/components/app-shell/shop-logo';
import { LanguageSwitcher } from '@/components/app-shell/language-switcher';
import { ShopMark } from '@/components/app-shell/shop-mark';
import { LoginForm } from './login-form';

export const metadata = { title: 'Login — AutoCare' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const [shop, t, tf, setup] = await Promise.all([
    getShopInfo(),
    getTranslations('login'),
    getTranslations('footer'),
    setupState(prisma),
  ]);

  // Only allow same-origin relative paths as a post-login destination.
  const nextPath =
    params.next && params.next.startsWith('/') && !params.next.startsWith('//')
      ? params.next
      : '/dashboard';

  return (
    <div className="flex min-h-screen flex-col border-t-4 border-primary bg-background">
      <header className="flex justify-end p-4">
        <LanguageSwitcher signedIn={false} />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg space-y-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
          {setup !== 'done' ? (
            // A brand-new install: there is nobody to log in as yet.
            <div className="space-y-3 rounded-xl border-2 border-primary bg-primary-tint p-4">
              <p className="text-lg font-semibold">{t('setupTitle')}</p>
              <p className="text-base">{t('setupBody')}</p>
              <Button asChild size="compact">
                <Link href="/setup">
                  <Rocket aria-hidden />
                  <span>{t('setupButton')}</span>
                </Link>
              </Button>
            </div>
          ) : null}

          <div className="space-y-3">
            {shop.logo ? <ShopLogo name={shop.name} logo={shop.logo} className="size-16" /> : null}
            <h1 className="text-4xl font-bold uppercase leading-[1.05] tracking-wide">
              <ShopMark name={shop.name} />
            </h1>
            <p className="text-lg text-muted-foreground">{t('subtitle')}</p>
          </div>

          <LoginForm nextPath={nextPath} />

          <p className="text-center text-base text-muted-foreground">
            {t('footerNote', { shopName: shop.name })}
          </p>
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-center gap-4 p-4 text-base text-muted-foreground">
        <span>{tf('copyright', { year: new Date().getFullYear(), shopName: shop.name })}</span>
        <Link
          href="/policy"
          className="inline-flex min-h-tap items-center rounded-lg px-3 font-semibold text-primary-strong underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
        >
          {tf('rules')}
        </Link>
      </footer>
    </div>
  );
}
