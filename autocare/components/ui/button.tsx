import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Every size here is at least 64px tall — the elderly-first tap-target minimum.
 * There is no icon-only variant on purpose: buttons always carry a text label.
 *
 * Labels WRAP. They used to be `whitespace-nowrap`, which on a 390px phone
 * pushed long Filipino labels ("Magtala ng Bagong Trabaho", "Kopyahin sa
 * bagong trabaho") straight off the edge of the button. A two-line button is
 * fine; a clipped one is not.
 *
 * Colour rules, so a screen never has two things shouting:
 *   - `default` / `hero` — orange, filled. The next thing to press. One per screen.
 *   - `outline` / `secondary` — white with a dark edge. Every other action.
 *   - `destructive` — red outline. Starts a delete; always asks first.
 *   - `danger` — red, filled. Only inside the confirm dialog, as the final "yes".
 * Green is not a button colour here: it means "paid" and appears only on money.
 */
const buttonVariants = cva(
  'press relative inline-flex items-center justify-center gap-3 text-center leading-tight ' +
    '[text-wrap:balance] rounded-lg font-semibold ' +
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
    'disabled:pointer-events-none disabled:opacity-55 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-strong',
        /** "Record a new job" — the same orange, just the biggest thing on screen. */
        hero: 'bg-primary text-primary-foreground hover:bg-primary-strong',
        secondary: 'border-2 border-input bg-card text-foreground hover:bg-accent',
        outline: 'border-2 border-input bg-card text-foreground hover:bg-accent',
        ghost: 'text-foreground hover:bg-accent',
        destructive:
          'border-2 border-destructive bg-card text-destructive hover:bg-destructive-tint',
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        link: 'text-primary-strong underline underline-offset-4 hover:no-underline',
      },
      size: {
        // 64px — the floor for anything tappable.
        default: 'min-h-tap px-5 py-3 text-lg [&_svg]:size-6',
        // 80px — for primary page actions.
        lg: 'min-h-[5rem] px-6 py-4 text-xl [&_svg]:size-7',
        // 96px — reserved for "Record New Job", the biggest button on screen.
        hero: 'min-h-[6rem] w-full px-6 py-5 text-2xl [&_svg]:size-9',
        // Still 64px tall, just narrower; used inside rows.
        compact: 'min-h-tap px-4 py-3 text-base [&_svg]:size-5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
