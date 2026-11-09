import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import { ArrowLeft, PlusCircle, Phone, MapPin } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { formatPeso } from '@/lib/calc';
import { intlTagFor } from '@/i18n/locales';
import { decimalToNumber, formatDate } from '@/lib/utils';
import { describeVehicle, notDeleted } from '@/lib/jobs';
import { Button } from '@/components/ui/button';
import { Card, Ledger, LedgerRow, RowList } from '@/components/ui/card';
import { Plate } from '@/components/ui/plate';
import { EmptyState } from '@/components/ui/misc';
import { JobList, JobRow } from '@/components/jobs/job-row';
import { CustomerFormDialog } from '@/components/forms/customer-form';
import { VehicleFormDialog } from '@/components/forms/vehicle-form';
import { DeleteCustomerButton } from './delete-customer-button';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;

  const [t, tj, tcom, tnav, locale] = await Promise.all([
    getTranslations('customers'),
    getTranslations('job'),
    getTranslations('common'),
    getTranslations('nav'),
    getLocale(),
  ]);
  const tag = intlTagFor(locale);

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      // Counts trashed jobs too: those still hold the customer's receipts, and
      // the delete action refuses while any exist.
      _count: { select: { jobs: true } },
      vehicles: { orderBy: { plateNumber: 'asc' } },
      jobs: {
        where: notDeleted,
        orderBy: { date: 'desc' },
        include: { vehicle: { select: { plateNumber: true } } },
      },
    },
  });

  if (!customer) notFound();

  const totalSpent = customer.jobs.reduce((sum, job) => sum + decimalToNumber(job.amountPaid), 0);
  const outstanding = customer.jobs.reduce((sum, job) => sum + decimalToNumber(job.balance), 0);

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="compact" className="-ml-2">
          <Link href="/customers">
            <ArrowLeft aria-hidden />
            <span>{tcom('back')}</span>
          </Link>
        </Button>
        <h1 className="mt-2 [overflow-wrap:anywhere]">{customer.fullName}</h1>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-lg text-muted-foreground">
          {customer.phone ? (
            <span className="flex items-center gap-2">
              <Phone className="size-5" aria-hidden />
              {customer.phone}
            </span>
          ) : null}
          {customer.address ? (
            <span className="flex items-center gap-2">
              <MapPin className="size-5" aria-hidden />
              {customer.address}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button asChild size="lg">
          <Link href={`/jobs/new?customer=${customer.id}`}>
            <PlusCircle aria-hidden />
            <span>{tnav('newJob')}</span>
          </Link>
        </Button>
        <CustomerFormDialog
          triggerVariant="outline"
          initial={{
            id: customer.id,
            fullName: customer.fullName,
            phone: customer.phone ?? '',
            address: customer.address ?? '',
            notes: customer.notes ?? '',
          }}
        />
      </div>

      <Ledger>
        <LedgerRow label={t('jobCount')} value={String(customer.jobs.length)} />
        <LedgerRow label={t('totalSpent')} value={formatPeso(totalSpent, tag)} />
        <LedgerRow
          label={tj('balance')}
          value={formatPeso(outstanding, tag)}
          tone={outstanding > 0 ? 'owed' : 'default'}
        />
      </Ledger>

      {customer.notes ? (
        <Card className="p-5">
          <p className="text-base font-semibold text-muted-foreground">{t('notes')}</p>
          <p className="mt-1 whitespace-pre-wrap text-lg">{customer.notes}</p>
        </Card>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2>{t('vehicles')}</h2>
          <VehicleFormDialog lockedCustomerId={customer.id} />
        </div>

        {customer.vehicles.length === 0 ? (
          <EmptyState title={t('noVehicles')} />
        ) : (
          <RowList>
            {customer.vehicles.map((vehicle) => {
              const details = describeVehicle(vehicle).replace(`${vehicle.plateNumber} — `, '');
              return (
                <li
                  key={vehicle.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 sm:px-6"
                >
                  <span className="min-w-0 flex-1 basis-48">
                    <Plate>{vehicle.plateNumber}</Plate>
                    <span className="mt-2 block text-lg">
                      {details && details !== vehicle.plateNumber ? details : tcom('notSet')}
                    </span>
                  </span>
                  <VehicleFormDialog
                    lockedCustomerId={customer.id}
                    initial={{
                      id: vehicle.id,
                      customerId: customer.id,
                      plateNumber: vehicle.plateNumber,
                      make: vehicle.make ?? '',
                      model: vehicle.model ?? '',
                      year: vehicle.year ? String(vehicle.year) : '',
                      color: vehicle.color ?? '',
                    }}
                  />
                </li>
              );
            })}
          </RowList>
        )}
      </section>

      <section className="space-y-4">
        <h2>{t('jobHistory')}</h2>
        {customer.jobs.length === 0 ? (
          <EmptyState title={t('noJobs')} />
        ) : (
          <JobList>
            {customer.jobs.map((job) => (
              <li key={job.id}>
                <JobRow
                  href={`/jobs/${job.id}`}
                  plate={job.vehicle.plateNumber}
                  date={formatDate(job.date, tag)}
                  jobNumber={job.jobNumber}
                  amount={formatPeso(decimalToNumber(job.total), tag)}
                  status={job.status}
                  statusLabel={tj(`status_${job.status}` as never)}
                />
              </li>
            ))}
          </JobList>
        )}
      </section>

      {/* Removing a customer is only possible while they have no jobs on record
          (their receipts would be orphaned), so the button only appears then. */}
      {can.deleteCustomers(user.role) && customer._count.jobs === 0 ? (
        <div className="border-t border-border pt-6">
          <DeleteCustomerButton
            customerId={customer.id}
            customerName={customer.fullName}
            jobCount={customer._count.jobs}
          />
        </div>
      ) : null}
    </div>
  );
}
