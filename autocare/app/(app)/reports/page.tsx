import { getTranslations, getLocale } from 'next-intl/server';
import { Download } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageAdmin } from '@/lib/session';
import { formatPeso } from '@/lib/calc';
import { intlTagFor } from '@/i18n/locales';
import { notDeleted } from '@/lib/jobs';
import { decimalToNumber, formatDate, startOfDay, endOfDay } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, Ledger, LedgerRow, RowList } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { MonthlyIncomeChart } from '../dashboard/monthly-chart';
import { ReportRangePicker } from './range-picker';

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

  const now = new Date();
  const parsedFrom = params.from ? new Date(params.from) : null;
  const parsedTo = params.to ? new Date(params.to) : null;

  const from =
    parsedFrom && !Number.isNaN(parsedFrom.getTime())
      ? startOfDay(parsedFrom)
      : startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const to =
    parsedTo && !Number.isNaN(parsedTo.getTime()) ? endOfDay(parsedTo) : endOfDay(now);

  const jobs = await prisma.job.findMany({
    where: { ...notDeleted, date: { gte: from, lte: to } },
    include: {
      customer: { select: { id: true, fullName: true } },
      parts: { select: { partName: true, quantity: true, lineTotal: true } },
    },
    orderBy: { date: 'asc' },
  });

  const totalIncome = jobs.reduce((s, j) => s + decimalToNumber(j.amountPaid), 0);
  const totalBilled = jobs.reduce((s, j) => s + decimalToNumber(j.total), 0);
  const outstanding = jobs.reduce((s, j) => s + decimalToNumber(j.balance), 0);

  // ---- daily income ------------------------------------------------------
  const daily = new Map<string, number>();
  for (const job of jobs) {
    const key = job.date.toISOString().slice(0, 10);
    daily.set(key, (daily.get(key) ?? 0) + decimalToNumber(job.amountPaid));
  }
  const dailyRows = Array.from(daily.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  // ---- monthly income ----------------------------------------------------
  const monthly = new Map<string, number>();
  for (const job of jobs) {
    const key = `${job.date.getFullYear()}-${String(job.date.getMonth() + 1).padStart(2, '0')}`;
    monthly.set(key, (monthly.get(key) ?? 0) + decimalToNumber(job.amountPaid));
  }
  const monthlyRows = Array.from(monthly.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        label: new Intl.DateTimeFormat(tag, { month: 'short', year: '2-digit' }).format(
          new Date(year, month - 1, 1),
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
      <div>
        <h1>{t('title')}</h1>
        <p className="mt-1 text-lg text-muted-foreground">{t('subtitle')}</p>
      </div>

      <ReportRangePicker
        defaultFrom={from.toISOString().slice(0, 10)}
        defaultTo={to.toISOString().slice(0, 10)}
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

      {jobs.length === 0 ? (
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
              label: formatDate(new Date(day), tag),
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
