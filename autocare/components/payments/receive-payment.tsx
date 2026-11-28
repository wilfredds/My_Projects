'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Banknote, Check, MoreHorizontal, Save, Smartphone, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Separator } from '@/components/ui/misc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatPeso, toCentavos } from '@/lib/calc';
import { intlTagFor } from '@/i18n/locales';
import { receivePaymentAction } from '@/app/(app)/jobs/actions';

type Method = 'CASH' | 'GCASH' | 'OTHER';

/**
 * "Tumanggap ng bayad" — the customer comes back to pay what they owe.
 *
 * One amount and one method, with the full balance one tap away. It never
 * accepts more than is still owed; the server checks that again and records
 * the money on today's date, so it counts in today's income.
 */
export function ReceivePaymentButton({
  jobId,
  jobNumber,
  customerName,
  total,
  amountPaid,
  balance,
  primary = false,
  className,
}: {
  jobId: string;
  jobNumber: string;
  customerName: string;
  total: number;
  amountPaid: number;
  balance: number;
  /** The page's main action (a solid button) rather than an outlined one. */
  primary?: boolean;
  className?: string;
}) {
  const t = useTranslations('payments');
  const tj = useTranslations('job');
  const tcom = useTranslations('common');
  const terr = useTranslations('errors');
  const tag = intlTagFor(useLocale());
  const router = useRouter();
  const peso = (v: number) => formatPeso(v, tag);

  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState<Method>('CASH');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  const methods: { value: Method; icon: typeof Banknote }[] = [
    { value: 'CASH', icon: Banknote },
    { value: 'GCASH', icon: Smartphone },
    { value: 'OTHER', icon: MoreHorizontal },
  ];

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const cents = toCentavos(amount.replace(/[₱,\s]/g, ''));
    if (cents <= 0) {
      setError(terr('invalidNumber'));
      return;
    }
    if (cents > toCentavos(balance)) {
      setError(terr('amountPaidTooHigh'));
      return;
    }
    start(async () => {
      const result = await receivePaymentAction({ jobId, amount, method });
      if (!result.ok || !result.data) {
        const key = result.messageKey?.startsWith('errors.') ? result.messageKey.slice(7) : null;
        setError(key ? terr(key as never) : tcom('unknownError'));
        return;
      }
      setOpen(false);
      toast.success(
        result.data.balance > 0
          ? t('receivedPartial', { balance: peso(result.data.balance) })
          : t('receivedFull'),
      );
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant={primary ? 'default' : 'outline'}
        size={primary ? 'lg' : 'default'}
        className={className}
        onClick={() => {
          setAmount('');
          setMethod('CASH');
          setError(null);
          setOpen(true);
        }}
        aria-label={t('receiveFor', { number: jobNumber, name: customerName })}
      >
        <Wallet aria-hidden />
        <span>{t('receive')}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tcom('close')}>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>
              {jobNumber} · {customerName}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-5">
            <dl className="space-y-2 rounded-xl bg-muted px-4 py-3 text-lg">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">{tj('total')}</dt>
                <dd className="num font-semibold">{peso(total)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">{tj('amountPaid')}</dt>
                <dd className="num font-semibold">{peso(amountPaid)}</dd>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold">{tj('balance')}</dt>
                <dd className="money font-bold text-destructive">{peso(balance)}</dd>
              </div>
            </dl>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                setAmount(balance.toFixed(2));
                setError(null);
              }}
            >
              <span>{t('payAll', { amount: peso(balance) })}</span>
            </Button>

            <Field label={t('amount')} htmlFor="rp-amount" error={error}>
              <MoneyInput
                id="rp-amount"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                placeholder="0.00"
                autoFocus
              />
            </Field>

            <Field label={tj('paymentMethod')}>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label={tj('paymentMethod')}>
                {methods.map(({ value, icon: Icon }) => {
                  const active = method === value;
                  return (
                    <Button
                      key={value}
                      type="button"
                      variant="outline"
                      size="compact"
                      aria-pressed={active}
                      onClick={() => setMethod(value)}
                      className={cn(active && 'border-primary bg-primary-tint hover:bg-primary-tint')}
                    >
                      <Icon aria-hidden />
                      <span>{tj(`method_${value}` as never)}</span>
                      {active ? <Check aria-hidden strokeWidth={3} className="text-primary-strong" /> : null}
                    </Button>
                  );
                })}
              </div>
            </Field>

            <DialogFooter>
              <Button type="submit" size="lg" disabled={pending} className="sm:flex-1">
                <Save aria-hidden />
                <span>{pending ? tcom('saving') : t('save')}</span>
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)} disabled={pending}>
                <span>{tcom('cancel')}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
