import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ShieldCheck, ArrowLeft, CircleCheck } from 'lucide-react';
import { getShopInfo } from '@/lib/settings';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/utils';
import { intlTagFor } from '@/i18n/locales';
import { LanguageSwitcher } from '@/components/app-shell/language-switcher';
import { ShopMark } from '@/components/app-shell/shop-mark';
import { Button } from '@/components/ui/button';
import { PolicyAcknowledgement } from './acknowledgement';

export const metadata = { title: 'Rules of Use — AutoCare' };

/**
 * The Acceptable Use Policy.
 *
 * Reachable by anyone from the footer, and shown as a gate on a user's very
 * first login (middleware redirects here until `policyAcceptedAt` is set).
 */
export default async function PolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ first?: string }>;
}) {
  const params = await searchParams;
  const [shop, t, tnav, tlogin, user] = await Promise.all([
    getShopInfo(),
    getTranslations('policy'),
    getTranslations('nav'),
    getTranslations('login'),
    getSessionUser(),
  ]);

  const acceptedAt = user
    ? (
        await prisma.user.findUnique({
          where: { id: user.id },
          select: { policyAcceptedAt: true },
        })
      )?.policyAcceptedAt
    : null;

  const mustAcknowledge = Boolean(user) && !acceptedAt;
  const showGate = mustAcknowledge || params.first === '1';

  const rules = [1, 2, 3, 4, 5] as const;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-t-4 border-b-border border-t-primary bg-card p-4">
        <span className="font-display text-xl font-bold uppercase tracking-wide">
          <ShopMark name={shop.name} />
        </span>
        <LanguageSwitcher signedIn={Boolean(user)} />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="space-y-8 rounded-2xl border border-border bg-card p-5 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-strong">
              <ShieldCheck className="size-9" aria-hidden />
            </span>
            <div className="space-y-2">
              <h1>{t('title')}</h1>
              <p className="text-lg text-muted-foreground">{t('subtitle')}</p>
            </div>
          </div>

          <p className="text-lg">{t('intro', { shopName: shop.name })}</p>

          <ol className="space-y-6">
            {rules.map((n) => (
              <li key={n} className="border-t border-border pt-5 first:border-t-0 first:pt-0">
                <h2 className="flex items-start gap-3 text-xl font-bold">
                  <span
                    aria-hidden
                    className="num flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-lg text-card"
                  >
                    {n}
                  </span>
                  <span>{t(`rule${n}Title` as never)}</span>
                </h2>
                <p className="mt-3 text-lg leading-relaxed">{t(`rule${n}Body` as never)}</p>
              </li>
            ))}
          </ol>

          {showGate && user ? (
            <PolicyAcknowledgement alreadyAccepted={Boolean(acceptedAt)} />
          ) : (
            <div className="space-y-4">
              {acceptedAt ? (
                <p className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-lg font-semibold">
                  <CircleCheck aria-hidden className="mt-0.5 size-6 shrink-0" />
                  <span>
                    {t('acceptedOn', {
                      date: formatDate(acceptedAt, intlTagFor(user?.locale ?? 'fil')),
                    })}
                  </span>
                </p>
              ) : null}
              <Button asChild variant="outline" size="lg">
                <Link href={user ? '/dashboard' : '/login'}>
                  <ArrowLeft aria-hidden />
                  <span>{user ? tnav('dashboard') : tlogin('title')}</span>
                </Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
