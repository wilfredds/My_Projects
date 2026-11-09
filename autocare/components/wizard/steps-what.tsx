'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Check, Plus, Trash2, Wrench, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, MoneyInput } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { EmptyState } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { formatPeso, computeLineTotal } from '@/lib/calc';
import { intlTagFor } from '@/i18n/locales';
import { nextKey, type DraftPart, type DraftService, type ServiceOption } from './wizard-types';

/* ------------------------------------------------------------------ step 3 */

/**
 * Services done. The catalog is shown as big tap-to-add tiles; tapping a tile
 * adds it at its default price, tapping it again removes it. Prices stay
 * editable per job without touching the catalog.
 */
export function ServicesStep({
  catalog,
  services,
  onChange,
}: {
  catalog: ServiceOption[];
  services: DraftService[];
  onChange: (services: DraftService[]) => void;
}) {
  const t = useTranslations('wizard');
  const tcom = useTranslations('common');
  const tag = intlTagFor(useLocale());

  const [showCustom, setShowCustom] = React.useState(false);
  const [customName, setCustomName] = React.useState('');
  const [customPrice, setCustomPrice] = React.useState('');

  const chosenCatalogIds = new Set(services.map((s) => s.serviceId).filter(Boolean));

  function toggleCatalog(service: ServiceOption) {
    if (chosenCatalogIds.has(service.id)) {
      onChange(services.filter((s) => s.serviceId !== service.id));
    } else {
      onChange([
        ...services,
        {
          key: nextKey('svc'),
          serviceId: service.id,
          serviceName: service.name,
          price: service.defaultPrice.toFixed(2),
        },
      ]);
    }
  }

  function updatePrice(key: string, price: string) {
    onChange(services.map((s) => (s.key === key ? { ...s, price } : s)));
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t('servicesQuestion')}</h2>
        <p className="text-lg text-muted-foreground">{t('servicesHint')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {catalog.map((service) => {
          const active = chosenCatalogIds.has(service.id);
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => toggleCatalog(service)}
              aria-pressed={active}
              className={cn(
                'flex min-h-[5.5rem] items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
                active ? 'border-primary bg-primary-tint' : 'border-border bg-card hover:border-input',
              )}
            >
              <span
                className={cn(
                  'flex size-12 shrink-0 items-center justify-center rounded-full border-2',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-transparent bg-muted text-muted-foreground',
                )}
                aria-hidden
              >
                {active ? <Check className="size-7" strokeWidth={3} /> : <Wrench className="size-6" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold leading-snug [overflow-wrap:anywhere]">
                  {service.name}
                </span>
                <span className="num block text-xl font-semibold text-muted-foreground">
                  {formatPeso(service.defaultPrice, tag)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {showCustom ? (
        <div className="space-y-5 rounded-2xl border-2 border-primary bg-primary-tint p-5">
          <Field label={t('servicesCustomName')} htmlFor="custom-service-name">
            <Input
              id="custom-service-name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label={t('servicesCustomPrice')} htmlFor="custom-service-price">
            <MoneyInput
              id="custom-service-price"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
            />
          </Field>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="flex-1"
              onClick={() => {
                if (!customName.trim()) return;
                onChange([
                  ...services,
                  {
                    key: nextKey('svc'),
                    serviceId: null,
                    serviceName: customName.trim(),
                    price: customPrice || '0',
                  },
                ]);
                setCustomName('');
                setCustomPrice('');
                setShowCustom(false);
              }}
            >
              <Plus aria-hidden />
              <span>{tcom('add')}</span>
            </Button>
            <Button variant="outline" size="lg" onClick={() => setShowCustom(false)}>
              <span>{tcom('cancel')}</span>
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="lg" className="w-full" onClick={() => setShowCustom(true)}>
          <Plus aria-hidden />
          <span>{t('servicesCustom')}</span>
        </Button>
      )}

      <div className="space-y-3">
        <h3>{t('servicesAdded')}</h3>
        {services.length === 0 ? (
          <EmptyState title={t('servicesNone')} />
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {services.map((service) => (
              <li key={service.key} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:px-5">
                <span className="min-w-0 flex-1 basis-full text-lg font-semibold [overflow-wrap:anywhere] sm:basis-0">
                  {service.serviceName}
                </span>
                <div className="w-44 flex-1 sm:flex-none">
                  <MoneyInput
                    aria-label={`${service.serviceName} — ${t('servicesCustomPrice')}`}
                    value={service.price}
                    onChange={(e) => updatePrice(service.key, e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="compact"
                  onClick={() => onChange(services.filter((s) => s.key !== service.key))}
                >
                  <Trash2 aria-hidden />
                  <span>{tcom('delete')}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ step 4 */

/** Spare parts. Optional — the whole step can be skipped with Next. */
export function PartsStep({
  parts,
  onChange,
}: {
  parts: DraftPart[];
  onChange: (parts: DraftPart[]) => void;
}) {
  const t = useTranslations('wizard');
  const tcom = useTranslations('common');
  const tag = intlTagFor(useLocale());

  function update(key: string, patch: Partial<DraftPart>) {
    onChange(parts.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t('partsQuestion')}</h2>
        <p className="text-lg text-muted-foreground">{t('partsHint')}</p>
      </div>

      {parts.length === 0 ? (
        <EmptyState
          title={t('partsNone')}
          icon={<Package className="size-12" aria-hidden />}
        />
      ) : (
        <ul className="space-y-5">
          {parts.map((part, index) => (
            <li key={part.key} className="space-y-5 rounded-2xl border border-border bg-card p-5">
              <Field label={t('partsName')} htmlFor={`${part.key}-name`}>
                <Input
                  id={`${part.key}-name`}
                  value={part.partName}
                  onChange={(e) => update(part.key, { partName: e.target.value })}
                  autoFocus={index === parts.length - 1 && part.partName === ''}
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('partsQty')} htmlFor={`${part.key}-qty`}>
                  <QuantityStepper
                    id={`${part.key}-qty`}
                    label={t('partsQty')}
                    value={part.quantity}
                    onChange={(quantity) => update(part.key, { quantity })}
                  />
                </Field>
                <Field label={t('partsUnitPrice')} htmlFor={`${part.key}-price`}>
                  <MoneyInput
                    id={`${part.key}-price`}
                    value={part.unitPrice}
                    onChange={(e) => update(part.key, { unitPrice: e.target.value })}
                  />
                </Field>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
                <p className="text-lg">
                  <span className="text-muted-foreground">{t('partsLineTotal')}: </span>
                  {/* Auto-computed — there is no input for this figure. */}
                  <span className="money text-foreground">
                    {formatPeso(computeLineTotal(part.quantity, part.unitPrice), tag)}
                  </span>
                </p>
                <Button
                  variant="outline"
                  size="compact"
                  onClick={() => onChange(parts.filter((p) => p.key !== part.key))}
                >
                  <Trash2 aria-hidden />
                  <span>{t('partsRemove')}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={() =>
          onChange([
            ...parts,
            { key: nextKey('part'), partName: '', quantity: '1', unitPrice: '' },
          ])
        }
      >
        <Plus aria-hidden />
        <span>{t('partsAdd')}</span>
      </Button>

      <p className="sr-only">{tcom('optional')}</p>
    </div>
  );
}
