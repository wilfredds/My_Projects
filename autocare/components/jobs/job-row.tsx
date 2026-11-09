import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Plate } from '@/components/ui/plate';
import { Badge, statusVariant } from '@/components/ui/badge';

/**
 * One job in a list — the same shape everywhere jobs are listed (home, the
 * jobs list, a customer's history), so the owner learns it once.
 *
 *   [ABC 1234]                 ₱1,700.00
 *   Juan dela Cruz
 *   9 Nobyembre 2026 · JOB-2026-0004   ✓ Bayad
 *
 * The plate and the amount share the first line because those are the two
 * things he looks for. The customer's name gets a line of its own so a long
 * name is never squeezed down to a few letters, and the job number never
 * breaks in the middle.
 */
export function JobRow({
  href,
  plate,
  customer,
  date,
  jobNumber,
  amount,
  status,
  statusLabel,
}: {
  href: string;
  plate: string;
  /** Leave out on a customer's own page, where every row is theirs. */
  customer?: string;
  date: string;
  jobNumber: string;
  amount: string;
  status: 'PAID' | 'UNPAID' | 'PARTIAL';
  statusLabel: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'block px-5 py-4 hover:bg-accent sm:px-6',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring',
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <Plate>{plate}</Plate>
        <span className="num text-money font-bold">{amount}</span>
      </span>
      {customer ? (
        <span className="mt-2 block text-lg font-semibold leading-snug [overflow-wrap:anywhere]">
          {customer}
        </span>
      ) : null}
      <span className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="text-base text-muted-foreground">
          {date} · <span className="whitespace-nowrap">{jobNumber}</span>
        </span>
        <Badge variant={statusVariant(status)}>{statusLabel}</Badge>
      </span>
    </Link>
  );
}

/** The ruled list job rows sit in. */
export { RowList as JobList } from '@/components/ui/card';
