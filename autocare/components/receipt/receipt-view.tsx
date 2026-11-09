import { getTranslations, getLocale } from 'next-intl/server';
import { formatPeso } from '@/lib/calc';
import { intlTagFor } from '@/i18n/locales';
import { formatDate, formatDateTime } from '@/lib/utils';
import { describeVehicle, type SerializedJob } from '@/lib/jobs';
import type { ShopInfo } from '@/lib/settings';

/**
 * The on-screen receipt.
 *
 * The same layout is used for the browser-print fallback: `globals.css` hides
 * every bit of app chrome under `@media print` so Ctrl+P produces the same
 * document as the generated PDF.
 */
export async function ReceiptView({ job, shop }: { job: SerializedJob; shop: ShopInfo }) {
  const [t, tj, locale] = await Promise.all([
    getTranslations('receipt'),
    getTranslations('job'),
    getLocale(),
  ]);
  const tag = intlTagFor(locale);
  const peso = (v: number) => formatPeso(v, tag);

  return (
    <article className="receipt-sheet mx-auto max-w-3xl rounded-2xl border border-border bg-card p-5 text-lg text-foreground sm:p-8">
      <header className="border-b-4 border-foreground pb-4 text-center">
        <h1 className="text-2xl font-bold uppercase tracking-wide">{shop.name}</h1>
        <p className="mt-1 text-base leading-snug">{shop.address}</p>
        <p className="text-base">{shop.phone}</p>
        {shop.email ? <p className="text-base">{shop.email}</p> : null}
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <dl className="space-y-1">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-bold">{t('jobNumber')}</dt>
            <dd className="num">{job.jobNumber}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-bold">{t('date')}</dt>
            <dd>{formatDate(job.date, tag)}</dd>
          </div>
        </dl>
        <dl className="space-y-1 sm:text-right">
          <div className="flex flex-wrap gap-x-2 sm:justify-end">
            <dt className="font-bold">{t('customer')}</dt>
            <dd className="[overflow-wrap:anywhere]">{job.customer.fullName}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2 sm:justify-end">
            <dt className="font-bold">{t('vehicle')}</dt>
            <dd>{describeVehicle(job.vehicle)}</dd>
          </div>
          {job.customer.phone ? <dd className="text-base">{job.customer.phone}</dd> : null}
        </dl>
      </div>

      {job.services.length > 0 ? (
        <section className="mt-6">
          <h2 className="border-b-2 border-foreground pb-1 text-lg font-bold uppercase tracking-wide">
            {t('servicesDone')}
          </h2>
          <ul>
            {job.services.map((service) => (
              <li
                key={service.id}
                className="flex items-baseline justify-between gap-4 border-b border-border py-2"
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">{service.serviceName}</span>
                <span className="num">{peso(service.price)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {job.parts.length > 0 ? (
        <section className="mt-6">
          <h2 className="border-b-2 border-foreground pb-1 text-lg font-bold uppercase tracking-wide">
            {t('spareParts')}
          </h2>
          {/* Two lines per part rather than a four-column table, so it fits a
              phone without sideways scrolling: the name, then "2 × ₱350.00"
              and the line amount. */}
          <ul>
            {job.parts.map((part) => (
              <li key={part.id} className="border-b border-border py-2">
                <span className="block [overflow-wrap:anywhere]">{part.partName}</span>
                <span className="flex items-baseline justify-between gap-4">
                  <span className="num text-base text-muted-foreground">
                    {part.quantity} × {peso(part.unitPrice)}
                  </span>
                  <span className="num">{peso(part.lineTotal)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 space-y-1.5">
        <Line label={t('labor')} value={peso(job.laborCharge)} />
        <Line label={t('expenses')} value={peso(job.expenses)} />
        <div className="border-t-2 border-foreground pt-1.5">
          <Line label={t('subtotal')} value={peso(job.subtotal)} bold />
        </div>
        {job.discount > 0 ? (
          <Line label={t('discount')} value={`− ${peso(job.discount)}`} />
        ) : null}

        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-y-4 border-foreground py-3">
          <span className="font-display text-xl font-bold uppercase tracking-wide">{t('total')}</span>
          <span className="grand-total ml-auto font-bold">{peso(job.total)}</span>
        </div>

        <div className="pt-2">
          <Line label={t('amountPaid')} value={peso(job.amountPaid)} bold />
          <Line label={t('balance')} value={peso(job.balance)} bold />
          {job.paymentMethod ? (
            <Line label={t('paymentMethod')} value={tj(`method_${job.paymentMethod}` as never)} />
          ) : null}
          <Line label={tj('status')} value={tj(`status_${job.status}` as never)} bold />
        </div>
      </section>

      {job.notes ? (
        <section className="mt-6 border-t border-border pt-3">
          <h2 className="text-base font-bold">{t('notes')}</h2>
          <p className="whitespace-pre-wrap text-base">{job.notes}</p>
        </section>
      ) : null}

      <footer className="mt-8 space-y-1 border-t-2 border-foreground pt-4 text-center">
        <p className="text-lg font-bold">{shop.footer || t('thankYou')}</p>
        {job.mechanic ? (
          <p className="text-base">
            {t('servedBy')}: {job.mechanic.name}
          </p>
        ) : job.createdBy ? (
          <p className="text-base">
            {t('servedBy')}: {job.createdBy.name}
          </p>
        ) : null}
        <p className="text-base">
          {t('printedOn')}: {formatDateTime(new Date(), tag)}
        </p>
      </footer>
    </article>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={bold ? 'font-bold' : ''}>{label}</span>
      <span className={`num ${bold ? 'font-bold' : ''}`}>{value}</span>
    </div>
  );
}
