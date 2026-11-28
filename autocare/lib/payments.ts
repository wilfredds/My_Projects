import type { PaymentMethod, Prisma, PrismaClient } from '@prisma/client';
import { computeJobTotals, toCentavos, toDecimalString, toPesos, type JobTotals } from './calc';
import { addDays, dateToYmd, shopToday, ymdToDate } from './reminders';

/**
 * The payment ledger.
 *
 * Every peso that reaches a job is one Payment row, dated on the shop's
 * calendar day it arrived. The rule kept by every function here, always
 * inside the same transaction that changes the job:
 *
 *     sum(Payment.amount for a job) === Job.amountPaid
 *
 * Job.amountPaid stays as the running total because balance and status are
 * derived from it (lib/calc.ts). The ledger adds *when*, which is what makes
 * "Pera ngayong araw" count a debt collected today.
 */

type Tx = Prisma.TransactionClient;

/** The shop's calendar date of a moment (a job date, or now). */
export function shopDayOf(date: Date): string {
  return shopToday(undefined, date);
}

/** What a newly recorded job was paid on the spot, on the job's own date. */
export async function recordPaymentForNewJob(
  tx: Tx,
  input: {
    jobId: string;
    amountPaid: number;
    method: PaymentMethod | null;
    jobDate: Date;
    userId: string;
  },
): Promise<void> {
  if (toCentavos(input.amountPaid) === 0) return;
  await tx.payment.create({
    data: {
      jobId: input.jobId,
      amount: toDecimalString(input.amountPaid),
      method: input.method,
      kind: 'WITH_JOB',
      receivedOn: ymdToDate(shopDayOf(input.jobDate)),
      receivedById: input.userId,
    },
  });
}

/**
 * After a job is edited, bring its payments back in line:
 *
 * - a changed amount paid becomes one ADJUSTMENT for the difference, dated
 *   today (an increase is usually money just handed over; a decrease, a
 *   correction — either way it happened today);
 * - a changed job date moves the WITH_JOB payment with it, since that money
 *   came in with the job;
 * - a changed payment method is carried to the WITH_JOB payment.
 */
export async function syncPaymentsAfterEdit(
  tx: Tx,
  input: {
    jobId: string;
    before: { amountPaid: number; date: Date; method: PaymentMethod | null };
    after: { amountPaid: number; date: Date; method: PaymentMethod | null };
    userId: string;
    today?: string;
  },
): Promise<void> {
  const { before, after } = input;

  const movedDay = shopDayOf(before.date) !== shopDayOf(after.date);
  if (movedDay || before.method !== after.method) {
    await tx.payment.updateMany({
      where: { jobId: input.jobId, kind: 'WITH_JOB' },
      data: {
        ...(movedDay ? { receivedOn: ymdToDate(shopDayOf(after.date)) } : {}),
        ...(before.method !== after.method ? { method: after.method } : {}),
      },
    });
  }

  const deltaCentavos = toCentavos(after.amountPaid) - toCentavos(before.amountPaid);
  if (deltaCentavos !== 0) {
    await tx.payment.create({
      data: {
        jobId: input.jobId,
        amount: toDecimalString(toPesos(deltaCentavos)),
        method: after.method,
        kind: 'ADJUSTMENT',
        receivedOn: ymdToDate(input.today ?? shopToday()),
        receivedById: input.userId,
      },
    });
  }
}

export type ReceivePaymentResult =
  | { ok: true; jobNumber: string; before: JobTotals; after: JobTotals }
  | { ok: false; reason: 'notFound' | 'invalidAmount' | 'tooMuch' };

/**
 * "Tumanggap ng bayad": money handed over later for a job still owed.
 *
 * The job's row is locked for the length of the transaction, so two people
 * recording the same payment at the same moment cannot both succeed and push
 * the job past its total. The totals are recomputed from the line items with
 * lib/calc.ts — the same function as everywhere else — never taken from the
 * request.
 */
export async function receivePayment(
  db: PrismaClient,
  input: {
    jobId: string;
    amount: number;
    method: PaymentMethod | null;
    userId: string;
    today?: string;
  },
): Promise<ReceivePaymentResult> {
  const cents = toCentavos(input.amount);
  if (!Number.isFinite(input.amount) || cents <= 0) return { ok: false, reason: 'invalidAmount' };

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Job" WHERE "id" = ${input.jobId} FOR UPDATE`;
    const job = await tx.job.findFirst({
      where: { id: input.jobId, deletedAt: null },
      include: { parts: true, services: true },
    });
    if (!job) return { ok: false as const, reason: 'notFound' as const };

    const base = {
      laborCharge: job.laborCharge,
      expenses: job.expenses,
      discount: job.discount,
      parts: job.parts,
      services: job.services,
    };
    const before = computeJobTotals({ ...base, amountPaid: job.amountPaid });
    if (cents > toCentavos(before.balance)) return { ok: false as const, reason: 'tooMuch' as const };

    const after = computeJobTotals({
      ...base,
      amountPaid: toPesos(toCentavos(before.amountPaid) + cents),
    });

    await tx.payment.create({
      data: {
        jobId: job.id,
        amount: toDecimalString(toPesos(cents)),
        method: input.method,
        kind: 'COLLECTED',
        receivedOn: ymdToDate(input.today ?? shopToday()),
        receivedById: input.userId,
      },
    });
    await tx.job.update({
      where: { id: job.id },
      data: {
        amountPaid: toDecimalString(after.amountPaid),
        balance: toDecimalString(after.balance),
        status: after.status,
        paymentMethod: input.method ?? job.paymentMethod,
      },
    });

    return { ok: true as const, jobNumber: job.jobNumber, before, after };
  });
}

/* ------------------------------------------------------------------ income */

/** Payments that count: their job is not in the Trash. */
const livePayments = { job: { deletedAt: null } } as const;

/** Money received from `from` to `to` (inclusive, shop calendar dates). */
export async function incomeBetween(db: PrismaClient, from: string, to: string): Promise<number> {
  const result = await db.payment.aggregate({
    _sum: { amount: true },
    where: { ...livePayments, receivedOn: { gte: ymdToDate(from), lte: ymdToDate(to) } },
  });
  return toPesos(toCentavos(result._sum.amount ?? 0));
}

/** Money received per day, "YYYY-MM-DD" → pesos, days with nothing left out. */
export async function incomeByDay(
  db: PrismaClient,
  from: string,
  to: string,
): Promise<Map<string, number>> {
  const rows = await db.payment.groupBy({
    by: ['receivedOn'],
    _sum: { amount: true },
    where: { ...livePayments, receivedOn: { gte: ymdToDate(from), lte: ymdToDate(to) } },
    orderBy: { receivedOn: 'asc' },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    const pesos = toPesos(toCentavos(row._sum.amount ?? 0));
    if (pesos !== 0) map.set(dateToYmd(row.receivedOn), pesos);
  }
  return map;
}

/** Fold daily income into months, "YYYY-MM" → pesos. */
export function byMonth(daily: Map<string, number>): Map<string, number> {
  const months = new Map<string, number>();
  for (const [day, pesos] of daily) {
    const key = day.slice(0, 7);
    months.set(key, toPesos(toCentavos((months.get(key) ?? 0) + pesos)));
  }
  return months;
}

/** The first day of the shop's current month, and the same twelve months back. */
export function monthStart(today: string, monthsBack = 0): string {
  const [y, m] = today.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 - monthsBack, 1));
  return dateToYmd(d);
}

/** The day after `ymd`, for half-open ranges over job dates. */
export function dayAfter(ymd: string): Date {
  return ymdToDate(addDays(ymd, 1));
}
