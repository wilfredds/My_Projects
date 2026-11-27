'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Save, CheckCircle2, FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { computeJobTotals } from '@/lib/calc';
import { describeVehicle } from '@/lib/jobs';
import { Stepper } from './stepper';
import { TotalBar } from './total-bar';
import { CustomerStep, VehicleStep } from './steps-who';
import { ServicesStep, PartsStep } from './steps-what';
import { ChargesStep, PaymentStep, ReviewStep } from './steps-money';
import { NextVisitCard } from './next-visit';
import { planNextVisit } from '@/lib/reminders';
import {
  WIZARD_STEPS,
  emptyDraft,
  parseKm,
  reminderErrorKey,
  withIntervals,
  type CustomerOption,
  type JobDraft,
  type MechanicOption,
  type ServiceOption,
  type VehicleOption,
  type WizardStep,
} from './wizard-types';
import { createCustomerInline, createVehicleInline, saveJobAction } from '@/app/(app)/jobs/actions';

/**
 * The New Job wizard — the screen this whole application exists for.
 *
 * Design rules it enforces:
 *   * One decision per screen, with 80px Back / Next buttons.
 *   * The grand total is recomputed from `computeJobTotals` on every keystroke
 *     and displayed in a bar that is always on screen. It is never an input.
 *   * A returning customer's name and plate are chosen from lists, never typed.
 */
export function JobWizard({
  customers: initialCustomers,
  catalog,
  mechanics,
  initialDraft,
}: {
  customers: CustomerOption[];
  catalog: ServiceOption[];
  mechanics: MechanicOption[];
  initialDraft?: Partial<JobDraft>;
}) {
  const t = useTranslations('wizard');
  const tcom = useTranslations('common');
  const terr = useTranslations('errors');
  const router = useRouter();

  const [customers, setCustomers] = React.useState(initialCustomers);

  // Where to begin. "Copy to a new job" knows the customer AND the vehicle, so
  // it starts at the services. "Record a job" from a customer's page knows only
  // the customer: it starts at the vehicle — with it already chosen if they
  // have just one — because a job cannot be saved without one.
  const [draft, setDraft] = React.useState<JobDraft>(() => {
    const start = { ...emptyDraft(), ...initialDraft };
    if (start.customerId && !start.vehicleId) {
      const owner = initialCustomers.find((c) => c.id === start.customerId);
      if (owner?.vehicles.length === 1) start.vehicleId = owner.vehicles[0]!.id;
    }
    return start;
  });
  const [step, setStep] = React.useState<WizardStep>(() =>
    initialDraft?.customerId && initialDraft?.vehicleId
      ? 'services'
      : initialDraft?.customerId
        ? 'vehicle'
        : 'customer',
  );
  const [busy, setBusy] = React.useState(false);
  const [saving, startSaving] = React.useTransition();
  const [saved, setSaved] = React.useState<{ id: string; jobNumber: string } | null>(null);

  // THE live total. Recomputed on every render from the same pure function the
  // server uses, so what the owner reads is exactly what gets stored.
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

  const selectedCustomer = customers.find((c) => c.id === draft.customerId) ?? null;
  const vehicles: VehicleOption[] = selectedCustomer?.vehicles ?? [];
  const selectedVehicle = vehicles.find((v) => v.id === draft.vehicleId) ?? null;

  // When the car should come back, worked out from the services chosen (the
  // catalog knows how often each repeats) unless the owner picked otherwise.
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

  const stepIndex = WIZARD_STEPS.indexOf(step);

  function patch(changes: Partial<JobDraft>) {
    setDraft((prev) => ({ ...prev, ...changes }));
  }

  /** Guard rails so Next never leads to a step that cannot be filled in. */
  function canAdvance(): boolean {
    if (step === 'customer' && !draft.customerId) {
      toast.error(t('missingCustomer'));
      return false;
    }
    if (step === 'vehicle' && !draft.vehicleId) {
      toast.error(t('missingVehicle'));
      return false;
    }
    return true;
  }

  function goNext() {
    if (!canAdvance()) return;
    const next = WIZARD_STEPS[Math.min(WIZARD_STEPS.length - 1, stepIndex + 1)];
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBack() {
    const prev = WIZARD_STEPS[Math.max(0, stepIndex - 1)];
    setStep(prev);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleCreateCustomer(input: {
    fullName: string;
    phone: string;
    address: string;
  }) {
    setBusy(true);
    try {
      const result = await createCustomerInline(input);
      if (!result.ok || !result.data) {
        toast.error(tcom('unknownError'));
        return;
      }
      const created: CustomerOption = { ...result.data, vehicles: [] };
      setCustomers((prev) => [created, ...prev]);
      patch({ customerId: created.id, vehicleId: null });
      toast.success(t('customerSelected'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateVehicle(input: {
    plateNumber: string;
    make: string;
    model: string;
    color: string;
  }) {
    if (!draft.customerId) return;
    setBusy(true);
    try {
      const result = await createVehicleInline({ ...input, customerId: draft.customerId });
      if (!result.ok || !result.data) {
        toast.error(tcom('unknownError'));
        return;
      }
      const vehicle = result.data;
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === draft.customerId ? { ...c, vehicles: [...c.vehicles, vehicle] } : c,
        ),
      );
      patch({ vehicleId: vehicle.id });
    } finally {
      setBusy(false);
    }
  }

  function handleSave() {
    // Belt and braces: never send a job the server must refuse.
    if (!draft.customerId) {
      toast.error(t('missingCustomer'));
      setStep('customer');
      return;
    }
    if (!draft.vehicleId) {
      toast.error(t('missingVehicle'));
      setStep('vehicle');
      return;
    }
    startSaving(async () => {
      const result = await saveJobAction({
        customerId: draft.customerId ?? '',
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
        if (key === 'invalidNumber') setStep('vehicle'); // the odometer lives there
        return;
      }
      setSaved(result.data ?? null);
    });
  }

  return (
    <div className="space-y-8">
      <Stepper current={step} />

      <div className="min-h-[24rem]">
        {step === 'customer' ? (
          <CustomerStep
            customers={customers}
            selectedId={draft.customerId}
            creating={busy}
            onSelect={(customer) => {
              // Picking someone moves straight on — one tap, one step. Most
              // customers have one car, so it is already chosen for them; the
              // owner only has to look and press Next.
              const only = customer.vehicles.length === 1 ? customer.vehicles[0]!.id : null;
              patch({ customerId: customer.id, vehicleId: only });
              setStep('vehicle');
            }}
            onClear={() => patch({ customerId: null, vehicleId: null })}
            onCreate={handleCreateCustomer}
          />
        ) : null}

        {step === 'vehicle' ? (
          <VehicleStep
            vehicles={vehicles}
            selectedId={draft.vehicleId}
            creating={busy}
            onSelect={(vehicleId) => patch({ vehicleId })}
            onCreate={handleCreateVehicle}
            odometer={draft.odometer}
            onOdometer={(odometer) => patch({ odometer })}
          />
        ) : null}

        {step === 'services' ? (
          <ServicesStep
            catalog={catalog}
            services={draft.services}
            onChange={(services) => patch({ services })}
          />
        ) : null}

        {step === 'parts' ? (
          <PartsStep parts={draft.parts} onChange={(parts) => patch({ parts })} />
        ) : null}

        {step === 'charges' ? (
          <ChargesStep draft={draft} onChange={patch} mechanics={mechanics} />
        ) : null}

        {step === 'payment' ? (
          <PaymentStep draft={draft} totals={totals} onChange={patch} />
        ) : null}

        {step === 'review' ? (
          <div className="space-y-8">
            <ReviewStep
              draft={draft}
              totals={totals}
              customerName={selectedCustomer?.fullName ?? ''}
              vehicleLabel={selectedVehicle ? describeVehicle(selectedVehicle) : ''}
              mechanicName={mechanics.find((m) => m.id === draft.mechanicId)?.name ?? null}
            />
            <NextVisitCard
              plan={nextVisit}
              choice={draft.reminder}
              onChoice={(reminder) => patch({ reminder })}
              services={intervalServices}
            />
          </div>
        ) : null}
      </div>

      {/* Always visible, always current. */}
      <TotalBar totals={totals} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          size="lg"
          className="sm:flex-1"
          onClick={goBack}
          disabled={stepIndex === 0 || saving}
        >
          <ArrowLeft aria-hidden />
          <span>{tcom('back')}</span>
        </Button>

        {step === 'review' ? (
          <Button size="lg" className="sm:flex-[2]" onClick={handleSave} disabled={saving}>
            <Save aria-hidden />
            <span>{saving ? tcom('saving') : t('saveJob')}</span>
          </Button>
        ) : (
          <Button size="lg" className="sm:flex-[2]" onClick={goNext} disabled={saving}>
            <span>{tcom('next')}</span>
            <ArrowRight aria-hidden />
          </Button>
        )}
      </div>

      {/* Success confirmation — a clear "it worked", not a fleeting toast. */}
      <Dialog open={Boolean(saved)} onOpenChange={() => {}}>
        <DialogContent closeLabel={tcom('close')} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <span className="flex size-16 items-center justify-center rounded-full bg-primary-tint text-primary-strong">
              <CheckCircle2 className="size-10" aria-hidden />
            </span>
            <DialogTitle>{t('savedTitle')}</DialogTitle>
            <DialogDescription>
              {t('savedBody', { number: saved?.jobNumber ?? '' })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Button asChild size="lg">
              <Link href={saved ? `/jobs/${saved.id}` : '/jobs'}>
                <FileText aria-hidden />
                <span>{t('viewJob')}</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setSaved(null);
                setDraft(emptyDraft());
                setStep('customer');
                router.refresh();
              }}
            >
              <Plus aria-hidden />
              <span>{t('recordAnother')}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
