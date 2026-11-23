import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { KeyRound } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { setupState } from '@/lib/setup';
import { LanguageSwitcher } from '@/components/app-shell/language-switcher';
import { SetupForm } from './setup-form';

export const metadata = { title: 'Set up — AutoCare' };
export const dynamic = 'force-dynamic';

/**
 * First-run setup of a new shop's install. Exists only until the first
 * account is created; after that it is a 404 (see lib/setup.ts).
 */
export default async function SetupPage() {
  const state = await setupState(prisma);
  if (state === 'done') notFound();

  const t = await getTranslations('setup');

  return (
    <div className="flex min-h-screen flex-col border-t-4 border-primary bg-background">
      <header className="flex items-center justify-between gap-4 p-4">
        <span className="font-display text-xl font-bold tracking-wide">AutoCare</span>
        <LanguageSwitcher signedIn={false} />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-4">
        <div className="space-y-2">
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1 className="text-4xl">{t('title')}</h1>
          <p className="text-lg text-muted-foreground">{t('subtitle')}</p>
        </div>

        {state === 'needs-code' ? (
          <div className="mt-8 flex items-start gap-4 rounded-2xl border border-border bg-card p-6">
            <KeyRound aria-hidden className="mt-1 size-7 shrink-0 text-primary-strong" />
            <div className="space-y-2">
              <h2 className="text-xl">{t('lockedTitle')}</h2>
              <p className="text-lg text-muted-foreground">{t('lockedBody')}</p>
            </div>
          </div>
        ) : (
          <SetupForm />
        )}
      </main>
    </div>
  );
}
