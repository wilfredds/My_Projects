import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A licence plate. A shop knows a car by its plate before it knows the
 * owner's name, so every vehicle in the app is drawn as one — a white plate
 * with a pressed rim. Styling lives in `.plate` in globals.css.
 */
export function Plate({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn('plate', className)} {...props}>
      {children}
    </span>
  );
}
