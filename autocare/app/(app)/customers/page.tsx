import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Search, ChevronRight } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePageUser } from '@/lib/session';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { RowList } from '@/components/ui/card';
import { Plate } from '@/components/ui/plate';
import { CustomerFormDialog } from '@/components/forms/customer-form';

export const metadata = { title: 'Customers — AutoCare' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePageUser();
  const { q } = await searchParams;
  const [t, tcom, td] = await Promise.all([
    getTranslations('customers'),
    getTranslations('common'),
    getTranslations('dashboard'),
  ]);

  const where: Prisma.CustomerWhereInput = q
    ? {
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { fullName: 'asc' },
    take: 200,
    include: {
      _count: { select: { vehicles: true, jobs: true } },
      vehicles: { select: { plateNumber: true }, take: 3 },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{t('title')}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{t('subtitle')}</p>
        </div>
        <CustomerFormDialog />
      </div>

      {/* A plain GET form keeps search working even without JavaScript. */}
      <form className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Field label={t('searchPlaceholder')} htmlFor="customer-search">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="customer-search"
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

      {customers.length === 0 ? (
        <EmptyState title={q ? tcom('noResults') : t('empty')} />
      ) : (
        <RowList>
          {customers.map((customer) => {
            const extra = customer._count.vehicles - customer.vehicles.length;
            return (
              <li key={customer.id}>
                <Link
                  href={`/customers/${customer.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold leading-snug [overflow-wrap:anywhere]">
                      {customer.fullName}
                    </span>
                    <span className="mt-0.5 block text-base text-muted-foreground">
                      {[customer.phone, td('jobsCount', { count: customer._count.jobs })]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {customer.vehicles.length > 0 ? (
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        {customer.vehicles.map((v) => (
                          <Plate key={v.plateNumber} className="text-base">
                            {v.plateNumber}
                          </Plate>
                        ))}
                        {extra > 0 ? (
                          <span className="text-base font-semibold text-muted-foreground">+{extra}</span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </RowList>
      )}
    </div>
  );
}
