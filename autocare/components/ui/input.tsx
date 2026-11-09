import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * 64px tall, 18px text, with a thick focus ring that is easy to see.
 * White on the concrete page, with a `border-input` edge measured at 3.8:1 —
 * WCAG asks 3:1 for a field's boundary, and the old pale edge was 1.8:1, which
 * is why empty fields used to nearly vanish.
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex min-h-tap w-full rounded-lg border-2 border-input bg-card px-4 py-3 text-lg',
        'text-foreground placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:border-primary',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

/** A money input: right-aligned, big and bold, numeric keypad on phones. */
const MoneyInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-money text-muted-foreground"
      >
        ₱
      </span>
      <Input
        ref={ref}
        inputMode="decimal"
        type="text"
        autoComplete="off"
        className={cn('num pl-12 text-right text-money', className)}
        {...props}
      />
    </div>
  ),
);
MoneyInput.displayName = 'MoneyInput';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[8rem] w-full rounded-lg border-2 border-input bg-card px-4 py-3 text-lg',
      'text-foreground placeholder:text-muted-foreground',
      'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:border-primary',
      'disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Input, MoneyInput, Textarea };
