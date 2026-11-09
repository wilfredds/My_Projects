import { getTranslations, getLocale } from 'next-intl/server';
import { Trash2, Undo2 } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageAdmin } from '@/lib/session';
import { formatPeso } from '@/lib/calc';
import { intlTagFor } from '@/i18n/locales';
import { onlyDeleted } from '@/lib/jobs';
import { decimalToNumber, formatDate, formatDateTime } from '@/lib/utils';
import { Badge, statusVariant } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { RowList } from '@/components/ui/card';
import { Plate } from '@/components/ui/plate';
import { TrashRowActions } from './trash-controls';

export const metadata = { title: 'Trash — AutoCare' };
export const dynamic = 'force-dynamic';

/**
 * The Trash: jobs that were deleted but not destroyed.
 *
 * This exists because the person recording jobs every day is not comfortable
 * with computers, and "Burahin" on the wrong row should be a moment's
 * annoyance rather than a lost record. ADMIN only — restoring or purging is an
 * owner decision.
 */
export default async function TrashPage() {
  await requirePageAdmin();

  const [t, tj, locale] = await Promise.all([
    getTranslations('trash'),
    getTranslations('job'),
    getLocale(),
  ]);
  const tag = intlTagFor(locale);

  const jobs = await prisma.job.findMany({
    where: onlyDeleted,
    orderBy: { deletedAt: 'desc' },
    take: 200,
    include: {
      customer: { select: { fullName: true } },
      vehicle: { select: { plateNumber: true } },
      deletedBy: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1>{t('title')}</h1>
        <p className="mt-1 text-lg text-muted-foreground">{t('subtitle')}</p>
      </div>

      <p className="rounded-2xl border border-border bg-card p-4 text-lg sm:p-5">
        {t('explainer')}
      </p>

      {jobs.length === 0 ? (
        <EmptyState title={t('empty')} icon={<Trash2 className="size-12" aria-hidden />} />
      ) : (
        <RowList>
          {jobs.map((job) => (
            <li key={job.id} className="space-y-1.5 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <Plate>{job.vehicle.plateNumber}</Plate>
                <span className="num text-money font-bold">
                  {formatPeso(decimalToNumber(job.total), tag)}
                </span>
              </div>
              <p className="pt-0.5 text-lg font-semibold leading-snug [overflow-wrap:anywhere]">
                {job.customer.fullName}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <span className="text-base text-muted-foreground">
                  {formatDate(job.date, tag)} · <span className="whitespace-nowrap">{job.jobNumber}</span>
                </span>
                <Badge variant={statusVariant(job.status)}>{tj(`status_${job.status}` as never)}</Badge>
              </div>
              <p className="text-base text-muted-foreground">
                {t('deletedBy', {
                  who: job.deletedBy?.name ?? '—',
                  when: job.deletedAt ? formatDateTime(job.deletedAt, tag) : '—',
                })}
              </p>

              <div className="pt-2">
                <TrashRowActions
                  jobId={job.id}
                  jobNumber={job.jobNumber}
                  customerName={job.customer.fullName}
                />
              </div>
            </li>
          ))}
        </RowList>
      )}

      <p className="flex items-center gap-2 text-base text-muted-foreground">
        <Undo2 className="size-5" aria-hidden />
        {t('restoreHint')}
      </p>
    </div>
  );
}
