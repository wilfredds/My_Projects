import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The top of every page, built the same way everywhere so the owner always
 * knows where to look: an optional small line above (a date, a step), the
 * page's name, one sentence about it, and the page's main action on the right
 * (below, on a phone).
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 max-w-3xl space-y-1.5">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="[overflow-wrap:anywhere]">{title}</h1>
        {description ? <p className="text-lg text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
