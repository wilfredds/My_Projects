import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { CircleCheckBig, Hourglass, MessageSquareText, Phone, UserRoundPen } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { getShopInfo } from '@/lib/settings';
import { intlTagFor } from '@/i18n/locales';
import { formatPeso } from '@/lib/calc';
import { formatDate, cn } from '@/lib/utils';
import { daysWaiting, findOwed, type OwedCustomer } from '@/lib/collections';
import { shopToday, smsHref, telHref } from '@/lib/reminders';
import { Button } from '@/components/ui/button';
import { Ledger, LedgerRow } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/misc';
import { Plate } from '@/components/ui/plate';
import { ReceivePaymentButton } from '@/components/payments/receive-payment';

export const metadata = { title: 'Singilin — AutoCare' };
export const dynamic = 'force-dynamic';

/**
 * Singilin — the customers who still owe the shop.
 *
 * Utang is part of how a small talyer works, and it is easy to lose track of.
 * One card per customer, the one waiting longest first: how much in all,
 * which jobs, and the buttons to act — Call or Text (from the shop's own
 * phone, the message written), and Tumanggap ng bayad on each job when the
 * money comes in.
 */
export default async function CollectPage() {
  const user = await requirePageUser();
  const [t, locale, shop] = await Promise.all([
    getTranslations('collect'),
    getLocale(),
    getShopInfo(),
  ]);
  const tag = intlTagFor(locale);
  const today = shopToday();
  const peso = (v: number) => formatPeso(v, tag);

  const owed = await findOwed(prisma);
  const total = owed.reduce((s, c) => s + Math.round(c.totalOwed * 100), 0) / 100;
  const canReceive = can.manageJobs(user.role);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={formatDate(`${today}T00:00:00`, tag)}
        title={t('title')}
        description={t('subtitle')}
      />

      {owed.length === 0 ? (
        <EmptyState icon={<CircleCheckBig className="size-12" aria-hidden />} title={t('empty')} />
      ) : (
        <>
          <Ledger>
            <LedgerRow
              label={t('totalOwed')}
              hint={t('customerCount', { count: owed.length })}
              value={peso(total)}
              tone="owed"
              emphasis
            />
          </Ledger>

          <ul className="grid gap-4 xl:grid-cols-2">
            {owed.map((customer) => (
              <CustomerCard
                key={customer.customerId}
                customer={customer}
                today={today}
                tag={tag}
                shopName={shop.name}
                canReceive={canReceive}
                t={t}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function CustomerCard({
  customer: c,
  today,
  tag,
  shopName,
  canReceive,
  t,
}: {
  customer: OwedCustomer;
  today: string;
  tag: string;
  shopName: string;
  canReceive: boolean;
  t: Awaited<ReturnType<typeof getTranslations<'collect'>>>;
}) {
  const peso = (v: number) => formatPeso(v, tag);
  const days = daysWaiting(c.oldest, today);
  const plates = Array.from(new Set(c.jobs.map((j) => j.plate))).join(', ');
  const tel = telHref(c.phone);
  const sms = smsHref(
    c.phone,
    t('smsBody', { name: c.fullName, shop: shopName, amount: peso(c.totalOwed), plates }),
  );

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-surface">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xl font-bold [overflow-wrap:anywhere]">{c.fullName}</p>
          <p className={cn('num text-lg', !c.phone && 'text-muted-foreground')}>
            {c.phone || t('noPhone')}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-base text-muted-foreground">{t('owes')}</p>
          <p className="money font-bold text-destructive">{peso(c.totalOwed)}</p>
        </div>
      </div>

      <span
        className={cn(
          'inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-base font-semibold',
          days >= 7 ? 'bg-primary-tint text-primary-strong' : 'bg-muted text-foreground',
        )}
      >
        <Hourglass className="size-5" aria-hidden />
        {days === 0 ? t('sinceToday') : t('waitingDays', { days })}
      </span>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {c.jobs.map((job) => (
          <li key={job.jobId} className="space-y-3 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-0 space-y-1">
                <Plate>{job.plate}</Plate>
                <p className="text-base text-muted-foreground">
                  <Link href={`/jobs/${job.jobId}`} className="underline underline-offset-4 hover:text-foreground">
                    {job.jobNumber}
                  </Link>{' '}
                  · {formatDate(`${job.date}T00:00:00`, tag)}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-base text-muted-foreground">{t('stillOwed')}</p>
                <p className="num text-xl font-bold">{peso(job.balance)}</p>
              </div>
            </div>
            {canReceive ? (
              <ReceivePaymentButton
                className="w-full"
                jobId={job.jobId}
                jobNumber={job.jobNumber}
                customerName={c.fullName}
                total={job.total}
                amountPaid={job.amountPaid}
                balance={job.balance}
              />
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-auto grid grid-cols-2 gap-3">
        {tel && sms ? (
          <>
            <Button asChild variant="outline">
              <a href={tel} aria-label={t('callName', { name: c.fullName })}>
                <Phone aria-hidden />
                <span>{t('call')}</span>
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={sms} aria-label={t('textName', { name: c.fullName })}>
                <MessageSquareText aria-hidden />
                <span>{t('text')}</span>
              </a>
            </Button>
          </>
        ) : (
          <Button asChild variant="outline" className="col-span-2">
            <Link href={`/customers/${c.customerId}`}>
              <UserRoundPen aria-hidden />
              <span>{t('addPhone')}</span>
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}
