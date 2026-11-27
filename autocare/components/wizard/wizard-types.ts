/** Shared shapes for the New Job wizard. */

import type { NextVisit, ReminderChoice } from '@/lib/reminders';

export interface CustomerOption {
  id: string;
  fullName: string;
  phone: string | null;
  vehicles: VehicleOption[];
}

export interface VehicleOption {
  id: string;
  plateNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  /** The highest odometer reading recorded for this car, if any. */
  lastOdometerKm?: number | null;
}

export interface ServiceOption {
  id: string;
  name: string;
  defaultPrice: number;
  /** How often the service repeats — drives the suggested next visit. */
  remindAfterMonths?: number | null;
  remindAfterKm?: number | null;
}

export interface MechanicOption {
  id: string;
  name: string;
}

/** A service line on the job being built. */
export interface DraftService {
  /** Local key for React lists. */
  key: string;
  /** Catalog id, or null for a one-off typed service. */
  serviceId: string | null;
  serviceName: string;
  price: string;
}

/** A spare-part line on the job being built. */
export interface DraftPart {
  key: string;
  partName: string;
  quantity: string;
  unitPrice: string;
}

export interface JobDraft {
  customerId: string | null;
  vehicleId: string | null;
  mechanicId: string | null;
  date: string;
  services: DraftService[];
  parts: DraftPart[];
  laborCharge: string;
  expenses: string;
  discount: string;
  amountPaid: string;
  paymentMethod: 'CASH' | 'GCASH' | 'OTHER' | '';
  notes: string;
  /** Odometer reading as typed; blank for none. */
  odometer: string;
  /** How the next visit is decided — `auto` follows the services chosen. */
  reminder: ReminderChoice;
  /** An existing job's next visit, used while `reminder` is `keep`. */
  keptVisit?: NextVisit;
}

export function emptyDraft(): JobDraft {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;
  return {
    customerId: null,
    vehicleId: null,
    mechanicId: null,
    date: new Date(today.getTime() - offset).toISOString().slice(0, 10),
    services: [],
    parts: [],
    laborCharge: '',
    expenses: '',
    discount: '',
    amountPaid: '',
    paymentMethod: '',
    notes: '',
    odometer: '',
    reminder: 'auto',
  };
}

/**
 * The job's services with how often each repeats, looked up in the catalog.
 * A typed one-off service, or one no longer in the catalog, has no interval.
 */
export function withIntervals(
  services: DraftService[],
  catalog: ServiceOption[],
): { name: string; remindAfterMonths: number | null; remindAfterKm: number | null }[] {
  return services.map((s) => {
    const entry = s.serviceId ? catalog.find((c) => c.id === s.serviceId) : undefined;
    return {
      name: s.serviceName,
      remindAfterMonths: entry?.remindAfterMonths ?? null,
      remindAfterKm: entry?.remindAfterKm ?? null,
    };
  });
}

/** "45,210" / "45 210 km" → 45210; blank or nonsense → null. */
export function parseKm(value: string): number | null {
  const cleaned = value.replace(/[,\s]/g, '').replace(/km$/i, '');
  if (!/^\d{1,7}$/.test(cleaned)) return null;
  return Number(cleaned);
}

let counter = 0;
export function nextKey(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

export const WIZARD_STEPS = [
  'customer',
  'vehicle',
  'services',
  'parts',
  'charges',
  'payment',
  'review',
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

/**
 * Which message to show when the server refuses a job: the specific one for
 * the odometer / next-visit fields, otherwise null (the caller's generic one).
 * Returns a key in the `errors` namespace.
 */
export function reminderErrorKey(
  fieldErrors: Record<string, string> | undefined,
): 'invalidDate' | 'nextVisitKmTooLow' | 'invalidNumber' | null {
  if (!fieldErrors) return null;
  if (fieldErrors.nextVisitKm === 'errors.nextVisitKmTooLow') return 'nextVisitKmTooLow';
  if (fieldErrors.nextVisitOn) return 'invalidDate';
  if (fieldErrors.odometerKm || fieldErrors.nextVisitKm) return 'invalidNumber';
  return null;
}
