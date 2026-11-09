'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Globe, Check } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { locales } from '@/i18n/locales';
import { cn } from '@/lib/utils';
import { setLocaleAction } from '@/app/actions/locale';

/**
 * Language switcher.
 *
 * Each language is shown in its OWN script ("Filipino", "日本語", "中文") so a
 * speaker can find their language without being able to read the current one.
 * The choice is written to a cookie AND, when signed in, to the User record, so
 * it survives a new device.
 */
export function LanguageSwitcher({ signedIn }: { signedIn: boolean }) {
  const current = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const currentDef = locales.find((l) => l.code === current) ?? locales[0];

  function choose(code: string) {
    if (code === current) return;
    startTransition(async () => {
      await setLocaleAction(code, signedIn);
      router.refresh();
    });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        disabled={pending}
        aria-label={t('language')}
        className={cn(
          'inline-flex min-h-tap items-center gap-3 rounded-lg border-2 border-input bg-card',
          'px-4 py-2 text-base font-semibold hover:bg-accent',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
          pending && 'opacity-60',
        )}
      >
        <Globe className="size-6" aria-hidden />
        <span>{currentDef.nativeName}</span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[16rem] rounded-xl border border-border bg-popover p-2 shadow-xl"
        >
          <DropdownMenu.Label className="px-4 py-2 text-base font-semibold text-muted-foreground">
            {t('language')}
          </DropdownMenu.Label>
          {locales.map((locale) => (
            <DropdownMenu.Item
              key={locale.code}
              onSelect={() => choose(locale.code)}
              className={cn(
                'flex min-h-tap cursor-pointer items-center gap-3 rounded-md px-4 py-3 text-lg outline-none',
                'focus:bg-accent focus:text-accent-foreground',
              )}
            >
              <span className="flex size-6 items-center justify-center">
                {locale.code === current ? <Check className="size-6" aria-hidden /> : null}
              </span>
              <span className="font-semibold">{locale.nativeName}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
