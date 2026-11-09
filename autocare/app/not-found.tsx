import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SearchX, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Friendly 404 — no codes, no stack traces. */
export default async function NotFound() {
  const t = await getTranslations('errors');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
        <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SearchX className="size-11" aria-hidden />
        </span>
        <h1>{t('notFound')}</h1>
        <p className="text-lg text-muted-foreground">{t('notFoundBody')}</p>
        <Button asChild size="lg" className="w-full">
          <Link href="/dashboard">
            <Home aria-hidden />
            <span>{t('backHome')}</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
