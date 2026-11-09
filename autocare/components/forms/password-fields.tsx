'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { checkPassword } from '@/lib/password';
import { cn } from '@/lib/utils';

/**
 * Password entry with a live rules checklist.
 *
 * The checklist is guidance, not enforcement: `passwordSchema` re-validates the
 * same five rules on the server before anything is written.
 */
export function PasswordFields({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  label,
  idPrefix,
}: {
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  label?: string;
  idPrefix: string;
}) {
  const t = useTranslations('users');

  const check = checkPassword(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  const rules = [
    { ok: check.length, label: t('ruleLength') },
    { ok: check.upper, label: t('ruleUpper') },
    { ok: check.lower, label: t('ruleLower') },
    { ok: check.number, label: t('ruleNumber') },
    { ok: check.symbol, label: t('ruleSymbol') },
  ];

  return (
    <div className="space-y-5">
      <Field label={label ?? t('password')} htmlFor={`${idPrefix}-password`}>
        <Input
          id={`${idPrefix}-password`}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
        />
      </Field>

      <Field
        label={t('confirmPassword')}
        htmlFor={`${idPrefix}-confirm`}
        error={mismatch ? t('passwordMismatch') : null}
      >
        <Input
          id={`${idPrefix}-confirm`}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => onConfirmChange(e.target.value)}
          aria-invalid={mismatch}
        />
      </Field>

      <div className="rounded-2xl border border-border bg-background p-4">
        <p className="mb-3 text-base font-bold">{t('passwordRules')}</p>
        <ul className="space-y-2">
          {rules.map((rule) => (
            <li key={rule.label} className="flex items-center gap-3 text-base">
              <span
                aria-hidden
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full',
                  rule.ok ? 'bg-foreground text-card' : 'border-2 border-input bg-card text-muted-foreground',
                )}
              >
                {rule.ok ? <Check className="size-5" /> : <X className="size-5" />}
              </span>
              <span className={rule.ok ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                {rule.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** True when the password satisfies every rule and matches the confirmation. */
export function passwordReady(password: string, confirm: string): boolean {
  return checkPassword(password).valid && password === confirm;
}
