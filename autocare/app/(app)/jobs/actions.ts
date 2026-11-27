'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { can } from '@/lib/rbac';
import {
  requireUser,
  requireCapability,
  guarded,
  type ActionResult,
} from '@/lib/session';
import { jobSchema, customerSchema, vehicleSchema, fieldErrors } from '@/lib/validation';
import { computeJobTotals, computeLineTotal, toDecimalString } from '@/lib/calc';
import { nextJobNumber, notDeleted, onlyDeleted } from '@/lib/jobs';
import { decimalToNumber } from '@/lib/utils';
import { ymdToDate } from '@/lib/reminders';

/**
 * Job mutations.
 *
 * Non-negotiable rule in here: subtotal, total, balance and status are NEVER
 * read from the request. They are recomputed from the line items with
 * `computeJobTotals` — the same function that drives the live figure in the
 * browser — right before the write. A client that posts its own total is simply
 * ignored.
 */

export interface SaveJobInput {
  id?: string;
  customerId: string;
  vehicleId: string;
  mechanicId: string | null;
  date: string;
  laborCharge: string;
  expenses: string;
  discount: string;
  amountPaid: string;
  paymentMethod: 'CASH' | 'GCASH' | 'OTHER' | null;
  notes: string;
  parts: { partName: string; quantity: string; unitPrice: string }[];
  services: { serviceId: string | null; serviceName: string; price: string }[];
  /** Odometer reading in km, as typed ("45,210"); blank for none. */
  odometerKm?: string;
  /** "YYYY-MM-DD" the car is due back, or null for no reminder. */
  nextVisitOn?: string | null;
  nextVisitKm?: number | null;
}

export async function saveJobAction(
  input: SaveJobInput,
): Promise<ActionResult<{ id: string; jobNumber: string }>> {
  return guarded(async () => {
    const user = await requireCapability(can.manageJobs);

    const parsed = jobSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        messageKey: 'common.unknownError',
        fieldErrors: fieldErrors(parsed.error),
      };
    }
    const data = parsed.data;

    // The vehicle must actually belong to the customer — never trust the pair.
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: data.vehicleId },
      select: { id: true, customerId: true },
    });
    if (!vehicle || vehicle.customerId !== data.customerId) {
      return { ok: false, messageKey: 'wizard.missingVehicle' };
    }

    // ---- authoritative recomputation -------------------------------------
    const totals = computeJobTotals({
      laborCharge: data.laborCharge,
      expenses: data.expenses,
      discount: data.discount,
      amountPaid: data.amountPaid,
      parts: data.parts,
      services: data.services,
    });

    const moneyFields = {
      laborCharge: toDecimalString(totals.laborCharge),
      expenses: toDecimalString(totals.expenses),
      discount: toDecimalString(totals.discount),
      subtotal: toDecimalString(totals.subtotal),
      total: toDecimalString(totals.total),
      amountPaid: toDecimalString(totals.amountPaid),
      balance: toDecimalString(totals.balance),
      status: totals.status,
    };

    const partRows = data.parts.map((p) => ({
      partName: p.partName,
      quantity: p.quantity,
      unitPrice: toDecimalString(p.unitPrice),
      lineTotal: toDecimalString(computeLineTotal(p.quantity, p.unitPrice)),
    }));

    const serviceRows = data.services.map((s) => ({
      serviceId: s.serviceId || null,
      serviceName: s.serviceName,
      price: toDecimalString(s.price),
    }));

    const isUpdate = Boolean(input.id);

    const reminderFields = {
      odometerKm: data.odometerKm,
      nextVisitOn: data.nextVisitOn ? ymdToDate(data.nextVisitOn) : null,
      nextVisitKm: data.nextVisitKm,
    };

    const job = await prisma.$transaction(async (tx) => {
      if (isUpdate) {
        const before = await tx.job.findFirst({
          where: { id: input.id, ...notDeleted },
          select: { nextVisitOn: true },
        });
        if (!before) return null;

        // Replace the line items wholesale — simplest correct behaviour, and
        // the job is small enough that it costs nothing.
        await tx.jobPart.deleteMany({ where: { jobId: input.id } });
        await tx.jobService.deleteMany({ where: { jobId: input.id } });

        // A new due date is a new reminder: put it back on the Babalikan list
        // even if the old one had been marked done.
        const dueChanged =
          (before.nextVisitOn?.getTime() ?? null) !==
          (reminderFields.nextVisitOn?.getTime() ?? null);

        return tx.job.update({
          where: { id: input.id },
          data: {
            customerId: data.customerId,
            vehicleId: data.vehicleId,
            mechanicId: data.mechanicId,
            date: data.date,
            paymentMethod: data.paymentMethod ?? null,
            notes: data.notes ?? null,
            ...reminderFields,
            ...(dueChanged ? { reminderDoneAt: null } : {}),
            ...moneyFields,
            parts: { create: partRows },
            services: { create: serviceRows },
          },
          select: { id: true, jobNumber: true },
        });
      }

      const jobNumber = await nextJobNumber(tx, data.date);
      return tx.job.create({
        data: {
          jobNumber,
          customerId: data.customerId,
          vehicleId: data.vehicleId,
          mechanicId: data.mechanicId,
          date: data.date,
          paymentMethod: data.paymentMethod ?? null,
          notes: data.notes ?? null,
          createdById: user.id,
          ...reminderFields,
          ...moneyFields,
          parts: { create: partRows },
          services: { create: serviceRows },
        },
        select: { id: true, jobNumber: true },
      });
    });

    if (!job) return { ok: false, messageKey: 'errors.notFound' };

    await audit({
      userId: user.id,
      action: isUpdate ? 'UPDATE_JOB' : 'CREATE_JOB',
      entity: 'Job',
      entityId: job.id,
      metadata: { jobNumber: job.jobNumber, total: totals.total, status: totals.status },
    });

    revalidatePath('/jobs');
    revalidatePath('/dashboard');
    revalidatePath('/reminders');
    revalidatePath(`/jobs/${job.id}`);

    return {
      ok: true,
      data: job,
      messageKey: isUpdate ? 'jobs.updated' : 'jobs.saved',
    };
  });
}

/**
 * "Burahin" on a job.
 *
 * This is a SOFT delete: the row is stamped, not destroyed. The job vanishes
 * from every list, report and total immediately, but an owner can bring it
 * back from the Trash page. That matters because the person using this every
 * day is not comfortable with computers, and a mis-tap on a financial record
 * should never be final.
 */
export async function deleteJobAction(jobId: string): Promise<ActionResult> {
  return guarded(async () => {
    const user = await requireCapability(can.deleteJobs);

    const job = await prisma.job.findFirst({
      where: { id: jobId, ...notDeleted },
      select: { id: true, jobNumber: true, total: true, customer: { select: { fullName: true } } },
    });
    if (!job) return { ok: false, messageKey: 'errors.notFound' };

    await prisma.job.update({
      where: { id: jobId },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    await audit({
      userId: user.id,
      action: 'DELETE_JOB',
      entity: 'Job',
      entityId: jobId,
      metadata: {
        jobNumber: job.jobNumber,
        customer: job.customer.fullName,
        total: decimalToNumber(job.total),
        soft: true,
      },
    });

    revalidatePath('/jobs');
    revalidatePath('/dashboard');
    revalidatePath('/trash');
    return { ok: true, messageKey: 'jobs.deleted' };
  });
}

/** Bring a job back from the Trash. ADMIN only. */
export async function restoreJobAction(jobId: string): Promise<ActionResult> {
  return guarded(async () => {
    const user = await requireCapability(can.restoreJobs);

    const job = await prisma.job.findFirst({
      where: { id: jobId, ...onlyDeleted },
      select: { id: true, jobNumber: true },
    });
    if (!job) return { ok: false, messageKey: 'errors.notFound' };

    await prisma.job.update({
      where: { id: jobId },
      data: { deletedAt: null, deletedById: null },
    });

    await audit({
      userId: user.id,
      action: 'RESTORE_JOB',
      entity: 'Job',
      entityId: jobId,
      metadata: { jobNumber: job.jobNumber },
    });

    revalidatePath('/jobs');
    revalidatePath('/dashboard');
    revalidatePath('/trash');
    return { ok: true, messageKey: 'trash.restored' };
  });
}

/**
 * Destroy a trashed job for good. ADMIN only, and only reachable from the
 * Trash page behind its own confirmation — this is the one genuinely
 * irreversible action in the app.
 */
export async function purgeJobAction(jobId: string): Promise<ActionResult> {
  return guarded(async () => {
    const user = await requireCapability(can.purgeJobs);

    const job = await prisma.job.findFirst({
      where: { id: jobId, ...onlyDeleted },
      select: { id: true, jobNumber: true, total: true, customer: { select: { fullName: true } } },
    });
    if (!job) return { ok: false, messageKey: 'errors.notFound' };

    // JobPart and JobService cascade from the Job.
    await prisma.job.delete({ where: { id: jobId } });

    await audit({
      userId: user.id,
      action: 'PURGE_JOB',
      entity: 'Job',
      entityId: jobId,
      metadata: {
        jobNumber: job.jobNumber,
        customer: job.customer.fullName,
        total: decimalToNumber(job.total),
      },
    });

    revalidatePath('/trash');
    return { ok: true, messageKey: 'trash.purged' };
  });
}

/* ------------------------------------------------ inline creation in wizard */

/**
 * Add a customer without leaving the wizard. Deliberately asks for the minimum:
 * a name. Everything else can be filled in later from the Customers page.
 */
export async function createCustomerInline(input: {
  fullName: string;
  phone: string;
  address: string;
}): Promise<ActionResult<{ id: string; fullName: string; phone: string | null }>> {
  return guarded(async () => {
    const user = await requireCapability(can.manageCustomers);

    const parsed = customerSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, messageKey: 'errors.nameRequired', fieldErrors: fieldErrors(parsed.error) };
    }

    const customer = await prisma.customer.create({
      data: { ...parsed.data, createdById: user.id },
      select: { id: true, fullName: true, phone: true },
    });

    await audit({
      userId: user.id,
      action: 'CREATE_CUSTOMER',
      entity: 'Customer',
      entityId: customer.id,
      metadata: { fullName: customer.fullName, via: 'job-wizard' },
    });

    revalidatePath('/customers');
    return { ok: true, data: customer, messageKey: 'customers.created' };
  });
}

/** Add a vehicle to the chosen customer without leaving the wizard. */
export async function createVehicleInline(input: {
  customerId: string;
  plateNumber: string;
  make: string;
  model: string;
  color: string;
}): Promise<
  ActionResult<{
    id: string;
    plateNumber: string;
    make: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
  }>
> {
  return guarded(async () => {
    const user = await requireCapability(can.manageCustomers);

    const parsed = vehicleSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, messageKey: 'errors.plateRequired', fieldErrors: fieldErrors(parsed.error) };
    }

    const customer = await prisma.customer.findUnique({
      where: { id: parsed.data.customerId },
      select: { id: true },
    });
    if (!customer) return { ok: false, messageKey: 'errors.notFound' };

    const vehicle = await prisma.vehicle.create({
      data: parsed.data,
      select: { id: true, plateNumber: true, make: true, model: true, year: true, color: true },
    });

    await audit({
      userId: user.id,
      action: 'CREATE_VEHICLE',
      entity: 'Vehicle',
      entityId: vehicle.id,
      metadata: { plateNumber: vehicle.plateNumber, via: 'job-wizard' },
    });

    revalidatePath('/vehicles');
    return { ok: true, data: vehicle, messageKey: 'vehicles.created' };
  });
}

/** Used by the Jobs list to confirm the signed-in user before rendering. */
export async function touchSession(): Promise<void> {
  await requireUser();
}
