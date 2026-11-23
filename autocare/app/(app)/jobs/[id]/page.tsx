import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import { Pencil, Printer, Download, Copy, ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { formatPeso } from '@/lib/calc';
import { intlTagFor } from '@/i18n/locales';
import { formatDate } from '@/lib/utils';
import { jobInclude, notDeleted, serializeJob } from '@/lib/jobs';
import { getShopInfo } from '@/lib/settings';
import { Button } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Meter } from '@/components/ui/meter';
import { Plate } from '@/components/ui/plate';
import { ReceiptView } from '@/components/receipt/receipt-view';
import { DeleteJobButton } from './delete-job-button';

export const dynamic = 'force-dynamic';

/**
 * One job. The top answers the two questions the owner opens a job for —
 * how much, and is it paid — in the meter; the receipt follows below.
 * Delete sits on its own at the very bottom, away from the everyday buttons.
 */
export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;

  const [job, shop, tcom, tj, tw, locale] = await Promise.all([
    prisma.job.findFirst({ where: { id, ...notDeleted }, include: jobInclude }),
    getShopInfo(),
    getTranslations('common'),
    getTranslations('job'),
    getTranslations('wizard'),
    getLocale(),
  ]);

  if (!job) notFound();

  const tag = intlTagFor(locale);
  const serialized = serializeJob(job);

  const details: { label: string; value: string }[] = [
    { label: tj('amountPaid'), value: formatPeso(serialized.amountPaid, tag) },
  ];
  if (serialized.balance > 0) {
    details.push({ label: tj('balance'), value: formatPeso(serialized.balance, tag) });
  }

  return (
    // Phone and tablet: one column. Wide screen: the figures and buttons on
    // the left (they stay in view while scrolling), the receipt on the right.
    <div className="space-y-6 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:items-start xl:gap-8 xl:space-y-0">
      <div className="no-print space-y-6 xl:sticky xl:top-28">
        <div className="space-y-3">
          <Button asChild variant="ghost" size="compact" className="-ml-2">
            <Link href="/jobs">
              <ArrowLeft aria-hidden />
              <span>{tcom('back')}</span>
            </Link>
          </Button>

          <div>
            <p className="eyebrow">{tj('jobNumber')}</p>
            <h1 className="num mt-0.5">{job.jobNumber}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Plate>{job.vehicle.plateNumber}</Plate>
            <span className="text-xl font-semibold [overflow-wrap:anywhere]">{job.customer.fullName}</span>
          </div>
          <p className="text-lg text-muted-foreground">{formatDate(job.date, tag)}</p>
        </div>

        <Meter
          label={tw('grandTotal')}
          amount={formatPeso(serialized.total, tag)}
          status={
            <Badge variant={statusVariant(job.status)}>{tj(`status_${job.status}` as never)}</Badge>
          }
          details={details}
        />

        {/* Action bar — every button carries a text label. Print is the one
            solid button; the rest are outlined so it stands out. */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <Button asChild size="lg" className="sm:col-span-2 xl:col-span-1">
            <Link href={`/jobs/${job.id}/print`}>
              <Printer aria-hidden />
              <span>{tcom('print')}</span>
            </Link>
          </Button>

          <Button asChild variant="outline" size="lg">
            <a href={`/api/jobs/${job.id}/receipt`} download={`${job.jobNumber}.pdf`}>
              <Download aria-hidden />
              <span>{tcom('downloadPdf')}</span>
            </a>
          </Button>

          <Button asChild variant="outline" size="lg">
            <Link href={`/jobs/${job.id}/edit`}>
              <Pencil aria-hidden />
              <span>{tcom('edit')}</span>
            </Link>
          </Button>

          <Button asChild variant="outline" size="lg" className="sm:col-span-2 xl:col-span-1">
            <Link href={`/jobs/new?from=${job.id}`}>
              <Copy aria-hidden />
              <span>{tj('duplicate')}</span>
            </Link>
          </Button>
        </div>

        {can.deleteJobs(user.role) ? (
          // Delete stays apart from the everyday buttons. On a phone it sits
          // below the receipt; on a wide screen, at the foot of this column.
          <div className="hidden border-t border-border pt-6 xl:block">
            <DeleteJobButton
              jobId={job.id}
              jobNumber={job.jobNumber}
              customerName={job.customer.fullName}
            />
          </div>
        ) : null}
      </div>

      <ReceiptView job={serialized} shop={shop} />

      {can.deleteJobs(user.role) ? (
        <div className="no-print border-t border-border pt-6 xl:hidden">
          <DeleteJobButton
            jobId={job.id}
            jobNumber={job.jobNumber}
            customerName={job.customer.fullName}
          />
        </div>
      ) : null}
    </div>
  );
}
