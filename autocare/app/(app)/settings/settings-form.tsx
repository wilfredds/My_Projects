'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Save, Store, Languages, Palette, ImageUp, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ShopLogo } from '@/components/app-shell/shop-logo';
import { locales } from '@/i18n/locales';
import { ACCENTS, ACCENT_SWATCH, type Accent } from '@/lib/branding';
import { cn } from '@/lib/utils';
import {
  saveShopSettingsAction,
  saveMyLocaleAction,
  saveAccentAction,
  saveShopLogoAction,
} from './actions';

interface ShopValues {
  name: string;
  address: string;
  phone: string;
  email: string;
  footer: string;
  tin: string;
}

/** Longest side of the stored logo. Big enough for a crisp receipt header. */
const LOGO_SIDE = 320;

/**
 * Turn whatever image the owner picked into a small PNG data URL in the
 * browser, so a 4 MB phone photo never leaves the phone. The server checks
 * the result again (lib/logo.ts).
 */
async function toLogoDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('unreadable'));
      el.src = url;
    });
    const scale = Math.min(1, LOGO_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SettingsForm({
  shop,
  accent: savedAccent,
  logo: savedLogo,
  myLocale,
}: {
  shop: ShopValues;
  accent: Accent;
  logo: string | null;
  myLocale: string;
}) {
  const t = useTranslations('settings');
  const tr = useTranslations('receipt');
  const tcom = useTranslations('common');
  const tRoot = useTranslations();
  const router = useRouter();

  const [values, setValues] = React.useState<ShopValues>(shop);
  const [accent, setAccent] = React.useState<Accent>(savedAccent);
  const [logo, setLogo] = React.useState<string | null>(savedLogo);
  const [locale, setLocale] = React.useState(myLocale);
  const [pending, startTransition] = React.useTransition();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const set = (key: keyof ShopValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

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

  function chooseAccent(next: Accent) {
    if (next === accent) return;
    const previous = accent;
    setAccent(next);
    // Show the new colour immediately; the server confirms a moment later.
    document.documentElement.dataset.accent = next;
    startTransition(async () => {
      const result = await saveAccentAction(next);
      if (!result.ok) {
        setAccent(previous);
        document.documentElement.dataset.accent = previous;
        toast.error(tcom('unknownError'));
        return;
      }
      toast.success(t('accentSaved'));
      router.refresh();
    });
  }

  async function pickLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    let dataUrl: string;
    try {
      dataUrl = await toLogoDataUrl(file);
    } catch {
      toast.error(t('logoError_format'));
      return;
    }
    startTransition(async () => {
      const result = await saveShopLogoAction(dataUrl);
      if (!result.ok) {
        toast.error(tRoot(result.messageKey as never));
        return;
      }
      setLogo(dataUrl);
      toast.success(t('logoSaved'));
      router.refresh();
    });
  }

  function removeLogo() {
    startTransition(async () => {
      const result = await saveShopLogoAction(null);
      if (!result.ok) {
        toast.error(tcom('unknownError'));
        return;
      }
      setLogo(null);
      toast.success(t('logoRemoved'));
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
      {/* ---------------------------------------------------------- branding */}
      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-3">
          <Palette className="size-7 text-muted-foreground" aria-hidden />
          {t('brandSection')}
        </h2>
        <p className="mt-2 text-lg text-muted-foreground">{t('brandHint')}</p>

        <div className="mt-6 space-y-3">
          <p className="text-lg font-semibold">{t('logo')}</p>
          <div className="flex flex-wrap items-center gap-4">
            <ShopLogo name={values.name || shop.name} logo={logo} className="size-20 text-2xl" />
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={pickLogo}
              />
              <Button type="button" variant="outline" disabled={pending} onClick={() => fileRef.current?.click()}>
                <ImageUp aria-hidden />
                <span>{t('logoChoose')}</span>
              </Button>
              {logo ? (
                <Button type="button" variant="ghost" disabled={pending} onClick={removeLogo}>
                  <Trash2 aria-hidden />
                  <span>{t('logoRemove')}</span>
                </Button>
              ) : null}
            </div>
          </div>
          <p className="text-base text-muted-foreground">{t('logoHint')}</p>
        </div>

        <fieldset className="mt-8 space-y-3">
          <legend className="text-lg font-semibold">{t('accent')}</legend>
          <p className="text-base text-muted-foreground">{t('accentHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ACCENTS.map((option) => {
              const active = option === accent;
              const swatch = ACCENT_SWATCH[option];
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  disabled={pending}
                  onClick={() => chooseAccent(option)}
                  className={cn(
                    'flex min-h-tap items-center gap-4 rounded-2xl border-2 px-4 py-3 text-left',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
                    active ? 'border-primary bg-primary-tint' : 'border-border bg-card hover:border-input',
                  )}
                >
                  {/* A little preview: the button colour, and the ₱ as the meter shows it. */}
                  <span aria-hidden className="flex shrink-0 items-center gap-1.5">
                    <span className="size-9 rounded-full" style={{ background: swatch.fill }} />
                    <span className="flex h-9 items-center rounded-lg bg-[hsl(var(--meter-window))] px-2 font-display text-lg font-bold">
                      <span style={{ color: swatch.meter }}>₱</span>
                    </span>
                  </span>
                  <span className="flex-1 text-lg font-semibold">{t(`accent_${option}` as never)}</span>
                  {active ? <Check aria-hidden strokeWidth={3} className="size-6 text-primary-strong" /> : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      </Card>

      {/* ------------------------------------------------------ shop details */}
      <Card className="p-5 sm:p-6">
        <h2 className="mb-6 flex items-center gap-3">
          <Store className="size-7 text-muted-foreground" aria-hidden />
          {t('shopSection')}
        </h2>

        <form onSubmit={saveShop} className="space-y-5">
          <Field label={t('shopName')} htmlFor="st-name">
            <Input id="st-name" value={values.name} onChange={set('name')} />
          </Field>

          <Field label={t('shopAddress')} htmlFor="st-address">
            <Textarea id="st-address" className="min-h-[6rem]" value={values.address} onChange={set('address')} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('shopPhone')} htmlFor="st-phone">
              <Input id="st-phone" inputMode="tel" value={values.phone} onChange={set('phone')} />
            </Field>
            <Field label={t('shopEmail')} hint={tcom('optional')} htmlFor="st-email">
              <Input id="st-email" type="email" value={values.email} onChange={set('email')} />
            </Field>
          </div>

          <Field label={t('shopTin')} hint={tcom('optional')} htmlFor="st-tin">
            <Input
              id="st-tin"
              inputMode="numeric"
              placeholder="000-000-000-000"
              value={values.tin}
              onChange={set('tin')}
            />
          </Field>

          <Field label={t('receiptFooter')} hint={tcom('optional')} htmlFor="st-footer">
            <Input id="st-footer" value={values.footer} onChange={set('footer')} />
          </Field>

          {/* Live preview of the receipt header, so the owner sees the effect. */}
          <div className="rounded-2xl border-2 border-dashed border-border bg-background p-5">
            <p className="mb-4 text-base font-semibold text-muted-foreground">{t('preview')}</p>
            <div className="flex flex-col items-center gap-2 border-b-4 border-foreground pb-4 text-center">
              <ShopLogo name={values.name || shop.name} logo={logo} className="size-14" />
              <p className="font-display text-2xl font-bold uppercase tracking-wide">{values.name}</p>
              <p className="whitespace-pre-wrap text-base">{values.address}</p>
              <p className="text-base">{values.phone}</p>
              {values.email ? <p className="text-base">{values.email}</p> : null}
              {values.tin ? (
                <p className="text-base">
                  {tr('tin')}: {values.tin}
                </p>
              ) : null}
            </div>
          </div>

          <Button type="submit" size="lg" disabled={pending}>
            <Save aria-hidden />
            <span>{pending ? tcom('saving') : tcom('save')}</span>
          </Button>
        </form>
      </Card>

      {/* --------------------------------------------------------- language */}
      <Card className="p-5 sm:p-6">
        <h2 className="mb-6 flex items-center gap-3">
          <Languages className="size-7 text-muted-foreground" aria-hidden />
          {t('mySection')}
        </h2>

        <Field label={t('myLanguage')}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {locales.map((option) => {
              const active = locale === option.code;
              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => saveLocale(option.code)}
                  aria-pressed={active}
                  disabled={pending}
                  className={cn(
                    'flex min-h-tap items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-lg font-semibold',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
                    active ? 'border-primary bg-primary-tint' : 'border-border bg-card hover:border-input',
                  )}
                >
                  {active ? <Check aria-hidden strokeWidth={3} className="size-5 text-primary-strong" /> : null}
                  {option.nativeName}
                </button>
              );
            })}
          </div>
        </Field>
      </Card>
    </div>
  );
}
