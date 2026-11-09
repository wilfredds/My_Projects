'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The global error screen.
 *
 * The user is shown a plain sentence and a button — never the message, the
 * stack, or the digest. The real error still reaches the server logs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  React.useEffect(() => {
    console.error('[ui] rendered error boundary', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
        <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-11" aria-hidden />
        </span>
        <h1>{t('serverError')}</h1>
        <p className="text-lg text-muted-foreground">{t('serverErrorBody')}</p>
        <Button size="lg" className="w-full" onClick={reset}>
          <RotateCcw aria-hidden />
          <span>{t('tryAgain')}</span>
        </Button>
      </div>
    </div>
  );
}
