'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarClock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';
import { intlTagFor } from '@/i18n/locales';
import {
  REMINDER_MONTHS,
  shortestInterval,
  type IntervalSource,
  type NextVisit,
  type ReminderChoice,
} from '@/lib/reminders';

/**
 * "Kailan po babalik?" — when the car is due back.
 *
 * Normally nothing needs doing here: the catalog knows that a change oil comes
 * back in 3 months or 5,000 km, so the date is already filled in from the
 * services chosen ("Batay sa serbisyo"). The owner can pick another interval,
 * or none, with one tap. Whatever is shown is exactly what prints on the
 * receipt.
 */
export function NextVisitCard({
  plan,
  choice,
  onChoice,
  services,
  canKeep = false,
}: {
  plan: NextVisit;
  choice: ReminderChoice;
  onChoice: (choice: ReminderChoice) => void;
  /** The services on the job, with their catalog intervals. */
  services: (IntervalSource & { name: string })[];
  /** Editing a job that already has a next visit: offer to leave it as it is. */
  canKeep?: boolean;
}) {
  const t = useTranslations('wizard');
  const tag = intlTagFor(useLocale());
  const km = (n: number) => new Intl.NumberFormat(tag).format(n);

  const interval = shortestInterval(services);
  const hasBasis = interval.months !== null || interval.km !== null;
  const basis = services.filter((s) => s.remindAfterMonths || s.remindAfterKm).map((s) => s.name);

  const options: { value: ReminderChoice; label: string }[] = [
    ...(canKeep ? [{ value: 'keep' as const, label: t('reminderKeep') }] : []),
    ...(hasBasis ? [{ value: 'auto' as const, label: t('reminderAuto') }] : []),
    ...REMINDER_MONTHS.map((m) => ({
      value: String(m) as ReminderChoice,
      label: m === 12 ? t('reminderYear') : t('reminderMonths', { count: m }),
    })),
    { value: 'none', label: t('reminderNone') },
  ];

  // With no services that repeat, "auto" means nothing — show it as "none".
  const selected: ReminderChoice = choice === 'auto' && !hasBasis ? 'none' : choice;

  return (
    <section
      aria-labelledby="next-visit-title"
      className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-surface"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-strong">
          <CalendarClock className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <h3 id="next-visit-title">{t('nextVisitTitle')}</h3>
          <p className="text-base text-muted-foreground">{t('nextVisitHint')}</p>
        </div>
      </div>

      <div aria-live="polite" className="rounded-xl bg-muted px-4 py-3">
        {plan.on || plan.km ? (
          <>
            <p className="text-xl font-bold" data-testid="next-visit-summary">
              {plan.on ? formatDate(`${plan.on}T00:00:00`, tag) : t('nextVisitKmOnly', { km: km(plan.km!) })}
            </p>
            {plan.on && plan.km ? (
              <p className="text-lg text-muted-foreground">{t('nextVisitOrKm', { km: km(plan.km) })}</p>
            ) : null}
            {selected === 'auto' && basis.length > 0 ? (
              <p className="mt-1 text-base text-muted-foreground">
                {t('nextVisitBasis', { services: basis.join(', ') })}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-xl font-bold" data-testid="next-visit-summary">
            {t('reminderNone')}
          </p>
        )}
        {!hasBasis && choice === 'auto' ? (
          <p className="mt-1 text-base text-muted-foreground">{t('nextVisitNoBasis')}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3" role="group" aria-label={t('nextVisitTitle')}>
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <Button
              key={option.value}
              variant="outline"
              onClick={() => onChoice(option.value)}
              aria-pressed={active}
              className={cn(active && 'border-primary bg-primary-tint hover:bg-primary-tint')}
            >
              <span>{option.label}</span>
              {active ? <Check aria-hidden strokeWidth={3} className="text-primary-strong" /> : null}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
