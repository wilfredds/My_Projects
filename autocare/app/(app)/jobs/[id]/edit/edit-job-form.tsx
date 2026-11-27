'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Save, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { computeJobTotals } from '@/lib/calc';
import { describeVehicle } from '@/lib/jobs';
import { TotalBar } from '@/components/wizard/total-bar';
import { ServicesStep, PartsStep } from '@/components/wizard/steps-what';
import { ChargesStep, PaymentStep } from '@/components/wizard/steps-money';
import { OdometerField } from '@/components/wizard/steps-who';
import { NextVisitCard } from '@/components/wizard/next-visit';
import { planNextVisit, type NextVisit, type ReminderChoice } from '@/lib/reminders';
import { intlTagFor } from '@/i18n/locales';
import {
  parseKm,
  reminderErrorKey,
  withIntervals,
  type DraftPart,
  type DraftService,
  type JobDraft,
  type MechanicOption,
  type ServiceOption,
  type VehicleOption,
} from '@/components/wizard/wizard-types';
import { saveJobAction } from '../../actions';

/**
 * Editing an existing job.
 *
 * Not a wizard — the owner already knows what they are changing, so everything
 * is on one scrolling page. It reuses the wizard's step components, and the
 * same live total bar, so the arithmetic behaves identically to recording.
 */
export function EditJobForm({
  jobId,
  customerId,
  customerName,
  vehicles,
  catalog,
  mechanics,
  initial,
}: {
  jobId: string;
  customerId: string;
  customerName: string;
  vehicles: VehicleOption[];
  catalog: ServiceOption[];
  mechanics: MechanicOption[];
  initial: {
    vehicleId: string;
    mechanicId: string | null;
    date: string;
    laborCharge: string;
    expenses: string;
    discount: string;
    amountPaid: string;
    paymentMethod: 'CASH' | 'GCASH' | 'OTHER' | '';
    notes: string;
    services: DraftService[];
    parts: DraftPart[];
    odometer: string;
    reminder: ReminderChoice;
    keptVisit?: NextVisit;
  };
}) {
  const t = useTranslations('jobs');
  const tj = useTranslations('job');
  const tcom = useTranslations('common');
  const terr = useTranslations('errors');
  const tag = intlTagFor(useLocale());
  const router = useRouter();

  const [draft, setDraft] = React.useState<JobDraft>({ customerId, ...initial });
  const [saving, startSaving] = React.useTransition();

  const totals = React.useMemo(
    () =>
      computeJobTotals({
        laborCharge: draft.laborCharge,
        expenses: draft.expenses,
        discount: draft.discount,
        amountPaid: draft.amountPaid,
        parts: draft.parts.map((p) => ({ quantity: p.quantity, unitPrice: p.unitPrice })),
        services: draft.services.map((s) => ({ price: s.price })),
      }),
    [draft],
  );

  const intervalServices = React.useMemo(
    () => withIntervals(draft.services, catalog),
    [draft.services, catalog],
  );
  const nextVisit = React.useMemo(
    () =>
      planNextVisit({
        jobDate: draft.date,
        odometerKm: parseKm(draft.odometer),
        services: intervalServices,
        choice: draft.reminder,
        kept: draft.keptVisit,
      }),
    [draft.date, draft.odometer, draft.reminder, draft.keptVisit, intervalServices],
  );
  const vehicle = vehicles.find((v) => v.id === draft.vehicleId) ?? null;

  function patch(changes: Partial<JobDraft>) {
    setDraft((prev) => ({ ...prev, ...changes }));
  }

  function save() {
    startSaving(async () => {
      const result = await saveJobAction({
        id: jobId,
        customerId,
        vehicleId: draft.vehicleId ?? '',
        mechanicId: draft.mechanicId,
        date: draft.date,
        laborCharge: draft.laborCharge || '0',
        expenses: draft.expenses || '0',
        discount: draft.discount || '0',
        amountPaid: draft.amountPaid || '0',
        paymentMethod: draft.paymentMethod || null,
        notes: draft.notes,
        parts: draft.parts.map((p) => ({
          partName: p.partName,
          quantity: p.quantity || '1',
          unitPrice: p.unitPrice || '0',
        })),
        services: draft.services.map((s) => ({
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          price: s.price || '0',
        })),
        odometerKm: draft.odometer,
        nextVisitOn: nextVisit.on,
        nextVisitKm: nextVisit.km,
      });

      if (!result.ok) {
        const key = reminderErrorKey(result.fieldErrors);
        toast.error(key ? terr(key) : tcom('unknownError'));
        return;
      }
      toast.success(t('updated'));
      router.push(`/jobs/${jobId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-10">
      <section className="space-y-5 rounded-2xl border border-border bg-card shadow-surface p-5">
        <div>
          <p className="text-base font-semibold text-muted-foreground">{tj('customer')}</p>
          <p className="text-xl font-bold">{customerName}</p>
        </div>

        <Field label={tj('vehicle')} htmlFor="edit-vehicle">
          <div className="flex flex-wrap gap-3">
            {vehicles.map((vehicle) => (
              <Button
                key={vehicle.id}
                variant={draft.vehicleId === vehicle.id ? 'default' : 'outline'}
                size="default"
                onClick={() => patch({ vehicleId: vehicle.id })}
                aria-pressed={draft.vehicleId === vehicle.id}
              >
                <span>{describeVehicle(vehicle)}</span>
              </Button>
            ))}
          </div>
        </Field>

        <Field label={tj('date')} htmlFor="edit-date">
          <Input
            id="edit-date"
            type="date"
            value={draft.date}
            onChange={(e) => patch({ date: e.target.value })}
          />
        </Field>

        <OdometerField
          value={draft.odometer}
          onChange={(odometer) => patch({ odometer })}
          lastKm={vehicle?.lastOdometerKm ?? null}
          tag={tag}
        />
      </section>

      <ServicesStep
        catalog={catalog}
        services={draft.services}
        onChange={(services) => patch({ services })}
      />

      <PartsStep parts={draft.parts} onChange={(parts) => patch({ parts })} />

      <ChargesStep draft={draft} onChange={patch} mechanics={mechanics} />

      <PaymentStep draft={draft} totals={totals} onChange={patch} />

      <NextVisitCard
        plan={nextVisit}
        choice={draft.reminder}
        onChoice={(reminder) => patch({ reminder })}
        services={intervalServices}
        canKeep={Boolean(initial.keptVisit?.on || initial.keptVisit?.km)}
      />

      <TotalBar totals={totals} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="outline" size="lg" className="sm:flex-1">
          <Link href={`/jobs/${jobId}`}>
            <ArrowLeft aria-hidden />
            <span>{tcom('cancel')}</span>
          </Link>
        </Button>
        <Button size="lg" className="sm:flex-[2]" onClick={save} disabled={saving}>
          <Save aria-hidden />
          <span>{saving ? tcom('saving') : tcom('save')}</span>
        </Button>
      </div>
    </div>
  );
}
