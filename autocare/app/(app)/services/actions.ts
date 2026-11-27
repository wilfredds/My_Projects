'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { can } from '@/lib/rbac';
import { requireCapability, guarded, type ActionResult } from '@/lib/session';
import { serviceSchema, fieldErrors } from '@/lib/validation';
import { toDecimalString } from '@/lib/calc';

/**
 * Service catalog CRUD.
 *
 * Every one of these re-checks `can.manageServices` server-side: STAFF can see
 * this page but the buttons they don't get are not the security control.
 */

export async function saveServiceAction(input: {
  id?: string;
  name: string;
  defaultPrice: string;
  isActive: boolean;
  remindAfterMonths?: string;
  remindAfterKm?: string;
}): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    const user = await requireCapability(can.manageServices);

    const parsed = serviceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        messageKey: 'errors.serviceNameRequired',
        fieldErrors: fieldErrors(parsed.error),
      };
    }

    const data = {
      name: parsed.data.name,
      defaultPrice: toDecimalString(parsed.data.defaultPrice),
      isActive: parsed.data.isActive,
      remindAfterMonths: parsed.data.remindAfterMonths,
      // A km interval only makes sense alongside a months one.
      remindAfterKm: parsed.data.remindAfterMonths ? parsed.data.remindAfterKm : null,
    };

    try {
      const isUpdate = Boolean(input.id);
      const service = isUpdate
        ? await prisma.service.update({
            where: { id: input.id },
            data,
            select: { id: true, name: true },
          })
        : await prisma.service.create({ data, select: { id: true, name: true } });

      await audit({
        userId: user.id,
        action: isUpdate ? 'UPDATE_SERVICE' : 'CREATE_SERVICE',
        entity: 'Service',
        entityId: service.id,
        metadata: {
          name: service.name,
          defaultPrice: data.defaultPrice,
          isActive: data.isActive,
          remindAfterMonths: data.remindAfterMonths,
          remindAfterKm: data.remindAfterKm,
        },
      });

      revalidatePath('/services');
      revalidatePath('/jobs/new');
      return {
        ok: true,
        data: { id: service.id },
        messageKey: isUpdate ? 'services.updated' : 'services.created',
      };
    } catch (error) {
      // Service.name is unique — turn the constraint into a readable message.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { ok: false, messageKey: 'services.duplicateName' };
      }
      throw error;
    }
  });
}

/** Flip a catalog entry on or off without deleting its history. */
export async function toggleServiceAction(
  serviceId: string,
  isActive: boolean,
): Promise<ActionResult> {
  return guarded(async () => {
    const user = await requireCapability(can.manageServices);

    const service = await prisma.service.update({
      where: { id: serviceId },
      data: { isActive },
      select: { id: true, name: true },
    });

    await audit({
      userId: user.id,
      action: 'UPDATE_SERVICE',
      entity: 'Service',
      entityId: service.id,
      metadata: { name: service.name, isActive },
    });

    revalidatePath('/services');
    return { ok: true, messageKey: 'services.updated' };
  });
}

/**
 * Delete a catalog entry. Historical receipts are untouched: JobService keeps
 * its own copy of the name and price, and its `serviceId` is simply nulled.
 */
export async function deleteServiceAction(serviceId: string): Promise<ActionResult> {
  return guarded(async () => {
    const user = await requireCapability(can.manageServices);

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, name: true },
    });
    if (!service) return { ok: false, messageKey: 'errors.notFound' };

    await prisma.service.delete({ where: { id: serviceId } });

    await audit({
      userId: user.id,
      action: 'DELETE_SERVICE',
      entity: 'Service',
      entityId: serviceId,
      metadata: { name: service.name },
    });

    revalidatePath('/services');
    return { ok: true, messageKey: 'services.deleted' };
  });
}
