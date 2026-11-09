import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, CircleCheck, CircleDashed } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * All badge colours meet WCAG AA (>= 4.5:1) against their tint. The three
 * money states also carry an icon, so "paid" and "unpaid" never depend on
 * someone being able to tell green from red.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-base font-semibold leading-snug whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-foreground text-card',
        paid: 'border-success/30 bg-success-tint text-success',
        unpaid: 'border-destructive/30 bg-destructive-tint text-destructive',
        partial: 'border-warning/30 bg-warning-tint text-warning',
        muted: 'border-transparent bg-muted text-muted-foreground',
        outline: 'border-input bg-card text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

const STATUS_ICON = {
  paid: CircleCheck,
  unpaid: CircleAlert,
  partial: CircleDashed,
} as const;

export function Badge({
  className,
  variant,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  const Icon = variant && variant in STATUS_ICON ? STATUS_ICON[variant as keyof typeof STATUS_ICON] : null;
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {Icon ? <Icon aria-hidden className="size-[1.1em] shrink-0" strokeWidth={2.5} /> : null}
      {children}
    </span>
  );
}

/** Map a job status to its badge colour. */
export function statusVariant(status: 'PAID' | 'UNPAID' | 'PARTIAL') {
  return status === 'PAID' ? 'paid' : status === 'UNPAID' ? 'unpaid' : 'partial';
}

export { badgeVariants };
