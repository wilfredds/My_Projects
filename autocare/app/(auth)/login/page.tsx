import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Rocket, MapPin, Phone } from 'lucide-react';
import { getShopInfo } from '@/lib/settings';
import { prisma } from '@/lib/prisma';
import { setupState } from '@/lib/setup';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/app-shell/language-switcher';
import { ShopMark } from '@/components/app-shell/shop-mark';
import { ShopLogo } from '@/components/app-shell/shop-logo';
import { LoginForm } from './login-form';

export const metadata = { title: 'Login — AutoCare' };

/**
 * Sign-in. On a wide screen it is two panels: the shop's own brand on the
 * dark "meter" panel, and the form. On a phone the brand is a short band at
 * the top and the form follows. It is the first screen anyone sees, so it is
 * the shop's — its logo, its name, its colour — with AutoCare credited small.
 */
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
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ------------------------------------------------------ brand panel */}
      {/* Pinned to the screen on wide layouts, so the shop's name stays in view
          however long the form beside it grows. */}
      <section className="relative overflow-hidden bg-[hsl(var(--meter))] text-white lg:sticky lg:top-0 lg:h-screen">
        {/* The shop's colour as a single band, like the trim on a pump. */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-primary" />
        <div className="relative flex h-full flex-col gap-6 px-6 pb-7 pt-8 sm:px-10 lg:px-14 lg:py-14">
          <div className="flex items-center gap-4">
            <ShopLogo name={shop.name} logo={shop.logo} className="size-14 text-xl lg:size-16" />
            <p className="eyebrow !text-[hsl(var(--meter-label))]">AutoCare</p>
          </div>

          <div className="space-y-4 lg:mt-auto">
            <p className="font-display text-4xl font-bold uppercase leading-[1.02] tracking-wide [text-wrap:balance] lg:text-6xl">
              <ShopMark name={shop.name} accentClassName="text-[hsl(var(--meter-accent))]" />
            </p>
            <p className="max-w-md text-lg text-[hsl(var(--meter-label))] lg:text-xl">{t('tagline')}</p>
          </div>

          {shop.address || shop.phone ? (
            <ul className="hidden space-y-2 text-base text-[hsl(var(--meter-label))] lg:block">
              {shop.address ? (
                <li className="flex items-start gap-3">
                  <MapPin aria-hidden className="mt-0.5 size-5 shrink-0" />
                  <span>{shop.address}</span>
                </li>
              ) : null}
              {shop.phone ? (
                <li className="flex items-center gap-3">
                  <Phone aria-hidden className="size-5 shrink-0" />
                  <span className="num">{shop.phone}</span>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------- form panel */}
      <section className="flex flex-col">
        <header className="flex justify-end p-4">
          <LanguageSwitcher signedIn={false} />
        </header>

        <main className="flex flex-1 items-center justify-center px-4 pb-10 pt-2 sm:px-8">
          <div className="w-full max-w-md space-y-8">
            {setup !== 'done' ? (
              // A brand-new install: there is nobody to log in as yet.
              <div className="space-y-3 rounded-2xl border-2 border-primary bg-primary-tint p-5">
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

            <div className="space-y-2">
              <h1>{t('title')}</h1>
              <p className="text-lg text-muted-foreground">{t('subtitle')}</p>
            </div>

            <LoginForm nextPath={nextPath} />

            <p className="text-base text-muted-foreground">{t('footerNote', { shopName: shop.name })}</p>
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-border px-4 py-3 text-base text-muted-foreground sm:px-8">
          <span>{tf('poweredBy')}</span>
          <Link
            href="/policy"
            className="inline-flex min-h-tap items-center rounded-lg font-semibold text-primary-strong underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
          >
            {tf('rules')}
          </Link>
        </footer>
      </section>
    </div>
  );
}
