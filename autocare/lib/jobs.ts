import type { Prisma, PrismaClient } from '@prisma/client';
import { decimalToNumber } from './utils';

type TxClient = Prisma.TransactionClient | PrismaClient;

/**
 * Produce the next human-readable job number for a year, e.g. `JOB-2026-0001`.
 *
 * Must be called inside the same transaction that creates the Job so two
 * simultaneous saves cannot be handed the same number. The counter row is
 * upserted-and-incremented atomically by Postgres; no raw SQL is involved.
 */
export async function nextJobNumber(tx: TxClient, when: Date = new Date()): Promise<string> {
  const year = when.getFullYear();
  const counter = await tx.jobCounter.upsert({
    where: { year },
    create: { year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `JOB-${year}-${String(counter.lastNumber).padStart(4, '0')}`;
}

/**
 * The filter every "live jobs" query must carry.
 *
 * Jobs are soft-deleted, so forgetting this would silently resurrect deleted
 * work in a list, a report or the dashboard. Spread it into the `where` of any
 * query that should only see current jobs:
 *
 *     where: { ...notDeleted, status: 'UNPAID' }
 */
export const notDeleted = { deletedAt: null } as const;

/** The mirror of the above, for the Trash page. */
export const onlyDeleted = { deletedAt: { not: null } } as const;

/** A job with everything a receipt or a detail page needs. */
export const jobInclude = {
  customer: true,
  vehicle: true,
  mechanic: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  parts: { orderBy: { partName: 'asc' } },
  services: { orderBy: { serviceName: 'asc' } },
} satisfies Prisma.JobInclude;

export type JobWithRelations = Prisma.JobGetPayload<{ include: typeof jobInclude }>;

/**
 * Prisma returns Decimal objects, which cannot cross the server/client
 * boundary. Convert to plain numbers before handing a job to a client
 * component or to the PDF renderer.
 */
export interface SerializedJob {
  id: string;
  jobNumber: string;
  date: string;
  status: 'PAID' | 'UNPAID' | 'PARTIAL';
  laborCharge: number;
  expenses: number;
  discount: number;
  subtotal: number;
  total: number;
  amountPaid: number;
  balance: number;
  paymentMethod: 'CASH' | 'GCASH' | 'OTHER' | null;
  notes: string | null;
  createdAt: string;
  odometerKm: number | null;
  /** "YYYY-MM-DD", or null. */
  nextVisitOn: string | null;
  nextVisitKm: number | null;
  reminderDoneAt: string | null;
  customer: { id: string; fullName: string; phone: string | null; address: string | null };
  vehicle: {
    id: string;
    plateNumber: string;
    make: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
  };
  mechanic: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  parts: { id: string; partName: string; quantity: number; unitPrice: number; lineTotal: number }[];
  services: { id: string; serviceName: string; price: number; serviceId: string | null }[];
}

export function serializeJob(job: JobWithRelations): SerializedJob {
  return {
    id: job.id,
    jobNumber: job.jobNumber,
    date: job.date.toISOString(),
    status: job.status,
    laborCharge: decimalToNumber(job.laborCharge),
    expenses: decimalToNumber(job.expenses),
    discount: decimalToNumber(job.discount),
    subtotal: decimalToNumber(job.subtotal),
    total: decimalToNumber(job.total),
    amountPaid: decimalToNumber(job.amountPaid),
    balance: decimalToNumber(job.balance),
    paymentMethod: job.paymentMethod,
    notes: job.notes,
    createdAt: job.createdAt.toISOString(),
    odometerKm: job.odometerKm,
    nextVisitOn: job.nextVisitOn ? job.nextVisitOn.toISOString().slice(0, 10) : null,
    nextVisitKm: job.nextVisitKm,
    reminderDoneAt: job.reminderDoneAt ? job.reminderDoneAt.toISOString() : null,
    customer: {
      id: job.customer.id,
      fullName: job.customer.fullName,
      phone: job.customer.phone,
      address: job.customer.address,
    },
    vehicle: {
      id: job.vehicle.id,
      plateNumber: job.vehicle.plateNumber,
      make: job.vehicle.make,
      model: job.vehicle.model,
      year: job.vehicle.year,
      color: job.vehicle.color,
    },
    mechanic: job.mechanic ? { id: job.mechanic.id, name: job.mechanic.name } : null,
    createdBy: job.createdBy ? { id: job.createdBy.id, name: job.createdBy.name } : null,
    parts: job.parts.map((p) => ({
      id: p.id,
      partName: p.partName,
      quantity: p.quantity,
      unitPrice: decimalToNumber(p.unitPrice),
      lineTotal: decimalToNumber(p.lineTotal),
    })),
    services: job.services.map((s) => ({
      id: s.id,
      serviceName: s.serviceName,
      price: decimalToNumber(s.price),
      serviceId: s.serviceId,
    })),
  };
}

/** Describe a vehicle in one line: "ABC 1234 — Toyota Vios (Silver)". */
export function describeVehicle(vehicle: {
  plateNumber: string;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
}): string {
  const bits = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const extras = [bits || null, vehicle.year ? String(vehicle.year) : null, vehicle.color]
    .filter(Boolean)
    .join(', ');
  return extras ? `${vehicle.plateNumber} — ${extras}` : vehicle.plateNumber;
}
