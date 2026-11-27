'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Save, Pencil, Trash2, Power, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, MoneyInput, KmInput } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Field } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { saveServiceAction, toggleServiceAction, deleteServiceAction } from './actions';

interface ServiceValues {
  id?: string;
  name: string;
  defaultPrice: string;
  isActive: boolean;
  /** Months until the car should come back; '' for none. */
  remindAfterMonths: string;
  /** km until the car should come back; '' for none. */
  remindAfterKm: string;
}

const EMPTY: ServiceValues = {
  name: '',
  defaultPrice: '',
  isActive: true,
  remindAfterMonths: '',
  remindAfterKm: '',
};

/** The quick picks for months, plus a value set some other way, so it still shows. */
function monthChoices(current: string): string[] {
  const base = ['', '1', '3', '6', '12'];
  return current && !base.includes(current) ? [...base, current] : base;
}

export function ServiceFormDialog({ initial }: { initial?: ServiceValues }) {
  const t = useTranslations('services');
  const tcom = useTranslations('common');
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<ServiceValues>(initial ?? EMPTY);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const isEdit = Boolean(initial?.id);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) {
      setError(t('name'));
      return;
    }
    startTransition(async () => {
      const result = await saveServiceAction({ ...values, id: initial?.id });
      if (!result.ok) {
        toast.error(
          result.messageKey === 'services.duplicateName' ? t('duplicateName') : tcom('unknownError'),
        );
        return;
      }
      toast.success(isEdit ? t('updated') : t('created'));
      setOpen(false);
      if (!isEdit) setValues(EMPTY);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant={isEdit ? 'outline' : 'default'}
        size={isEdit ? 'compact' : 'lg'}
        onClick={() => {
          setValues(initial ?? EMPTY);
          setError(null);
          setOpen(true);
        }}
      >
        {isEdit ? <Pencil aria-hidden /> : <Plus aria-hidden />}
        <span>{isEdit ? tcom('edit') : t('add')}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tcom('close')}>
          <DialogHeader>
            <DialogTitle>{isEdit ? t('editTitle') : t('addTitle')}</DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-5">
            <Field label={t('name')} htmlFor="sf-name" error={error}>
              <Input
                id="sf-name"
                value={values.name}
                onChange={(e) => {
                  setValues((v) => ({ ...v, name: e.target.value }));
                  setError(null);
                }}
                autoFocus
              />
            </Field>

            <Field label={t('defaultPrice')} htmlFor="sf-price">
              <MoneyInput
                id="sf-price"
                value={values.defaultPrice}
                onChange={(e) => setValues((v) => ({ ...v, defaultPrice: e.target.value }))}
                placeholder="0.00"
              />
            </Field>

            {/* How often it repeats — what the Babalikan reminders work from. */}
            <div
              role="group"
              aria-labelledby="sf-remind-title"
              className="space-y-4 rounded-xl border border-border bg-muted/40 p-4"
            >
              <div className="space-y-1">
                <p id="sf-remind-title" className="text-lg font-semibold">
                  {t('remindTitle')}
                </p>
                <p className="text-base text-muted-foreground">{t('remindHint')}</p>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t('remindMonths')}>
                {monthChoices(values.remindAfterMonths).map((m) => {
                  const active = values.remindAfterMonths === m;
                  return (
                    <Button
                      key={m || 'none'}
                      type="button"
                      variant="outline"
                      size="compact"
                      aria-pressed={active}
                      className={cn(active && 'border-primary bg-primary-tint hover:bg-primary-tint')}
                      onClick={() =>
                        setValues((v) => ({
                          ...v,
                          remindAfterMonths: m,
                          // No months, no reminder: the km goes too.
                          remindAfterKm: m ? v.remindAfterKm : '',
                        }))
                      }
                    >
                      <span>
                        {m === ''
                          ? t('remindNone')
                          : m === '12'
                            ? t('remindYear')
                            : t('remindEveryMonths', { count: Number(m) })}
                      </span>
                      {active ? <Check aria-hidden strokeWidth={3} className="text-primary-strong" /> : null}
                    </Button>
                  );
                })}
              </div>
              {values.remindAfterMonths ? (
                <Field label={t('remindKm')} hint={tcom('optional')} htmlFor="sf-km">
                  <KmInput
                    id="sf-km"
                    value={values.remindAfterKm}
                    onChange={(e) => setValues((v) => ({ ...v, remindAfterKm: e.target.value }))}
                    placeholder="5,000"
                  />
                </Field>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="submit" size="lg" disabled={pending} className="sm:flex-1">
                <Save aria-hidden />
                <span>{pending ? tcom('saving') : tcom('save')}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                <span>{tcom('cancel')}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Edit / turn on-off / delete for one catalog row. */
export function ServiceRowActions({ service }: { service: ServiceValues & { id: string } }) {
  const t = useTranslations('services');
  const tj = useTranslations('jobs');
  const tcom = useTranslations('common');
  const router = useRouter();

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await toggleServiceAction(service.id, !service.isActive);
      if (!result.ok) {
        toast.error(tcom('unknownError'));
        return;
      }
      toast.success(t('updated'));
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteServiceAction(service.id);
      if (!result.ok) {
        toast.error(tcom('unknownError'));
        setConfirmOpen(false);
        return;
      }
      toast.success(t('deleted'));
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <ServiceFormDialog initial={service} />

      <Button variant="outline" size="compact" onClick={toggle} disabled={pending}>
        <Power aria-hidden />
        <span>{service.isActive ? t('toggleOff') : t('toggleOn')}</span>
      </Button>

      <Button variant="destructive" size="compact" onClick={() => setConfirmOpen(true)}>
        <Trash2 aria-hidden />
        <span>{tcom('delete')}</span>
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('deleteTitle')}
        description={t('deleteBody', { name: service.name })}
        confirmLabel={tj('deleteConfirm')}
        cancelLabel={tj('deleteCancel')}
        onConfirm={remove}
        pending={pending}
      />
    </div>
  );
}
