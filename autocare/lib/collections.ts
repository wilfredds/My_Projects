import type { PrismaClient } from '@prisma/client';
import { toCentavos, toPesos } from './calc';
import { daysBetween } from './reminders';

/**
 * Singilin — who still owes the shop money.
 *
 * Every live job that is not fully paid, grouped by customer: how much in all,
 * since when, and for which jobs. The grouping is pure (and tested in
 * tests/collections.test.ts); the query is one indexed read.
 */

export interface OwedJob {
  jobId: string;
  jobNumber: string;
  /** "YYYY-MM-DD" — the job's date. */
  date: string;
  plate: string;
  total: number;
  amountPaid: number;
  balance: number;
}

export interface OwedCustomer {
  customerId: string;
  fullName: string;
  phone: string | null;
  totalOwed: number;
  /** The date of the oldest job still owed. */
  oldest: string;
  jobs: OwedJob[];
}

export interface OwedRow extends OwedJob {
  customerId: string;
  fullName: string;
  phone: string | null;
}

/**
 * Group owed jobs by customer. The customer waiting longest comes first (the
 * debt most likely to be forgotten), then the larger amount. Within a
 * customer, oldest job first. Sums are made in centavos so they cannot drift.
 */
export function groupOwed(rows: OwedRow[]): OwedCustomer[] {
  const byCustomer = new Map<string, OwedCustomer & { cents: number }>();
  for (const row of rows) {
    if (toCentavos(row.balance) <= 0) continue;
    const entry = byCustomer.get(row.customerId) ?? {
      customerId: row.customerId,
      fullName: row.fullName,
      phone: row.phone,
      totalOwed: 0,
      cents: 0,
      oldest: row.date,
      jobs: [],
    };
    entry.cents += toCentavos(row.balance);
    if (row.date < entry.oldest) entry.oldest = row.date;
    entry.jobs.push({
      jobId: row.jobId,
      jobNumber: row.jobNumber,
      date: row.date,
      plate: row.plate,
      total: row.total,
      amountPaid: row.amountPaid,
      balance: row.balance,
    });
    byCustomer.set(row.customerId, entry);
  }

  return Array.from(byCustomer.values())
    .map(({ cents, ...customer }) => ({
      ...customer,
      totalOwed: toPesos(cents),
      jobs: customer.jobs.sort((a, b) => a.date.localeCompare(b.date) || a.jobNumber.localeCompare(b.jobNumber)),
    }))
    .sort((a, b) => a.oldest.localeCompare(b.oldest) || b.totalOwed - a.totalOwed);
}

/** How long the oldest debt has been waiting, in days (0 for today's). */
export function daysWaiting(oldest: string, today: string): number {
  return Math.max(0, daysBetween(oldest, today));
}

/** Every customer who still owes, from live jobs. */
export async function findOwed(db: PrismaClient): Promise<OwedCustomer[]> {
  const jobs = await db.job.findMany({
    where: { deletedAt: null, status: { not: 'PAID' } },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      jobNumber: true,
      date: true,
      total: true,
      amountPaid: true,
      balance: true,
      customer: { select: { id: true, fullName: true, phone: true } },
      vehicle: { select: { plateNumber: true } },
    },
  });
  return groupOwed(
    jobs.map((job) => ({
      jobId: job.id,
      jobNumber: job.jobNumber,
      date: job.date.toISOString().slice(0, 10),
      plate: job.vehicle.plateNumber,
      total: toPesos(toCentavos(job.total)),
      amountPaid: toPesos(toCentavos(job.amountPaid)),
      balance: toPesos(toCentavos(job.balance)),
      customerId: job.customer.id,
      fullName: job.customer.fullName,
      phone: job.customer.phone,
    })),
  );
}
