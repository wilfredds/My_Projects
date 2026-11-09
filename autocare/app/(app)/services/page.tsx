import { getTranslations, getLocale } from 'next-intl/server';
import { Wrench } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requirePageUser } from '@/lib/session';
import { can } from '@/lib/rbac';
import { formatPeso } from '@/lib/calc';
import { intlTagFor } from '@/i18n/locales';
import { decimalToNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { RowList } from '@/components/ui/card';
import { ServiceFormDialog, ServiceRowActions } from './service-controls';

export const metadata = { title: 'Services — AutoCare' };
export const dynamic = 'force-dynamic';

/**
 * The service catalog.
 *
 * ADMIN gets full CRUD. STAFF may look (the role table grants "view service
 * catalog") but sees no edit controls — and the server actions refuse them
 * regardless of what the browser sends.
 */
export default async function ServicesPage() {
  const user = await requirePageUser();
  const [t, locale] = await Promise.all([getTranslations('services'), getLocale()]);
  const tag = intlTagFor(locale);

  const services = await prisma.service.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  const editable = can.manageServices(user.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{t('title')}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{t('subtitle')}</p>
        </div>
        {editable ? <ServiceFormDialog /> : null}
      </div>

      {!editable ? (
        <p className="rounded-2xl border border-border bg-card p-4 text-lg sm:p-5">
          {t('readOnlyNote')}
        </p>
      ) : null}

      {services.length === 0 ? (
        <EmptyState title={t('empty')} icon={<Wrench className="size-12" />} />
      ) : (
        <RowList>
          {services.map((service) => (
            <li
              key={service.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 sm:px-6"
            >
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-lg font-semibold leading-snug [overflow-wrap:anywhere]">{service.name}</p>
                <p className="money mt-0.5">
                  {formatPeso(decimalToNumber(service.defaultPrice), tag)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={service.isActive ? 'outline' : 'muted'}>
                  {service.isActive ? t('active') : t('inactive')}
                </Badge>
                {editable ? (
                  <ServiceRowActions
                    service={{
                      id: service.id,
                      name: service.name,
                      defaultPrice: decimalToNumber(service.defaultPrice).toFixed(2),
                      isActive: service.isActive,
                    }}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </RowList>
      )}
    </div>
  );
}
