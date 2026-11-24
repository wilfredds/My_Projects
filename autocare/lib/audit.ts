import { headers } from 'next/headers';
import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';

/**
 * Audit logging.
 *
 * Every login, failed login, and every create/update/delete of a Job, Customer,
 * Vehicle, Service or User is written here. Logging must never break the action
 * it is recording, so every failure is swallowed after being reported to the
 * server console.
 */

export const AUDIT_ACTIONS = [
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'ACCOUNT_LOCKED',
  'CREATE_JOB',
  'UPDATE_JOB',
  'DELETE_JOB',
  'RESTORE_JOB',
  'PURGE_JOB',
  'CREATE_CUSTOMER',
  'UPDATE_CUSTOMER',
  'DELETE_CUSTOMER',
  'CREATE_VEHICLE',
  'UPDATE_VEHICLE',
  'DELETE_VEHICLE',
  'CREATE_SERVICE',
  'UPDATE_SERVICE',
  'DELETE_SERVICE',
  'CREATE_USER',
  'UPDATE_USER',
  'DELETE_USER',
  'RESET_PASSWORD',
  'CHANGE_OWN_PASSWORD',
  'UPDATE_SETTINGS',
  'EXPORT_DATA',
  'ACCEPT_POLICY',
  'SHOP_SETUP',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
}

/** Best-effort client IP, honouring the proxy headers Vercel sets. */
export async function getClientIp(): Promise<string | null> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
    return h.get('x-real-ip') ?? null;
  } catch {
    return null;
  }
}

/**
 * Write one audit row. Never throws.
 *
 * Passwords are never passed in here; callers hand over identifiers and small
 * summaries only.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const ipAddress = entry.ipAddress !== undefined ? entry.ipAddress : await getClientIp();
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ?? undefined,
        ipAddress,
      },
    });
  } catch (error) {
    console.error('[audit] failed to write audit entry', {
      action: entry.action,
      entity: entry.entity,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
