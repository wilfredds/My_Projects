import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { PlusCircle, ArrowRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { formatPeso } from '@/lib/calc';
import { intlTagFor } from '@/i18n/locales';
import { notDeleted } from '@/lib/jobs';
import { decimalToNumber, startOfDay, endOfDay, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, Ledger, LedgerRow } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { JobList, JobRow } from '@/components/jobs/job-row';
import { MonthlyIncomeChart } from './monthly-chart';
import { DeniedNotice } from './denied-notice';

export const metadata = { title: 'Home — AutoCare' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const [t, tj, tcom, locale] = await Promise.all([
    getTranslations('dashboard'),
    getTranslations('job'),
    getTranslations('common'),
    getLocale(),
  ]);
  const tag = intlTagFor(locale);

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [todayJobs, todayMoney, monthMoney, unpaid, recentJobs, monthlyRows] = await Promise.all([
    prisma.job.count({ where: { ...notDeleted, date: { gte: todayStart, lte: todayEnd } } }),
    prisma.job.aggregate({
      _sum: { amountPaid: true },
      where: { ...notDeleted, date: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.job.aggregate({
      _sum: { amountPaid: true },
      where: { ...notDeleted, date: { gte: monthStart, lte: todayEnd } },
    }),
    prisma.job.aggregate({
      _sum: { balance: true },
      _count: { _all: true },
      where: { ...notDeleted, status: { not: 'PAID' } },
    }),
    prisma.job.findMany({
      where: notDeleted,
      orderBy: { date: 'desc' },
      take: 10,
      include: {
        customer: { select: { fullName: true } },
        vehicle: { select: { plateNumber: true } },
      },
    }),
    prisma.job.findMany({
      where: { ...notDeleted, date: { gte: twelveMonthsAgo } },
      select: { date: true, amountPaid: true },
    }),
  ]);

  // Group into months in JS — 12 rows at most, cheaper than a second round trip.
  const monthly = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    monthly.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0);
  }
  for (const row of monthlyRows) {
    const key = `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, '0')}`;
    if (monthly.has(key)) {
      monthly.set(key, (monthly.get(key) ?? 0) + decimalToNumber(row.amountPaid));
    }
  }

  const chartData = Array.from(monthly.entries()).map(([key, value]) => {
    const [year, month] = key.split('-').map(Number);
    return {
      label: new Intl.DateTimeFormat(tag, { month: 'short' }).format(new Date(year, month - 1, 1)),
      value,
    };
  });

  const owed = decimalToNumber(unpaid._sum.balance);

  return (
    <div className="space-y-8">
      {params.denied === '1' ? <DeniedNotice /> : null}

      <div>
        <h1 className="animate-rise">{t('greeting', { name: user.name.split(' ')[0] })}</h1>
        <p className="animate-rise mt-1 text-lg text-muted-foreground">{formatDate(now, tag)}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* The single largest, most prominent control on the screen — and the
            only solid orange one. */}
        <div className="space-y-3">
          <Button asChild size="hero" variant="hero" className="animate-pop">
            <Link href="/jobs/new">
              <PlusCircle aria-hidden />
              <span>{t('recordNewJob')}</span>
            </Link>
          </Button>
          <p className="text-lg text-muted-foreground">{t('recordNewJobHint')}</p>
        </div>

        {/* Today's figures as ruled lines, like the page of his notebook. */}
        <Ledger>
          <LedgerRow
            label={t('todayIncome')}
            hint={t('jobsCount', { count: todayJobs })}
            value={formatPeso(decimalToNumber(todayMoney._sum.amountPaid), tag)}
            emphasis
          />
          <LedgerRow
            label={t('monthIncome')}
            value={formatPeso(decimalToNumber(monthMoney._sum.amountPaid), tag)}
          />
          <LedgerRow
            label={t('unpaidTotal')}
            hint={t('jobsCount', { count: unpaid._count._all })}
            value={formatPeso(owed, tag)}
            tone={owed > 0 ? 'owed' : 'default'}
            href={owed > 0 ? '/jobs?status=OWED' : undefined}
          />
        </Ledger>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2>{t('recentJobs')}</h2>
          <Button asChild variant="outline" size="compact">
            <Link href="/jobs">
              <span>{tcom('viewAll')}</span>
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>

        {recentJobs.length === 0 ? (
          <EmptyState title={t('noJobsYet')} />
        ) : (
          <JobList>
            {recentJobs.map((job) => (
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
      </section>

      {can.viewReports(user.role) ? (
        <Card className="p-5 sm:p-6">
          <h2 className="mb-4">{t('monthlyChart')}</h2>
          <MonthlyIncomeChart data={chartData} />
        </Card>
      ) : null}
    </div>
  );
}
