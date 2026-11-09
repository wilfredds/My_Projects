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
import {
  WIZARD_STEPS,
  emptyDraft,
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
  const router = useRouter();

  const [customers, setCustomers] = React.useState(initialCustomers);
  const [step, setStep] = React.useState<WizardStep>(
    initialDraft?.customerId ? 'services' : 'customer',
  );
  const [draft, setDraft] = React.useState<JobDraft>({ ...emptyDraft(), ...initialDraft });
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
      });

      if (!result.ok) {
        toast.error(tcom('unknownError'));
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
              // Picking someone moves straight on — one tap, one step.
              patch({ customerId: customer.id, vehicleId: null });
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
          <ReviewStep
            draft={draft}
            totals={totals}
            customerName={selectedCustomer?.fullName ?? ''}
            vehicleLabel={selectedVehicle ? describeVehicle(selectedVehicle) : ''}
            mechanicName={mechanics.find((m) => m.id === draft.mechanicId)?.name ?? null}
          />
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
