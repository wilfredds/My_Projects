import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A white work surface on the concrete page. One hairline edge, no shadow:
 * the contrast between white and the page does the separating, and a screen
 * full of drop-shadows reads as noise to an older eye.
 */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-2xl border border-border bg-card text-card-foreground', className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-2 p-5 sm:p-6', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-2xl font-bold leading-tight', className)} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-lg text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-wrap items-center gap-4 p-5 pt-0 sm:p-6 sm:pt-0', className)}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';

/**
 * The ledger — figures as ruled rows, label left and amount right, the way
 * the owner kept them in his notebook. It replaces a grid of stat boxes:
 * on a phone four boxes stack into a long scroll, while a ledger keeps every
 * figure on one screen and lines the amounts up in a single column.
 */
export function Ledger({
  title,
  className,
  children,
}: {
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card', className)}>
      {title ? (
        <h2 className="border-b border-border px-5 py-4 text-xl font-semibold sm:px-6">{title}</h2>
      ) : null}
      <dl className="divide-y divide-border">{children}</dl>
    </section>
  );
}

/**
 * One ledger line. `tone="owed"` paints money still owed red — the only figure
 * on the dashboard that asks for action. Received money stays in ink: green is
 * kept for the "paid" status itself, so it never has to mean two things.
 *
 * With `href`, the whole row is a link (64px+) — e.g. "unpaid" opens the list
 * of unpaid jobs.
 */
export function LedgerRow({
  label,
  value,
  hint,
  tone = 'default',
  emphasis = false,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'owed';
  emphasis?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <dt className="min-w-0">
        <span className="block text-lg text-muted-foreground">{label}</span>
        {hint ? <span className="block text-base text-muted-foreground">{hint}</span> : null}
      </dt>
      <dd
        className={cn(
          'num ml-auto font-bold',
          emphasis ? 'text-total' : 'text-money',
          tone === 'owed' ? 'text-destructive' : 'text-foreground',
        )}
      >
        {value}
      </dd>
      {href ? <ChevronRight aria-hidden className="size-6 shrink-0 text-muted-foreground" /> : null}
    </>
  );

  const rowClass =
    'flex min-h-tap flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 sm:px-6';

  return href ? (
    <Link
      href={href}
      className={cn(
        rowClass,
        'hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring',
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={rowClass}>{body}</div>
  );
}

/**
 * A ruled list — one white sheet with a line between entries, used for jobs,
 * customers and vehicles alike. Rows stay full width so names never get
 * squeezed into a corner.
 */
export function RowList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <ul
      className={cn(
        'divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card',
        className,
      )}
    >
      {children}
    </ul>
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
