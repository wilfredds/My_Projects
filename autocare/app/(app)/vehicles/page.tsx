import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Search, Car } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePageUser } from '@/lib/session';
import { describeVehicle } from '@/lib/jobs';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { RowList } from '@/components/ui/card';
import { Plate } from '@/components/ui/plate';
import { VehicleFormDialog } from '@/components/forms/vehicle-form';

export const metadata = { title: 'Vehicles — AutoCare' };
export const dynamic = 'force-dynamic';

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePageUser();
  const { q } = await searchParams;
  const [t, tcom, td] = await Promise.all([
    getTranslations('vehicles'),
    getTranslations('common'),
    getTranslations('dashboard'),
  ]);

  const where: Prisma.VehicleWhereInput = q
    ? {
        OR: [
          { plateNumber: { contains: q, mode: 'insensitive' } },
          { customer: { fullName: { contains: q, mode: 'insensitive' } } },
        ],
      }
    : {};

  const [vehicles, customers] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy: { plateNumber: 'asc' },
      take: 200,
      include: {
        customer: { select: { id: true, fullName: true } },
        _count: { select: { jobs: true } },
      },
    }),
    prisma.customer.findMany({ orderBy: { fullName: 'asc' }, select: { id: true, fullName: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{t('title')}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{t('subtitle')}</p>
        </div>
        <VehicleFormDialog customers={customers} />
      </div>

      <form className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Field label={t('searchPlaceholder')} htmlFor="vehicle-search">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="vehicle-search"
                name="q"
                type="search"
                defaultValue={q ?? ''}
                className="pl-14"
              />
            </div>
            <Button type="submit" variant="secondary">
              <Search aria-hidden />
              <span>{tcom('search')}</span>
            </Button>
          </div>
        </Field>
      </form>

      {vehicles.length === 0 ? (
        <EmptyState title={q ? tcom('noResults') : t('empty')} icon={<Car className="size-12" />} />
      ) : (
        <RowList>
          {vehicles.map((vehicle) => {
            const details = describeVehicle(vehicle).replace(`${vehicle.plateNumber} — `, '');
            const hasDetails = details && details !== vehicle.plateNumber;
            return (
              <li key={vehicle.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
                <div className="min-w-0 flex-1 basis-56">
                  <Plate>{vehicle.plateNumber}</Plate>
                  <p className="mt-2 text-lg">{hasDetails ? details : tcom('notSet')}</p>
                  <p className="mt-0.5 text-base text-muted-foreground">
                    <Link
                      href={`/customers/${vehicle.customer.id}`}
                      className="font-semibold text-primary-strong underline underline-offset-4 hover:no-underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
                    >
                      {vehicle.customer.fullName}
                    </Link>
                    {' · '}
                    {td('jobsCount', { count: vehicle._count.jobs })}
                  </p>
                </div>
                <VehicleFormDialog
                  customers={customers}
                  initial={{
                    id: vehicle.id,
                    customerId: vehicle.customerId,
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
    </div>
  );
}
