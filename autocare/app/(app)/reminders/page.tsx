import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { BellRing, CalendarClock, MessageSquareText, Phone, UserRoundPen } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { getShopInfo } from '@/lib/settings';
import { intlTagFor } from '@/i18n/locales';
import { formatDate, cn } from '@/lib/utils';
import { describeVehicle } from '@/lib/jobs';
import { findDueReminders, type DueReminder } from '@/lib/reminder-queries';
import { reminderState, shopToday, smsHref, telHref } from '@/lib/reminders';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/misc';
import { Plate } from '@/components/ui/plate';
import { ReminderDoneButton } from './done-button';

export const metadata = { title: 'Babalikan — AutoCare' };
export const dynamic = 'force-dynamic';

/**
 * Babalikan — the cars that are due back.
 *
 * Repeat customers keep a talyer alive, and a change-oil customer who is not
 * reminded often goes elsewhere. This page lists every car whose next visit
 * has come (or will within two weeks), with one-tap Call and Text buttons that
 * open the phone's own dialler and messaging app — no SMS service to pay for,
 * and the message comes from the shop's own number, which customers trust.
 */
export default async function RemindersPage() {
  const user = await requirePageUser();
  const [t, locale, shop] = await Promise.all([
    getTranslations('reminders'),
    getLocale(),
    getShopInfo(),
  ]);
  const tag = intlTagFor(locale);
  const today = shopToday();

  const list = await findDueReminders(prisma, today);
  const due = list.filter((r) => r.nextVisitOn <= today);
  const soon = list.filter((r) => r.nextVisitOn > today);
  const canClose = can.manageJobs(user.role);

  const card = (r: DueReminder) => (
    <ReminderCard
      key={r.jobId}
      reminder={r}
      today={today}
      tag={tag}
      shopName={shop.name}
      canClose={canClose}
      t={t}
    />
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={formatDate(`${today}T00:00:00`, tag)}
        title={t('title')}
        description={t('subtitle')}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<BellRing className="size-12" aria-hidden />}
          title={t('empty')}
          action={<p className="max-w-md text-lg text-muted-foreground">{t('emptyHint')}</p>}
        />
      ) : null}

      {due.length > 0 ? (
        <section className="space-y-4" aria-labelledby="due-now">
          <h2 id="due-now">
            {t('dueNow')} <span className="num text-muted-foreground">({due.length})</span>
          </h2>
          <ul className="grid gap-4 xl:grid-cols-2">{due.map(card)}</ul>
        </section>
      ) : null}

      {soon.length > 0 ? (
        <section className="space-y-4" aria-labelledby="coming-up">
          <h2 id="coming-up">
            {t('comingUp')} <span className="num text-muted-foreground">({soon.length})</span>
          </h2>
          <ul className="grid gap-4 xl:grid-cols-2">{soon.map(card)}</ul>
        </section>
      ) : null}
    </div>
  );
}

function ReminderCard({
  reminder: r,
  today,
  tag,
  shopName,
  canClose,
  t,
}: {
  reminder: DueReminder;
  today: string;
  tag: string;
  shopName: string;
  canClose: boolean;
  t: Awaited<ReturnType<typeof getTranslations<'reminders'>>>;
}) {
  const state = reminderState(r.nextVisitOn, today);
  const dueDate = formatDate(`${r.nextVisitOn}T00:00:00`, tag);
  const km = (n: number) => new Intl.NumberFormat(tag).format(n);
  const vehicle = describeVehicle(r.vehicle).replace(`${r.vehicle.plateNumber} — `, '');
  const tel = telHref(r.customer.phone);
  const sms = smsHref(
    r.customer.phone,
    t('smsBody', { name: r.customer.fullName, shop: shopName, plate: r.vehicle.plateNumber }),
  );

  const badge =
    state.kind === 'overdue'
      ? t('overdue', { days: state.days })
      : state.kind === 'today'
        ? t('dueToday')
        : t('dueIn', { days: state.days });

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-surface">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Plate className="text-xl">{r.vehicle.plateNumber}</Plate>
          <p className="text-xl font-bold [overflow-wrap:anywhere]">{r.customer.fullName}</p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-base font-semibold',
            state.kind === 'soon'
              ? 'bg-muted text-foreground'
              : 'bg-primary-tint text-primary-strong',
          )}
        >
          <CalendarClock className="size-5" aria-hidden />
          {badge}
        </span>
      </div>

      <dl className="space-y-1 text-lg">
        <div>
          <dt className="sr-only">{t('dueOnLabel')}</dt>
          <dd className="font-semibold">
            {t('dueOn', { date: dueDate })}
            {r.nextVisitKm ? (
              <span className="font-normal text-muted-foreground"> · {t('orKm', { km: km(r.nextVisitKm) })}</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="sr-only">{t('lastVisitLabel')}</dt>
          <dd className="text-muted-foreground [overflow-wrap:anywhere]">
            <Link href={`/jobs/${r.jobId}`} className="underline underline-offset-4 hover:text-foreground">
              {t('lastVisit', { date: formatDate(r.jobDate, tag) })}
            </Link>
            {r.services.length > 0 ? ` · ${r.services.join(', ')}` : null}
            {vehicle && vehicle !== r.vehicle.plateNumber ? ` · ${vehicle}` : null}
          </dd>
        </div>
        <div>
          <dt className="sr-only">{t('phoneLabel')}</dt>
          <dd className={cn('num', !r.customer.phone && 'text-muted-foreground')}>
            {r.customer.phone || t('noPhone')}
          </dd>
        </div>
      </dl>

      <div className="mt-auto grid grid-cols-2 gap-3">
        {tel && sms ? (
          <>
            <Button asChild variant="outline">
              <a href={tel} aria-label={t('callName', { name: r.customer.fullName })}>
                <Phone aria-hidden />
                <span>{t('call')}</span>
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={sms} aria-label={t('textName', { name: r.customer.fullName })}>
                <MessageSquareText aria-hidden />
                <span>{t('text')}</span>
              </a>
            </Button>
          </>
        ) : (
          <Button asChild variant="outline" className="col-span-2">
            <Link href={`/customers/${r.customer.id}`}>
              <UserRoundPen aria-hidden />
              <span>{t('addPhone')}</span>
            </Link>
          </Button>
        )}
        {canClose ? (
          <ReminderDoneButton
            jobId={r.jobId}
            label={t('done')}
            ariaLabel={t('doneName', { name: r.customer.fullName })}
          />
        ) : null}
      </div>
    </li>
  );
}
