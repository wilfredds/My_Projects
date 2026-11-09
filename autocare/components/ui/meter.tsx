import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The meter — the job's total drawn like the amount window on a fuel pump.
 *
 * HI-OCTEN is a fuel name, and the whole promise of this app is that the
 * total is counted for the owner, never typed by him. So wherever a job's
 * total is shown live, it sits in a dark panel with a recessed window and big
 * white condensed digits, and it ticks when the figure changes. It is the one
 * bold element in the design; everything around it stays quiet.
 *
 * Presentational only (no hooks), so server pages can use it directly. The
 * wizard's TotalBar adds the tick and the live-region on top.
 */

/** Split a formatted amount so the peso sign can be coloured, wherever the
 *  locale puts it ("₱1,670.00", "1670,00 ₱"). Formats without a ₱ (some
 *  locales write "PHP 1,670.00") are shown exactly as formatted. */
export function MeterAmount({ amount, className }: { amount: string; className?: string }) {
  const i = amount.indexOf('₱');
  return (
    <span className={cn('meter-digits', className)}>
      {i === -1 ? (
        amount
      ) : (
        <>
          {amount.slice(0, i)}
          <span className="meter-peso">₱</span>
          {amount.slice(i + 1)}
        </>
      )}
    </span>
  );
}

export function Meter({
  label,
  amount,
  status,
  details,
  className,
  amountSlot,
  compact = false,
}: {
  /** Shown above the digits, e.g. "KABUUAN". */
  label: string;
  /** The formatted total, e.g. "₱1,670.00". Ignored when `amountSlot` is set. */
  amount?: string;
  /** Optional badge shown on the label line (paid / unpaid). */
  status?: React.ReactNode;
  /** The smaller figures under the window: subtotal, discount, balance. */
  details?: { label: string; value: string }[];
  className?: string;
  /** Lets the wizard supply its own animated, live-region amount. */
  amountSlot?: React.ReactNode;
  /**
   * One line — label left, amount right — for the sticky bar in the wizard,
   * where every pixel of a phone screen it takes is a pixel the form loses.
   */
  compact?: boolean;
}) {
  const figure = amountSlot ?? <MeterAmount amount={amount ?? ''} />;
  return (
    <div className={cn('meter', compact && 'p-2', className)}>
      {compact ? (
        <div className="meter-window flex flex-wrap items-center justify-between gap-x-4 py-2">
          <span className="meter-label">{label}</span>
          <div className="ml-auto overflow-hidden [&_.meter-digits]:text-[2.5rem]">{figure}</div>
        </div>
      ) : (
        <div className="meter-window">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="meter-label">{label}</span>
            {status}
          </div>
          <div className="mt-1.5 overflow-hidden">{figure}</div>
        </div>
      )}
      {details && details.length > 0 ? (
        <dl className={cn('flex flex-wrap gap-x-5 gap-y-1 px-2 pb-0.5', compact ? 'pt-1.5' : 'pt-2.5')}>
          {details.map((d) => (
            <div key={d.label} className="flex items-baseline gap-2">
              <dt className="text-base text-[hsl(var(--meter-label))]">{d.label}</dt>
              <dd className="num text-lg font-semibold text-white">{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
