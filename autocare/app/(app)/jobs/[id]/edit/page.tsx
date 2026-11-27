import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { requirePageUser } from '@/lib/session';
import { notDeleted } from '@/lib/jobs';
import { decimalToNumber } from '@/lib/utils';
import { toDateInputValue } from '@/lib/utils';
import { lastOdometerByVehicle } from '@/lib/odometer';
import { dateToYmd } from '@/lib/reminders';
import { EditJobForm } from './edit-job-form';

export const dynamic = 'force-dynamic';

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  const { id } = await params;

  const [job, t] = await Promise.all([
    prisma.job.findFirst({
      where: { id, ...notDeleted },
      include: {
        parts: true,
        services: true,
        customer: { select: { id: true, fullName: true } },
        vehicle: { select: { id: true, plateNumber: true, make: true, model: true, color: true, year: true } },
      },
    }),
    getTranslations('jobs'),
  ]);

  if (!job) notFound();

  const [catalog, mechanics, vehicles] = await Promise.all([
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
    prisma.vehicle.findMany({
      where: { customerId: job.customerId },
      orderBy: { plateNumber: 'asc' },
      select: { id: true, plateNumber: true, make: true, model: true, year: true, color: true },
    }),
  ]);

  // The hint shows the car's reading from its other jobs, not this one's.
  const lastKm = await lastOdometerByVehicle(prisma, vehicles.map((v) => v.id), job.id);
  const kept = {
    on: job.nextVisitOn ? dateToYmd(job.nextVisitOn) : null,
    km: job.nextVisitKm,
  };

  return (
    <div className="space-y-6">
      <h1>{t('editTitle', { number: job.jobNumber })}</h1>

      <EditJobForm
        jobId={job.id}
        customerName={job.customer.fullName}
        customerId={job.customerId}
        vehicles={vehicles.map((v) => ({ ...v, lastOdometerKm: lastKm.get(v.id) ?? null }))}
        catalog={catalog.map((s) => ({
          id: s.id,
          name: s.name,
          defaultPrice: decimalToNumber(s.defaultPrice),
          remindAfterMonths: s.remindAfterMonths,
          remindAfterKm: s.remindAfterKm,
        }))}
        mechanics={mechanics}
        initial={{
          vehicleId: job.vehicleId,
          mechanicId: job.mechanicId,
          date: toDateInputValue(job.date),
          laborCharge: decimalToNumber(job.laborCharge).toFixed(2),
          expenses: decimalToNumber(job.expenses).toFixed(2),
          discount: decimalToNumber(job.discount).toFixed(2),
          amountPaid: decimalToNumber(job.amountPaid).toFixed(2),
          paymentMethod: job.paymentMethod ?? '',
          notes: job.notes ?? '',
          services: job.services.map((s) => ({
            key: s.id,
            serviceId: s.serviceId,
            serviceName: s.serviceName,
            price: decimalToNumber(s.price).toFixed(2),
          })),
          parts: job.parts.map((p) => ({
            key: p.id,
            partName: p.partName,
            quantity: String(p.quantity),
            unitPrice: decimalToNumber(p.unitPrice).toFixed(2),
          })),
          odometer: job.odometerKm !== null ? String(job.odometerKm) : '',
          // Editing never moves an existing date by itself; the owner can.
          reminder: kept.on || kept.km ? 'keep' : 'none',
          keptVisit: kept,
        }}
      />
    </div>
  );
}
