'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CircleCheck, CircleAlert, LogIn, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { BigCheckbox } from '@/components/ui/misc';
import { PasswordFields, passwordReady } from '@/components/forms/password-fields';
import { completeSetupAction } from './actions';

/**
 * The first-run form: three short sections on one page — the setup code the
 * installer gave, the shop's details, and the owner's own account.
 */
export function SetupForm() {
  const t = useTranslations('setup');
  const tRoot = useTranslations();
  const tset = useTranslations('settings');
  const tu = useTranslations('users');

  const [code, setCode] = React.useState('');
  const [shopName, setShopName] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [ownerName, setOwnerName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [starterServices, setStarterServices] = React.useState(true);

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const err = (field: string) => (errors[field] ? tRoot(errors[field] as never) : null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setBanner(null);
    startTransition(async () => {
      const result = await completeSetupAction({
        code,
        shopName,
        address,
        phone,
        ownerName,
        username,
        password,
        starterServices,
      });
      if (result.ok) {
        setDone(true);
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setBanner(result.messageKey ?? 'common.unknownError');
    });
  }

  if (done) {
    return (
      <div className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary-tint text-primary-strong">
          <CircleCheck aria-hidden className="size-8" />
        </span>
        <h2 className="text-2xl">{t('doneTitle')}</h2>
        <p className="text-lg text-muted-foreground">{t('doneBody', { username })}</p>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/login">
            <LogIn aria-hidden />
            <span>{t('goToLogin')}</span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6" noValidate>
      {banner ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border-2 border-destructive bg-destructive-tint p-4"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-6 shrink-0 text-destructive" />
          <p className="text-lg font-semibold text-destructive">{tRoot(banner as never)}</p>
        </div>
      ) : null}

      <Section step={1} title={t('codeSection')} hint={t('codeHint')}>
        <Field label={t('code')} htmlFor="setup-code" error={err('code')}>
          <Input
            id="setup-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>
      </Section>

      <Section step={2} title={t('shopSection')}>
        <Field label={tset('shopName')} htmlFor="setup-shop" error={err('shopName')}>
          <Input id="setup-shop" value={shopName} onChange={(e) => setShopName(e.target.value)} />
        </Field>
        <Field label={tset('shopAddress')} htmlFor="setup-address" error={err('address')}>
          <Textarea
            id="setup-address"
            className="min-h-[5.5rem]"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </Field>
        <Field label={tset('shopPhone')} htmlFor="setup-phone" error={err('phone')}>
          <Input
            id="setup-phone"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
      </Section>

      <Section step={3} title={t('ownerSection')} hint={t('ownerHint')}>
        <Field label={tu('name')} htmlFor="setup-owner" error={err('ownerName')}>
          <Input id="setup-owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </Field>
        <Field label={tu('username')} htmlFor="setup-username" error={err('username')}>
          <Input
            id="setup-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>
        <PasswordFields
          idPrefix="setup"
          password={password}
          confirm={confirm}
          onPasswordChange={setPassword}
          onConfirmChange={setConfirm}
        />
      </Section>

      <BigCheckbox
        id="setup-starter"
        checked={starterServices}
        onCheckedChange={setStarterServices}
        label={t('starterServices')}
      />

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending || !passwordReady(password, confirm)}
      >
        <Rocket aria-hidden />
        <span>{pending ? t('working') : t('submit')}</span>
      </Button>
    </form>
  );
}

/**
 * One part of the form. Numbered because it really is a sequence the owner
 * goes through in order: code, shop, account.
 */
function Section({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="num flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-lg text-card"
        >
          {step}
        </span>
        <div>
          {/* The legend above carries the title for screen readers. */}
          <p aria-hidden className="font-display text-xl font-bold leading-9">
            {title}
          </p>
          {hint ? <p className="text-base text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      {children}
    </fieldset>
  );
}
