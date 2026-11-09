'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { formatPeso, type JobTotals } from '@/lib/calc';
import { intlTagFor } from '@/i18n/locales';
import { cn } from '@/lib/utils';
import { Meter, MeterAmount } from '@/components/ui/meter';

/**
 * The running total, pinned to the bottom of every wizard step — drawn as the
 * meter (see components/ui/meter.tsx).
 *
 * It is a read-only display — there is no input here and no way to type a
 * total. The figure comes straight from `computeJobTotals`, the same function
 * the server uses when it saves.
 */
export function TotalBar({ totals, className }: { totals: JobTotals; className?: string }) {
  const t = useTranslations('wizard');
  const tj = useTranslations('job');
  const tag = intlTagFor(useLocale());

  /**
   * Re-trigger the tick whenever the total actually changes.
   *
   * The point is confirmation, not decoration: the owner taps "Carwash" and
   * the number visibly rolls over, so he knows it registered without having
   * to compare figures. Keying the element on the value restarts the CSS
   * animation; `prefers-reduced-motion` flattens it to nothing.
   */
  const [pulseKey, setPulseKey] = React.useState(0);
  const previous = React.useRef(totals.total);
  React.useEffect(() => {
    if (previous.current !== totals.total) {
      previous.current = totals.total;
      setPulseKey((n) => n + 1);
    }
  }, [totals.total]);

  const details: { label: string; value: string }[] = [];
  if (totals.discount > 0) {
    details.push({ label: tj('subtotal'), value: formatPeso(totals.subtotal, tag) });
    details.push({ label: tj('discount'), value: `−${formatPeso(totals.discount, tag)}` });
  }
  if (totals.amountPaid > 0) {
    details.push({ label: tj('amountPaid'), value: formatPeso(totals.amountPaid, tag) });
    details.push({ label: tj('balance'), value: formatPeso(totals.balance, tag) });
  }

  return (
    <div className={cn('total-bar -mx-4 mt-8 px-4 pb-2 pt-2 sm:mx-0 sm:px-0', className)}>
      <Meter
        compact
        label={t('grandTotal')}
        details={details}
        amountSlot={
          /* Read-only by construction: rendered text, never an input. */
          <output
            key={pulseKey}
            aria-live="polite"
            aria-atomic="true"
            className={cn('block', pulseKey > 0 && 'animate-total-bump')}
          >
            <MeterAmount amount={formatPeso(totals.total, tag)} />
          </output>
        }
      />
    </div>
  );
}
