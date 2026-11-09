'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WIZARD_STEPS, type WizardStep } from './wizard-types';

const STEP_LABEL_KEYS: Record<WizardStep, string> = {
  customer: 'stepCustomer',
  vehicle: 'stepVehicle',
  services: 'stepServices',
  parts: 'stepParts',
  charges: 'stepCharges',
  payment: 'stepPayment',
  review: 'stepReview',
};

/**
 * Progress indicator: "STEP 3 OF 7" as a small line above the step's name,
 * so the name gets the full width and never has to fight the counter, then a
 * bar of seven segments — done in ink, the current one in orange, the rest
 * grey. The full list of step names appears once there is room for it.
 */
export function Stepper({ current }: { current: WizardStep }) {
  const t = useTranslations('wizard');
  const index = WIZARD_STEPS.indexOf(current);
  const total = WIZARD_STEPS.length;

  return (
    <div className="space-y-3">
      <div>
        <p className="eyebrow">{t('stepOf', { current: index + 1, total })}</p>
        {/* The page's h1 ("Record a new job") is for screen readers; this is
            the heading people see, sized like one. */}
        <h2 className="mt-0.5 text-3xl font-bold leading-[1.1]">{t(STEP_LABEL_KEYS[current] as never)}</h2>
      </div>

      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
        aria-label={t('stepOf', { current: index + 1, total })}
      >
        {WIZARD_STEPS.map((step, i) => (
          <span
            key={step}
            className={cn(
              'h-2.5 flex-1 rounded-full transition-colors',
              i < index ? 'bg-foreground' : i === index ? 'bg-primary' : 'bg-border',
            )}
          />
        ))}
      </div>

      {/* Full labels once there is room for them. */}
      <ol className="hidden flex-wrap gap-x-5 gap-y-1 text-base text-muted-foreground lg:flex">
        {WIZARD_STEPS.map((step, i) => (
          <li
            key={step}
            className={cn(
              'flex items-center gap-1.5',
              i === index && 'font-bold text-primary-strong',
              i < index && 'text-foreground',
            )}
          >
            {i < index ? <Check className="size-5" aria-hidden /> : null}
            {t(STEP_LABEL_KEYS[step] as never)}
          </li>
        ))}
      </ol>
    </div>
  );
}
