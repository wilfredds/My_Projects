import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { requirePageUser } from '@/lib/session';
import { notDeleted } from '@/lib/jobs';
import { decimalToNumber } from '@/lib/utils';
import { lastOdometerByVehicle } from '@/lib/odometer';
import { JobWizard } from '@/components/wizard/job-wizard';
import { nextKey, type JobDraft } from '@/components/wizard/wizard-types';

export const metadata = { title: 'Record New Job — AutoCare' };

/**
 * The New Job wizard page.
 *
 * `?from=<jobId>` pre-fills the wizard from an existing job (the "duplicate a
 * previous job" shortcut), so a repeat customer's regular service is two taps.
 */
export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; customer?: string }>;
}) {
  await requirePageUser();
  const params = await searchParams;
  const t = await getTranslations('wizard');

  const [customers, catalog, mechanics] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        phone: true,
        vehicles: {
          orderBy: { plateNumber: 'asc' },
          select: { id: true, plateNumber: true, make: true, model: true, year: true, color: true },
        },
      },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, defaultPrice: true, remindAfterMonths: true, remindAfterKm: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  const lastKm = await lastOdometerByVehicle(
    prisma,
    customers.flatMap((c) => c.vehicles.map((v) => v.id)),
  );
  const customerOptions = customers.map((c) => ({
    ...c,
    vehicles: c.vehicles.map((v) => ({ ...v, lastOdometerKm: lastKm.get(v.id) ?? null })),
  }));

  let initialDraft: Partial<JobDraft> | undefined;

  if (params.from) {
    const source = await prisma.job.findFirst({
      where: { id: params.from, ...notDeleted },
      include: { parts: true, services: true },
    });
    if (source) {
      initialDraft = {
        customerId: source.customerId,
        vehicleId: source.vehicleId,
        mechanicId: source.mechanicId,
        laborCharge: decimalToNumber(source.laborCharge).toFixed(2),
        expenses: decimalToNumber(source.expenses).toFixed(2),
        discount: decimalToNumber(source.discount).toFixed(2),
        // Payment is intentionally NOT copied: a new job starts unpaid.
        amountPaid: '',
        paymentMethod: '',
        notes: source.notes ?? '',
        services: source.services.map((s) => ({
          key: nextKey('svc'),
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          price: decimalToNumber(s.price).toFixed(2),
        })),
        parts: source.parts.map((p) => ({
          key: nextKey('part'),
          partName: p.partName,
          quantity: String(p.quantity),
          unitPrice: decimalToNumber(p.unitPrice).toFixed(2),
        })),
      };
    }
  } else if (params.customer) {
    initialDraft = { customerId: params.customer };
  }

  return (
    <div className="space-y-6">
      <h1 className="sr-only">{t('title')}</h1>
      <JobWizard
        customers={customerOptions}
        catalog={catalog.map((s) => ({
          id: s.id,
          name: s.name,
          defaultPrice: decimalToNumber(s.defaultPrice),
          remindAfterMonths: s.remindAfterMonths,
          remindAfterKm: s.remindAfterKm,
        }))}
        mechanics={mechanics}
        initialDraft={initialDraft}
      />
    </div>
  );
}
