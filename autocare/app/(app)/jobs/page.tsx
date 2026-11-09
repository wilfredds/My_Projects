import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePageUser } from '@/lib/session';
import { formatPeso } from '@/lib/calc';
import { intlTagFor } from '@/i18n/locales';
import { decimalToNumber, formatDate, startOfDay, endOfDay } from '@/lib/utils';
import { notDeleted } from '@/lib/jobs';
import { jobFilterSchema } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { JobList, JobRow } from '@/components/jobs/job-row';
import { JobFilters } from './job-filters';

export const metadata = { title: 'Jobs — AutoCare' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePageUser();
  const raw = await searchParams;
  const [t, tj, tnav, tcom, locale] = await Promise.all([
    getTranslations('jobs'),
    getTranslations('job'),
    getTranslations('nav'),
    getTranslations('common'),
    getLocale(),
  ]);
  const tag = intlTagFor(locale);

  const filters = jobFilterSchema.parse(raw);

  // Trashed jobs never appear in the list; they live on /trash.
  const where: Prisma.JobWhereInput = { ...notDeleted };

  if (filters.q) {
    where.OR = [
      { customer: { fullName: { contains: filters.q, mode: 'insensitive' } } },
      { vehicle: { plateNumber: { contains: filters.q, mode: 'insensitive' } } },
      { jobNumber: { contains: filters.q, mode: 'insensitive' } },
    ];
  }
  if (filters.status === 'OWED') where.status = { not: 'PAID' };
  else if (filters.status) where.status = filters.status;

  const fromDate = filters.from ? new Date(filters.from) : null;
  const toDate = filters.to ? new Date(filters.to) : null;
  if ((fromDate && !Number.isNaN(fromDate.getTime())) || (toDate && !Number.isNaN(toDate.getTime()))) {
    where.date = {};
    if (fromDate && !Number.isNaN(fromDate.getTime())) where.date.gte = startOfDay(fromDate);
    if (toDate && !Number.isNaN(toDate.getTime())) where.date.lte = endOfDay(toDate);
  }

  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { fullName: true } },
        vehicle: { select: { plateNumber: true } },
      },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (page: number) => {
    const sp = new URLSearchParams();
    if (filters.q) sp.set('q', filters.q);
    if (filters.status) sp.set('status', filters.status);
    if (filters.from) sp.set('from', filters.from);
    if (filters.to) sp.set('to', filters.to);
    sp.set('page', String(page));
    return `/jobs?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{t('title')}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/jobs/new">
            <PlusCircle aria-hidden />
            <span>{tnav('newJob')}</span>
          </Link>
        </Button>
      </div>

      <JobFilters />

      <p className="text-lg font-semibold text-muted-foreground" aria-live="polite">
        {t('resultCount', { count: total })}
      </p>

      {jobs.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <JobList>
          {jobs.map((job) => (
            <li key={job.id}>
              <JobRow
                href={`/jobs/${job.id}`}
                plate={job.vehicle.plateNumber}
                customer={job.customer.fullName}
                date={formatDate(job.date, tag)}
                jobNumber={job.jobNumber}
                amount={formatPeso(decimalToNumber(job.total), tag)}
                status={job.status}
                statusLabel={tj(`status_${job.status}` as never)}
              />
            </li>
          ))}
        </JobList>
      )}

      {pageCount > 1 ? (
        <nav
          className="flex flex-wrap items-center justify-between gap-3"
          aria-label={tcom('pages')}
        >
          {filters.page > 1 ? (
            <Button asChild variant="outline" size="compact">
              <Link href={pageHref(filters.page - 1)}>
                <ChevronLeft aria-hidden />
                <span>{tcom('previous')}</span>
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-lg font-semibold">
            {tcom('pageOf', { current: filters.page, total: pageCount })}
          </span>
          {filters.page < pageCount ? (
            <Button asChild variant="outline" size="compact">
              <Link href={pageHref(filters.page + 1)}>
                <span>{tcom('next')}</span>
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
