'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { loginAction, type LoginState } from './actions';

export function LoginForm({ nextPath }: { nextPath: string }) {
  const t = useTranslations('login');
  const tc = useTranslations('common');
  const router = useRouter();

  const [state, setState] = React.useState<LoginState>({});
  const [showPassword, setShowPassword] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  /**
   * The action returns a message-catalog key plus any interpolation values
   * (e.g. how many minutes an account stays locked). The key is known only at
   * runtime, so it is resolved through a loosened signature here.
   */
  const translateError = (key: string, values?: Record<string, string | number>) =>
    (t as unknown as (k: string, v?: Record<string, string | number>) => string)(
      key.replace(/^login\./, ''),
      values,
    );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await loginAction(state, formData);
      setState(result);
      if (!result.error) {
        // A full navigation so the new session cookie is picked up everywhere.
        router.replace(nextPath);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border-2 border-destructive bg-destructive-tint p-4"
        >
          <AlertCircle className="mt-0.5 size-7 shrink-0 text-destructive" aria-hidden />
          <div className="space-y-1">
            {/* One message, whatever went wrong. A per-account attempt counter
                here would tell an attacker which usernames are real. */}
            <p className="text-lg font-semibold text-destructive">
              {translateError(state.error, state.values)}
            </p>
          </div>
        </div>
      ) : null}

      <Field label={t('username')} htmlFor="username">
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          disabled={pending}
          aria-invalid={Boolean(state.error)}
        />
      </Field>

      <Field label={t('password')} htmlFor="password">
        <div className="space-y-3">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            disabled={pending}
            aria-invalid={Boolean(state.error)}
          />
          {/* A labelled toggle, not a tiny eye icon on its own. */}
          <Button
            variant="outline"
            size="compact"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            <span>{showPassword ? t('hidePassword') : t('showPassword')}</span>
          </Button>
        </div>
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        <LogIn aria-hidden />
        <span>{pending ? tc('loading') : t('submit')}</span>
      </Button>
    </form>
  );
}
