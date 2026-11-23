import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Plate } from '@/components/ui/plate';
import { Badge, statusVariant } from '@/components/ui/badge';

/**
 * One job in a list — the same shape everywhere jobs are listed (home, the
 * jobs list, a customer's history), so the owner learns it once. On a wide
 * screen the same pieces line up in one row instead of three.
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
        'grid items-center gap-x-4 gap-y-1.5 px-5 py-4 hover:bg-accent sm:px-6',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring',
        // Phone and tablet: three lines. Wide screen: one row, read left to
        // right like a ledger — plate, who, status, amount.
        'grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[10rem_minmax(0,1fr)_13rem_10rem] xl:py-3',
        // A phone gives the date its own line (next to the badge it would be
        // squeezed into three); from a tablet up they share one.
        customer
          ? "[grid-template-areas:'plate_amount'_'name_name'_'meta_meta'_'status_status'] sm:[grid-template-areas:'plate_amount'_'name_name'_'meta_status'] xl:[grid-template-areas:'plate_name_status_amount'_'plate_meta_status_amount']"
          : "[grid-template-areas:'plate_amount'_'meta_meta'_'status_status'] sm:[grid-template-areas:'plate_amount'_'meta_status'] xl:[grid-template-areas:'plate_meta_status_amount']",
      )}
    >
      <Plate className="justify-self-start [grid-area:plate]">{plate}</Plate>
      <span className="num text-right text-money font-bold [grid-area:amount]">{amount}</span>
      {customer ? (
        <span className="pt-0.5 text-lg font-semibold leading-snug [grid-area:name] [overflow-wrap:anywhere] xl:pt-0">
          {customer}
        </span>
      ) : null}
      <span className="text-base text-muted-foreground [grid-area:meta]">
        {date} · <span className="whitespace-nowrap">{jobNumber}</span>
      </span>
      <Badge
        variant={statusVariant(status)}
        className="mt-1 justify-self-start [grid-area:status] sm:mt-0 sm:justify-self-end xl:justify-self-start"
      >
        {statusLabel}
      </Badge>
    </Link>
  );
}

/** The ruled list job rows sit in. */
export { RowList as JobList } from '@/components/ui/card';
