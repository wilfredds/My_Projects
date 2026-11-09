'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Banknote, Smartphone, MoreHorizontal, Check, Wallet, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyInput, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Separator } from '@/components/ui/misc';
import { cn, formatDate } from '@/lib/utils';
import { formatPeso, computeLineTotal, type JobTotals } from '@/lib/calc';
import { intlTagFor } from '@/i18n/locales';
import type { DraftPart, DraftService, JobDraft, MechanicOption } from './wizard-types';

/* ------------------------------------------------------------------ step 5 */

/** Labour, other expenses and discount. One field per row, all optional. */
export function ChargesStep({
  draft,
  onChange,
  mechanics,
}: {
  draft: JobDraft;
  onChange: (patch: Partial<JobDraft>) => void;
  mechanics: MechanicOption[];
}) {
  const t = useTranslations('wizard');
  const tj = useTranslations('job');
  const tcom = useTranslations('common');

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t('chargesQuestion')}</h2>
        <p className="text-lg text-muted-foreground">{t('chargesHint')}</p>
      </div>

      <Field label={tj('labor')} htmlFor="labor">
        <MoneyInput
          id="labor"
          value={draft.laborCharge}
          onChange={(e) => onChange({ laborCharge: e.target.value })}
          placeholder="0.00"
        />
      </Field>

      <Field label={tj('expenses')} htmlFor="expenses">
        <MoneyInput
          id="expenses"
          value={draft.expenses}
          onChange={(e) => onChange({ expenses: e.target.value })}
          placeholder="0.00"
        />
      </Field>

      <Field label={tj('discount')} htmlFor="discount">
        <MoneyInput
          id="discount"
          value={draft.discount}
          onChange={(e) => onChange({ discount: e.target.value })}
          placeholder="0.00"
        />
      </Field>

      {mechanics.length > 0 ? (
        <Field label={tj('mechanic')} hint={tcom('optional')} htmlFor="mechanic">
          <div className="flex flex-wrap gap-3">
            <Choice active={draft.mechanicId === null} onClick={() => onChange({ mechanicId: null })}>
              <span>{tcom('none')}</span>
            </Choice>
            {mechanics.map((mechanic) => (
              <Choice
                key={mechanic.id}
                active={draft.mechanicId === mechanic.id}
                onClick={() => onChange({ mechanicId: mechanic.id })}
              >
                <span>{mechanic.name}</span>
              </Choice>
            ))}
          </div>
        </Field>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ step 6 */

/**
 * Payment. The two shortcuts cover the overwhelming majority of real jobs —
 * paid in full, or nothing yet — so the amount usually needs no typing at all.
 * Balance and status are derived, never entered.
 */
export function PaymentStep({
  draft,
  totals,
  onChange,
}: {
  draft: JobDraft;
  totals: JobTotals;
  onChange: (patch: Partial<JobDraft>) => void;
}) {
  const t = useTranslations('wizard');
  const tj = useTranslations('job');
  const tcom = useTranslations('common');
  const tag = intlTagFor(useLocale());

  const methods = [
    { value: 'CASH' as const, icon: Banknote },
    { value: 'GCASH' as const, icon: Smartphone },
    { value: 'OTHER' as const, icon: MoreHorizontal },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t('paymentQuestion')}</h2>
        <p className="text-lg text-muted-foreground">{t('paymentHint')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          variant="secondary"
          size="lg"
          onClick={() =>
            onChange({
              amountPaid: totals.total.toFixed(2),
              paymentMethod: draft.paymentMethod || 'CASH',
            })
          }
        >
          <Wallet aria-hidden />
          <span>{t('paymentFull')}</span>
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => onChange({ amountPaid: '0', paymentMethod: '' })}
        >
          <XCircle aria-hidden />
          <span>{t('paymentNothing')}</span>
        </Button>
      </div>

      <Field label={tj('amountPaid')} htmlFor="amount-paid">
        <MoneyInput
          id="amount-paid"
          value={draft.amountPaid}
          onChange={(e) => onChange({ amountPaid: e.target.value })}
          placeholder="0.00"
        />
      </Field>

      <Field label={tj('paymentMethod')} hint={tcom('optional')}>
        <div className="grid gap-3 sm:grid-cols-3">
          {methods.map(({ value, icon: Icon }) => (
            <Choice
              key={value}
              size="lg"
              active={draft.paymentMethod === value}
              onClick={() =>
                onChange({ paymentMethod: draft.paymentMethod === value ? '' : value })
              }
            >
              <Icon aria-hidden />
              <span>{tj(`method_${value}` as never)}</span>
            </Choice>
          ))}
        </div>
      </Field>

      {/* Derived figures — shown, never typed. */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span className="text-lg font-semibold text-muted-foreground">{tj('balance')}</span>
          <span className={cn('money ml-auto font-bold', totals.balance > 0 && 'text-destructive')}>
            {formatPeso(totals.balance, tag)}
          </span>
        </div>
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span className="text-lg font-semibold text-muted-foreground">{tj('status')}</span>
          <Badge variant={statusVariant(totals.status)}>
            {tj(`status_${totals.status}` as never)}
          </Badge>
        </div>
      </div>

      <Field label={tj('notes')} hint={tcom('optional')} htmlFor="job-notes">
        <Textarea
          id="job-notes"
          value={draft.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ step 7 */

/** Everything on one screen for a final look before saving. */
export function ReviewStep({
  draft,
  totals,
  customerName,
  vehicleLabel,
  mechanicName,
}: {
  draft: JobDraft;
  totals: JobTotals;
  customerName: string;
  vehicleLabel: string;
  mechanicName: string | null;
}) {
  const t = useTranslations('wizard');
  const tj = useTranslations('job');
  const tag = intlTagFor(useLocale());

  const rows: { label: string; value: string; tone?: 'muted' | 'negative' }[] = [
    { label: tj('servicesTotal'), value: formatPeso(totals.servicesTotal, tag) },
    { label: tj('partsTotal'), value: formatPeso(totals.partsTotal, tag) },
    { label: tj('labor'), value: formatPeso(totals.laborCharge, tag) },
    { label: tj('expenses'), value: formatPeso(totals.expenses, tag) },
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold">{t('reviewQuestion')}</h2>

      <dl className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <dt className="text-base font-semibold text-muted-foreground">{tj('customer')}</dt>
          <dd className="text-xl font-bold [overflow-wrap:anywhere]">{customerName}</dd>
        </div>
        <div>
          <dt className="text-base font-semibold text-muted-foreground">{tj('vehicle')}</dt>
          <dd className="text-xl font-bold">{vehicleLabel}</dd>
        </div>
        <div>
          <dt className="text-base font-semibold text-muted-foreground">{tj('date')}</dt>
          {/* The draft holds "2026-11-09"; read it as a local date, not UTC. */}
          <dd className="text-lg">{draft.date ? formatDate(`${draft.date}T00:00:00`, tag) : ''}</dd>
        </div>
        {mechanicName ? (
          <div>
            <dt className="text-base font-semibold text-muted-foreground">{tj('mechanic')}</dt>
            <dd className="text-lg">{mechanicName}</dd>
          </div>
        ) : null}
      </dl>

      <ReviewLines
        title={tj('servicesDone')}
        empty={tj('noServices')}
        lines={draft.services.map((s: DraftService) => ({
          key: s.key,
          label: s.serviceName,
          amount: formatPeso(s.price, tag),
        }))}
      />

      <ReviewLines
        title={tj('spareParts')}
        empty={tj('noParts')}
        lines={draft.parts.map((p: DraftPart) => ({
          key: p.key,
          label: `${p.partName} × ${p.quantity}`,
          amount: formatPeso(computeLineTotal(p.quantity, p.unitPrice), tag),
        }))}
      />

      <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <span className="text-lg text-muted-foreground">{row.label}</span>
            <span className="num text-xl font-semibold">{row.value}</span>
          </div>
        ))}

        <Separator />

        <div className="flex items-center justify-between gap-4">
          <span className="text-lg font-semibold">{tj('subtotal')}</span>
          <span className="money">{formatPeso(totals.subtotal, tag)}</span>
        </div>

        {totals.discount > 0 ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-lg text-muted-foreground">{tj('discount')}</span>
            <span className="money text-destructive">−{formatPeso(totals.discount, tag)}</span>
          </div>
        ) : null}

        <Separator />

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="font-display text-xl font-bold uppercase tracking-wide">{tj('total')}</span>
          <span className="grand-total ml-auto font-bold">{formatPeso(totals.total, tag)}</span>
        </div>

        <Separator />

        <div className="flex items-baseline justify-between gap-4">
          <span className="text-lg text-muted-foreground">{tj('amountPaid')}</span>
          <span className="money font-semibold">{formatPeso(totals.amountPaid, tag)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-lg text-muted-foreground">{tj('balance')}</span>
          <span className={cn('money font-bold', totals.balance > 0 && 'text-destructive')}>
            {formatPeso(totals.balance, tag)}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span className="text-lg text-muted-foreground">{tj('status')}</span>
          <Badge variant={statusVariant(totals.status)}>
            {tj(`status_${totals.status}` as never)}
          </Badge>
        </div>
      </div>

      {draft.notes.trim() ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-base font-semibold text-muted-foreground">{tj('notes')}</p>
          <p className="mt-1 whitespace-pre-wrap text-lg">{draft.notes}</p>
        </div>
      ) : null}
    </div>
  );
}

function ReviewLines({
  title,
  empty,
  lines,
}: {
  title: string;
  empty: string;
  lines: { key: string; label: string; amount: string }[];
}) {
  return (
    <div className="space-y-2">
      <h3>{title}</h3>
      {lines.length === 0 ? (
        <p className="text-lg text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {lines.map((line) => (
            <li key={line.key} className="flex items-baseline justify-between gap-4 p-4 sm:px-5">
              <span className="min-w-0 flex-1 text-lg [overflow-wrap:anywhere]">{line.label}</span>
              <span className="num text-xl font-semibold">{line.amount}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A pick-one option (mechanic, payment method). Chosen shows as an orange edge
 * on a pale orange fill with a tick — not a solid orange button, which would
 * look like the "Next" button and compete with it.
 */
function Choice({
  active,
  onClick,
  size = 'default',
  children,
}: {
  active: boolean;
  onClick: () => void;
  size?: 'default' | 'lg';
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size={size}
      onClick={onClick}
      aria-pressed={active}
      className={cn(active && 'border-primary bg-primary-tint hover:bg-primary-tint')}
    >
      {children}
      {active ? <Check aria-hidden strokeWidth={3} className="text-primary-strong" /> : null}
    </Button>
  );
}

export { Check };
