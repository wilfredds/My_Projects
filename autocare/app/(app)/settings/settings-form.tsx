'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Save, Store, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { locales } from '@/i18n/locales';
import { cn } from '@/lib/utils';
import { saveShopSettingsAction, saveMyLocaleAction } from './actions';

interface ShopValues {
  name: string;
  address: string;
  phone: string;
  email: string;
  footer: string;
}

export function SettingsForm({ shop, myLocale }: { shop: ShopValues; myLocale: string }) {
  const t = useTranslations('settings');
  const tcom = useTranslations('common');
  const router = useRouter();

  const [values, setValues] = React.useState<ShopValues>(shop);
  const [locale, setLocale] = React.useState(myLocale);
  const [pending, startTransition] = React.useTransition();

  function saveShop(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveShopSettingsAction(values);
      if (!result.ok) {
        toast.error(tcom('unknownError'));
        return;
      }
      toast.success(t('saved'));
      router.refresh();
    });
  }

  function saveLocale(next: string) {
    setLocale(next);
    startTransition(async () => {
      const result = await saveMyLocaleAction(next);
      if (!result.ok) {
        toast.error(tcom('unknownError'));
        return;
      }
      toast.success(t('saved'));
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <h2 className="mb-6 flex items-center gap-3">
          <Store className="size-7" aria-hidden />
          {t('shopSection')}
        </h2>

        <form onSubmit={saveShop} className="space-y-5">
          <Field label={t('shopName')} htmlFor="st-name">
            <Input
              id="st-name"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            />
          </Field>

          <Field label={t('shopAddress')} htmlFor="st-address">
            <Textarea
              id="st-address"
              className="min-h-[6rem]"
              value={values.address}
              onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('shopPhone')} htmlFor="st-phone">
              <Input
                id="st-phone"
                inputMode="tel"
                value={values.phone}
                onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
              />
            </Field>
            <Field label={t('shopEmail')} hint={tcom('optional')} htmlFor="st-email">
              <Input
                id="st-email"
                type="email"
                value={values.email}
                onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              />
            </Field>
          </div>

          <Field label={t('receiptFooter')} hint={tcom('optional')} htmlFor="st-footer">
            <Input
              id="st-footer"
              value={values.footer}
              onChange={(e) => setValues((v) => ({ ...v, footer: e.target.value }))}
            />
          </Field>

          {/* Live preview of the receipt header, so the owner sees the effect. */}
          <div className="rounded-2xl border-2 border-dashed border-border bg-background p-5">
            <p className="mb-3 text-base font-semibold text-muted-foreground">{t('preview')}</p>
            <div className="border-b-4 border-foreground pb-3 text-center">
              <p className="font-display text-2xl font-bold uppercase tracking-wide">{values.name}</p>
              <p className="whitespace-pre-wrap text-base">{values.address}</p>
              <p className="text-base">{values.phone}</p>
              {values.email ? <p className="text-base">{values.email}</p> : null}
            </div>
          </div>

          <Button type="submit" size="lg" disabled={pending}>
            <Save aria-hidden />
            <span>{pending ? tcom('saving') : tcom('save')}</span>
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="mb-6 flex items-center gap-3">
          <Languages className="size-7" aria-hidden />
          {t('mySection')}
        </h2>

        <Field label={t('myLanguage')}>
          <div className="grid gap-3 sm:grid-cols-3">
            {locales.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => saveLocale(option.code)}
                aria-pressed={locale === option.code}
                disabled={pending}
                className={cn(
                  'flex min-h-tap items-center justify-center rounded-lg border-2 px-4 py-3 text-lg font-semibold',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
                  locale === option.code
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-accent',
                )}
              >
                {option.nativeName}
              </button>
            ))}
          </div>
        </Field>
      </Card>
    </div>
  );
}
