'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { can } from '@/lib/rbac';
import { requireCapability, guarded, type ActionResult } from '@/lib/session';
import { notDeleted } from '@/lib/jobs';

/**
 * "Tapos na" on the Babalikan list: the shop has called or texted the customer
 * (or decided not to), so the car leaves the list. Anyone who records jobs can
 * do it, and it can be undone — a mis-tap must never lose a customer.
 */
export async function closeReminderAction(jobId: string): Promise<ActionResult> {
  return setReminderDone(jobId, true);
}

/** Undo "Tapos na": put the car back on the list. */
export async function reopenReminderAction(jobId: string): Promise<ActionResult> {
  return setReminderDone(jobId, false);
}

async function setReminderDone(jobId: string, done: boolean): Promise<ActionResult> {
  return guarded(async () => {
    const user = await requireCapability(can.manageJobs);
    if (typeof jobId !== 'string' || jobId.length === 0 || jobId.length > 64) {
      return { ok: false, messageKey: 'errors.notFound' };
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, ...notDeleted, nextVisitOn: { not: null } },
      select: { id: true, jobNumber: true },
    });
    if (!job) return { ok: false, messageKey: 'errors.notFound' };

    await prisma.job.update({
      where: { id: job.id },
      data: { reminderDoneAt: done ? new Date() : null },
    });

    await audit({
      userId: user.id,
      action: done ? 'CLOSE_REMINDER' : 'REOPEN_REMINDER',
      entity: 'Job',
      entityId: job.id,
      metadata: { jobNumber: job.jobNumber },
    });

    revalidatePath('/reminders');
    revalidatePath('/dashboard');
    revalidatePath(`/jobs/${job.id}`);
    return { ok: true, messageKey: done ? 'reminders.closed' : 'reminders.reopened' };
  });
}
