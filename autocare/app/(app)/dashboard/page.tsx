import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { PlusCircle, ArrowRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { formatPeso } from '@/lib/calc';
import { intlTagFor } from '@/i18n/locales';
import { notDeleted } from '@/lib/jobs';
import { decimalToNumber, formatDate } from '@/lib/utils';
import { byMonth, dayAfter, incomeBetween, incomeByDay, monthStart } from '@/lib/payments';
import { Button } from '@/components/ui/button';
import { Card, Ledger, LedgerRow } from '@/components/ui/card';
import { Meter } from '@/components/ui/meter';
import { countDueReminders } from '@/lib/reminder-queries';
import { shopToday, ymdToDate } from '@/lib/reminders';
import { PageHeader } from '@/components/ui/page-header';
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

  // "Today" is the shop's calendar day (Asia/Manila by default), not the
  // server's: a server in UTC would still be on yesterday until 8 a.m.
  const today = shopToday();
  const thisMonth = monthStart(today);
  const chartFrom = monthStart(today, 11);
  // Job dates are the shop's calendar date at midnight UTC.
  const todayJobsRange = { gte: ymdToDate(today), lt: dayAfter(today) };

  // Started now, awaited below, so it runs alongside the other queries.
  const remindersPending = countDueReminders(prisma, today);

  // Money is counted on the day it arrived (the payment ledger), so a debt
  // collected today is today's money — see lib/payments.ts.
  const [todayJobs, todayMoney, monthMoney, unpaid, recentJobs, dailyIncome] = await Promise.all([
    prisma.job.count({ where: { ...notDeleted, date: todayJobsRange } }),
    incomeBetween(prisma, today, today),
    incomeBetween(prisma, thisMonth, today),
    prisma.job.aggregate({
      _sum: { balance: true },
      _count: { _all: true },
      where: { ...notDeleted, status: { not: 'PAID' } },
    }),
    prisma.job.findMany({
      where: notDeleted,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      include: {
        customer: { select: { fullName: true } },
        vehicle: { select: { plateNumber: true } },
      },
    }),
    incomeByDay(prisma, chartFrom, today),
  ]);
  const reminders = await remindersPending;

  // Twelve months, oldest first, empty months shown as zero.
  const months = byMonth(dailyIncome);
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const key = monthStart(today, 11 - i).slice(0, 7);
    const [year, month] = key.split('-').map(Number);
    return {
      label: new Intl.DateTimeFormat(tag, { month: 'short', timeZone: 'UTC' }).format(
        new Date(Date.UTC(year!, month! - 1, 1)),
      ),
      value: months.get(key) ?? 0,
    };
  });

  const owed = decimalToNumber(unpaid._sum.balance);

  return (
    <div className="space-y-8">
      {params.denied === '1' ? <DeniedNotice /> : null}

      <PageHeader
        className="animate-rise"
        eyebrow={formatDate(`${today}T00:00:00`, tag)}
        title={t('greeting', { name: user.name.split(' ')[0] })}
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* The single largest, most prominent control on the screen — and the
            only solid one in the shop's colour. */}
        <div className="space-y-3">
          <Button asChild size="hero" variant="hero" className="animate-pop">
            <Link href="/jobs/new">
              <PlusCircle aria-hidden />
              <span>{t('recordNewJob')}</span>
            </Link>
          </Button>
          <p className="text-lg text-muted-foreground">{t('recordNewJobHint')}</p>
        </div>

        {/* Today's takings, counted like the window of a fuel pump. */}
        <div className="space-y-3">
          <Meter
            label={t('todayIncome')}
            amount={formatPeso(todayMoney, tag)}
            status={
              <span className="rounded-full bg-white/10 px-3 py-1 text-base font-semibold text-white">
                {t('jobsCount', { count: todayJobs })}
              </span>
            }
            details={[
              {
                label: t('monthIncome'),
                value: formatPeso(monthMoney, tag),
              },
            ]}
          />
          <Ledger>
            <LedgerRow
              label={t('unpaidTotal')}
              hint={t('jobsCount', { count: unpaid._count._all })}
              value={formatPeso(owed, tag)}
              tone={owed > 0 ? 'owed' : 'default'}
              href={owed > 0 ? '/collect' : undefined}
            />
            {/* Customers to call back — only when there is someone to call. */}
            {reminders.total > 0 ? (
              <LedgerRow
                label={t('reminders')}
                hint={t('remindersHint', { due: reminders.due, total: reminders.total })}
                value={String(reminders.total)}
                href="/reminders"
              />
            ) : null}
          </Ledger>
        </div>
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
