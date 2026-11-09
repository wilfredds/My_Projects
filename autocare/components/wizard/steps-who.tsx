'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Search, UserPlus, Check, Car, Pencil, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/misc';
import { Plate } from '@/components/ui/plate';
import { cn } from '@/lib/utils';
import { describeVehicle } from '@/lib/jobs';
import type { CustomerOption, VehicleOption } from './wizard-types';

/* ------------------------------------------------------------------ step 1 */

/**
 * Choose the customer.
 *
 * A returning customer is found by typing a few letters and tapping a row —
 * their name is never re-typed. "New Customer" is only for genuinely new
 * people, and asks for one required field (the name).
 */
export function CustomerStep({
  customers,
  selectedId,
  onSelect,
  onClear,
  onCreate,
  creating,
}: {
  customers: CustomerOption[];
  selectedId: string | null;
  onSelect: (customer: CustomerOption) => void;
  /** Deselect the current customer so the search list comes back. */
  onClear: () => void;
  onCreate: (input: { fullName: string; phone: string; address: string }) => Promise<void>;
  creating: boolean;
}) {
  const t = useTranslations('wizard');
  const tc = useTranslations('customers');
  const tcom = useTranslations('common');

  const [query, setQuery] = React.useState('');
  const [showNew, setShowNew] = React.useState(false);
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [nameError, setNameError] = React.useState<string | null>(null);

  const selected = customers.find((c) => c.id === selectedId) ?? null;

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? customers.filter(
          (c) => c.fullName.toLowerCase().includes(q) || (c.phone ?? '').toLowerCase().includes(q),
        )
      : customers;
    return pool.slice(0, 40);
  }, [customers, query]);

  if (selected && !showNew) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">{t('customerSelected')}</h2>
        <div className="rounded-2xl border-2 border-primary bg-primary-tint p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-7" aria-hidden strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold [overflow-wrap:anywhere]">{selected.fullName}</p>
              {selected.phone ? (
                <p className="text-lg text-muted-foreground">{selected.phone}</p>
              ) : null}
            </div>
          </div>
        </div>
        <Button variant="outline" size="lg" onClick={onClear}>
          <Pencil aria-hidden />
          <span>{t('customerChange')}</span>
        </Button>
      </div>
    );
  }

  if (showNew) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">{tc('addTitle')}</h2>

        <Field label={tc('fullName')} htmlFor="new-customer-name" error={nameError}>
          <Input
            id="new-customer-name"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setNameError(null);
            }}
            autoFocus
          />
        </Field>

        <Field label={tc('phone')} hint={tcom('optional')} htmlFor="new-customer-phone">
          <Input
            id="new-customer-phone"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>

        <Field label={tc('address')} hint={tcom('optional')} htmlFor="new-customer-address">
          <Input
            id="new-customer-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </Field>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            className="flex-1"
            disabled={creating}
            onClick={async () => {
              if (!fullName.trim()) {
                setNameError(tcom('required'));
                return;
              }
              await onCreate({ fullName: fullName.trim(), phone, address });
              setShowNew(false);
              setFullName('');
              setPhone('');
              setAddress('');
            }}
          >
            <Check aria-hidden />
            <span>{creating ? tcom('saving') : tcom('save')}</span>
          </Button>
          <Button variant="outline" size="lg" onClick={() => setShowNew(false)} disabled={creating}>
            <span>{tcom('cancel')}</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">{t('customerQuestion')}</h2>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('customerSearch')}
          aria-label={t('customerSearch')}
          className="pl-14"
          autoComplete="off"
        />
      </div>

      <Button variant="secondary" size="lg" className="w-full" onClick={() => setShowNew(true)}>
        <UserPlus aria-hidden />
        <span>{t('customerNew')}</span>
      </Button>

      {matches.length === 0 ? (
        <EmptyState title={t('customerNoResults')} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {matches.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                onClick={() => onSelect(customer)}
                className={cn(
                  'flex min-h-tap w-full items-center gap-4 px-5 py-4 text-left hover:bg-accent',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-xl font-semibold leading-snug [overflow-wrap:anywhere]">
                    {customer.fullName}
                  </span>
                  {customer.phone ? (
                    <span className="block text-base text-muted-foreground">{customer.phone}</span>
                  ) : null}
                  {customer.vehicles.length > 0 ? (
                    <span className="mt-2 flex flex-wrap gap-2">
                      {customer.vehicles.slice(0, 3).map((v) => (
                        <Plate key={v.id} className="text-base">
                          {v.plateNumber}
                        </Plate>
                      ))}
                      {customer.vehicles.length > 3 ? (
                        <span className="self-center text-base font-semibold text-muted-foreground">
                          +{customer.vehicles.length - 3}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
                {/* An arrow, not a tick: nothing is chosen until the row is tapped. */}
                <ChevronRight className="size-7 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ step 2 */

/**
 * Choose the vehicle. Only this customer's vehicles are offered, so a plate
 * number is never re-typed for a returning customer.
 */
export function VehicleStep({
  vehicles,
  selectedId,
  onSelect,
  onCreate,
  creating,
}: {
  vehicles: VehicleOption[];
  selectedId: string | null;
  onSelect: (vehicleId: string) => void;
  onCreate: (input: {
    plateNumber: string;
    make: string;
    model: string;
    color: string;
  }) => Promise<void>;
  creating: boolean;
}) {
  const t = useTranslations('wizard');
  const tv = useTranslations('vehicles');
  const tcom = useTranslations('common');

  const [showNew, setShowNew] = React.useState(vehicles.length === 0);
  const [plateNumber, setPlateNumber] = React.useState('');
  const [make, setMake] = React.useState('');
  const [model, setModel] = React.useState('');
  const [color, setColor] = React.useState('');
  const [plateError, setPlateError] = React.useState<string | null>(null);

  if (showNew) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">{tv('addTitle')}</h2>

        <Field label={tv('plateNumber')} htmlFor="new-plate" error={plateError}>
          <Input
            id="new-plate"
            value={plateNumber}
            onChange={(e) => {
              setPlateNumber(e.target.value.toUpperCase());
              setPlateError(null);
            }}
            autoCapitalize="characters"
            autoFocus
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label={tv('make')} hint={tcom('optional')} htmlFor="new-make">
            <Input id="new-make" value={make} onChange={(e) => setMake(e.target.value)} />
          </Field>
          <Field label={tv('model')} hint={tcom('optional')} htmlFor="new-model">
            <Input id="new-model" value={model} onChange={(e) => setModel(e.target.value)} />
          </Field>
        </div>

        <Field label={tv('color')} hint={tcom('optional')} htmlFor="new-color">
          <Input id="new-color" value={color} onChange={(e) => setColor(e.target.value)} />
        </Field>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            className="flex-1"
            disabled={creating}
            onClick={async () => {
              if (!plateNumber.trim()) {
                setPlateError(tcom('required'));
                return;
              }
              await onCreate({ plateNumber: plateNumber.trim(), make, model, color });
              setShowNew(false);
              setPlateNumber('');
              setMake('');
              setModel('');
              setColor('');
            }}
          >
            <Check aria-hidden />
            <span>{creating ? tcom('saving') : tcom('save')}</span>
          </Button>
          {vehicles.length > 0 ? (
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowNew(false)}
              disabled={creating}
            >
              <span>{tcom('cancel')}</span>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">{t('vehicleQuestion')}</h2>

      <ul className="space-y-3">
        {vehicles.map((vehicle) => {
          const active = vehicle.id === selectedId;
          const details = describeVehicle(vehicle).replace(`${vehicle.plateNumber} — `, '');
          return (
            <li key={vehicle.id}>
              <button
                type="button"
                onClick={() => onSelect(vehicle.id)}
                aria-pressed={active}
                className={cn(
                  'flex min-h-tap w-full items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
                  active
                    ? 'border-primary bg-primary-tint'
                    : 'border-border bg-card hover:border-input',
                )}
              >
                <span className="min-w-0 flex-1">
                  <Plate className="text-xl">{vehicle.plateNumber}</Plate>
                  <span className="mt-2 block text-lg text-muted-foreground">
                    {details && details !== vehicle.plateNumber ? details : tcom('none')}
                  </span>
                </span>
                <SelectedMark active={active} />
              </button>
            </li>
          );
        })}
      </ul>

      <Button variant="secondary" size="lg" className="w-full" onClick={() => setShowNew(true)}>
        <Car aria-hidden />
        <span>{t('vehicleNew')}</span>
      </Button>
    </div>
  );
}

/**
 * The tick on a chosen option: a solid orange disc with a white check when
 * chosen, an empty ring when not — so "chosen" never depends on colour alone.
 */
export function SelectedMark({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full border-2',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card',
      )}
    >
      {active ? <Check className="size-6" strokeWidth={3} /> : null}
    </span>
  );
}
