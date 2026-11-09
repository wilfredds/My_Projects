'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Car, Save, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { saveVehicleAction } from '@/app/(app)/vehicles/actions';

export interface VehicleFormValues {
  id?: string;
  customerId: string;
  plateNumber: string;
  make: string;
  model: string;
  year: string;
  color: string;
}

export function VehicleFormDialog({
  initial,
  customers,
  lockedCustomerId,
}: {
  initial?: VehicleFormValues;
  /** Omitted when the owner is already fixed (e.g. on a customer's page). */
  customers?: { id: string; fullName: string }[];
  lockedCustomerId?: string;
}) {
  const t = useTranslations('vehicles');
  const tcom = useTranslations('common');
  const router = useRouter();

  const empty: VehicleFormValues = React.useMemo(
    () => ({
      customerId: lockedCustomerId ?? '',
      plateNumber: '',
      make: '',
      model: '',
      year: '',
      color: '',
    }),
    [lockedCustomerId],
  );

  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<VehicleFormValues>(initial ?? empty);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const isEdit = Boolean(initial?.id);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.plateNumber.trim()) {
      setError(t('plateNumber'));
      return;
    }
    if (!values.customerId) {
      setError(t('owner'));
      return;
    }
    startTransition(async () => {
      const result = await saveVehicleAction({ ...values, id: initial?.id });
      if (!result.ok) {
        toast.error(tcom('unknownError'));
        return;
      }
      toast.success(isEdit ? t('updated') : t('created'));
      setOpen(false);
      if (!isEdit) setValues(empty);
      router.refresh();
    });
  }

  return (
    <>
      {/* On a customer's page "Record a job" is the orange button, so adding a
          vehicle there is outlined rather than competing with it. */}
      <Button
        variant={isEdit || lockedCustomerId ? 'outline' : 'default'}
        size={isEdit ? 'compact' : 'lg'}
        onClick={() => {
          setValues(initial ?? empty);
          setError(null);
          setOpen(true);
        }}
      >
        {isEdit ? <Pencil aria-hidden /> : <Car aria-hidden />}
        <span>{isEdit ? tcom('edit') : t('add')}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={tcom('close')}>
          <DialogHeader>
            <DialogTitle>{isEdit ? t('editTitle') : t('addTitle')}</DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-5">
            {customers && !lockedCustomerId ? (
              <Field label={t('owner')} htmlFor="vf-owner">
                <Select
                  value={values.customerId}
                  onValueChange={(customerId) => setValues((v) => ({ ...v, customerId }))}
                >
                  <SelectTrigger id="vf-owner">
                    <SelectValue placeholder={tcom('search')} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            <Field label={t('plateNumber')} htmlFor="vf-plate" error={error}>
              <Input
                id="vf-plate"
                value={values.plateNumber}
                onChange={(e) => {
                  setValues((v) => ({ ...v, plateNumber: e.target.value.toUpperCase() }));
                  setError(null);
                }}
                autoCapitalize="characters"
                autoFocus
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('make')} hint={tcom('optional')} htmlFor="vf-make">
                <Input
                  id="vf-make"
                  value={values.make}
                  onChange={(e) => setValues((v) => ({ ...v, make: e.target.value }))}
                />
              </Field>
              <Field label={t('model')} hint={tcom('optional')} htmlFor="vf-model">
                <Input
                  id="vf-model"
                  value={values.model}
                  onChange={(e) => setValues((v) => ({ ...v, model: e.target.value }))}
                />
              </Field>
              <Field label={t('year')} hint={tcom('optional')} htmlFor="vf-year">
                <Input
                  id="vf-year"
                  inputMode="numeric"
                  value={values.year}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, year: e.target.value.replace(/[^0-9]/g, '') }))
                  }
                />
              </Field>
              <Field label={t('color')} hint={tcom('optional')} htmlFor="vf-color">
                <Input
                  id="vf-color"
                  value={values.color}
                  onChange={(e) => setValues((v) => ({ ...v, color: e.target.value }))}
                />
              </Field>
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
