import { getTranslations, getLocale } from 'next-intl/server';
import { Download } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageAdmin } from '@/lib/session';
import { formatPeso } from '@/lib/calc';
import { intlTagFor } from '@/i18n/locales';
import { notDeleted } from '@/lib/jobs';
import { decimalToNumber, formatDate } from '@/lib/utils';
import { byMonth, dayAfter, incomeBetween, incomeByDay, monthStart } from '@/lib/payments';
import { isYmd, shopToday, ymdToDate } from '@/lib/reminders';
import { Button } from '@/components/ui/button';
import { Card, Ledger, LedgerRow, RowList } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { MonthlyIncomeChart } from '../dashboard/monthly-chart';
import { ReportRangePicker } from './range-picker';
import { PageHeader } from '@/components/ui/page-header';

export const metadata = { title: 'Reports — AutoCare' };
export const dynamic = 'force-dynamic';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  // ADMIN only, re-checked on the server — not just in the middleware.
  await requirePageAdmin();

  const params = await searchParams;
  const [t, td, locale] = await Promise.all([
    getTranslations('reports'),
    getTranslations('dashboard'),
    getLocale(),
  ]);
  const tag = intlTagFor(locale);

  // The range is in the shop's calendar days. With none given: this month.
  const today = shopToday();
  const fromYmd = params.from && isYmd(params.from) ? params.from : monthStart(today);
  const toYmd = params.to && isYmd(params.to) ? params.to : today;

  // Billed work follows the job's date; money received follows the day it
  // arrived (the payment ledger), so a debt collected this month counts as
  // this month's income even if the job was last month's.
  const [jobs, totalIncome, daily] = await Promise.all([
    prisma.job.findMany({
      where: { ...notDeleted, date: { gte: ymdToDate(fromYmd), lt: dayAfter(toYmd) } },
      include: {
        customer: { select: { id: true, fullName: true } },
        parts: { select: { partName: true, quantity: true, lineTotal: true } },
      },
      orderBy: { date: 'asc' },
    }),
    incomeBetween(prisma, fromYmd, toYmd),
    incomeByDay(prisma, fromYmd, toYmd),
  ]);

  const totalBilled = jobs.reduce((s, j) => s + decimalToNumber(j.total), 0);
  const outstanding = jobs.reduce((s, j) => s + decimalToNumber(j.balance), 0);

  // ---- daily and monthly income -------------------------------------------
  const dailyRows = Array.from(daily.entries());
  const monthlyRows = Array.from(byMonth(daily).entries()).map(([key, value]) => {
    const [year, month] = key.split('-').map(Number);
    return {
      label: new Intl.DateTimeFormat(tag, { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(
        new Date(Date.UTC(year!, month! - 1, 1)),
      ),
      value,
    };
  });

  // ---- most-used spare parts --------------------------------------------
  // Grouped case-insensitively ("Oil Filter" and "oil filter" are one part),
  // but shown with the spelling it was first recorded under.
  const partTotals = new Map<
    string,
    { name: string; quantity: number; times: number; amount: number }
  >();
  for (const job of jobs) {
    for (const part of job.parts) {
      const key = part.partName.trim().toLowerCase();
      const entry = partTotals.get(key) ?? {
        name: part.partName.trim(),
        quantity: 0,
        times: 0,
        amount: 0,
      };
      entry.quantity += part.quantity;
      entry.times += 1;
      entry.amount += decimalToNumber(part.lineTotal);
      partTotals.set(key, entry);
    }
  }
  const topParts = Array.from(partTotals.entries())
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 10);

  // ---- top customers by revenue -----------------------------------------
  const customerTotals = new Map<string, { name: string; revenue: number; jobs: number }>();
  for (const job of jobs) {
    const entry = customerTotals.get(job.customerId) ?? {
      name: job.customer.fullName,
      revenue: 0,
      jobs: 0,
    };
    entry.revenue += decimalToNumber(job.amountPaid);
    entry.jobs += 1;
    customerTotals.set(job.customerId, entry);
  }
  const topCustomers = Array.from(customerTotals.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return (
    <div className="space-y-8">
      <PageHeader title={t('title')} description={t('subtitle')} />

      <ReportRangePicker
        defaultFrom={fromYmd}
        defaultTo={toYmd}
      />

      <Ledger>
        <LedgerRow label={t('totalIncome')} value={formatPeso(totalIncome, tag)} emphasis />
        <LedgerRow label={t('totalBilled')} value={formatPeso(totalBilled, tag)} />
        <LedgerRow
          label={t('outstanding')}
          value={formatPeso(outstanding, tag)}
          tone={outstanding > 0 ? 'owed' : 'default'}
        />
        <LedgerRow label={t('jobCount')} value={String(jobs.length)} />
      </Ledger>

      {jobs.length === 0 && daily.size === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <>
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4">{t('monthlyIncome')}</h2>
            <MonthlyIncomeChart data={monthlyRows} />
          </Card>

          <ReportList
            title={t('dailyIncome')}
            rows={dailyRows.map(([day, amount]) => ({
              label: formatDate(`${day}T00:00:00`, tag),
              value: formatPeso(amount, tag),
            }))}
          />

          <ReportList
            title={t('topParts')}
            rows={topParts.map(([, data]) => ({
              label: data.name,
              meta: `${t('quantityUsed')}: ${data.quantity} · ${t('timesUsed')}: ${data.times}`,
              value: formatPeso(data.amount, tag),
            }))}
          />

          <ReportList
            title={t('topCustomers')}
            rows={topCustomers.map((c) => ({
              label: c.name,
              meta: td('jobsCount', { count: c.jobs }),
              value: formatPeso(c.revenue, tag),
            }))}
          />
        </>
      )}

      <section className="space-y-3 border-t border-border pt-6">
        <h2>{t('export')}</h2>
        <p className="text-lg text-muted-foreground">{t('exportHint')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button asChild variant="outline" size="lg">
            <a href={`/api/export?format=csv&from=${params.from ?? ''}&to=${params.to ?? ''}`}>
              <Download aria-hidden />
              <span>{t('exportCsv')}</span>
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="/api/export?format=json">
              <Download aria-hidden />
              <span>{t('exportJson')}</span>
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}

/**
 * A report as ruled lines — name on the left, amount on the right, any extra
 * figures on a second line. No table, so nothing scrolls sideways on a phone.
 */
function ReportList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; meta?: string; value: string }[];
}) {
  return (
    <section className="space-y-3">
      <h2>{title}</h2>
      <RowList>
        {rows.map((row, index) => (
          <li
            key={`${row.label}-${index}`}
            className="flex min-h-tap flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 sm:px-6"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-lg [overflow-wrap:anywhere]">{row.label}</span>
              {row.meta ? <span className="block text-base text-muted-foreground">{row.meta}</span> : null}
            </span>
            <span className="num ml-auto text-money font-bold">{row.value}</span>
          </li>
        ))}
      </RowList>
    </section>
  );
}
