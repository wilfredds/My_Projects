'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A quantity control with big − / + buttons either side of the number.
 *
 * Typing is still allowed, but the owner never has to: two taps get from 1 to 3.
 * Both buttons are 64px squares.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  label,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  label: string;
  id?: string;
}) {
  const numeric = Number(value) || min;

  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, numeric + delta));
    onChange(String(next));
  };

  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={numeric <= min}
        aria-label={`${label} −1`}
        className={cn(
          'flex size-16 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-input shadow-control',
          'bg-background text-foreground hover:bg-accent disabled:opacity-40',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
        )}
      >
        <Minus className="size-7" aria-hidden />
      </button>

      <input
        id={id}
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={() => onChange(String(Math.min(max, Math.max(min, Number(value) || min))))}
        className={cn(
          'min-h-tap w-24 rounded-lg border-[1.5px] border-input bg-card shadow-control text-center text-money',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:border-primary',
        )}
      />

      <button
        type="button"
        onClick={() => step(1)}
        disabled={numeric >= max}
        aria-label={`${label} +1`}
        className={cn(
          'flex size-16 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-input shadow-control',
          'bg-background text-foreground hover:bg-accent disabled:opacity-40',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
        )}
      >
        <Plus className="size-7" aria-hidden />
      </button>
    </div>
  );
}
