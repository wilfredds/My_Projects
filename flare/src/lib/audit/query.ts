import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { AuditEntryRecord } from "@/lib/types";

/**
 * Reading the audit trail.
 *
 * `auditLogs` is closed to every client in firestore.rules, so this is the
 * only way to see it — through the Admin SDK, behind the admin guard. That is
 * deliberate: an audit log readable by the people it audits is worth little,
 * and these entries carry other users' access patterns and IP addresses.
 */

export async function listRecentAuditEntries(limit = 100): Promise<AuditEntryRecord[]> {
  const snapshot = await getAdminDb()
    .collection("auditLogs")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      uid: data.uid,
      action: data.action,
      targetPath: data.targetPath ?? null,
      detail: data.detail ?? null,
      ip: data.ip ?? null,
      userAgent: data.userAgent ?? null,
      createdAt: toIso(data.createdAt),
    } satisfies AuditEntryRecord;
  });
}

/**
 * Entries are written with a server timestamp, so a document read back
 * immediately after writing can still have a null timestamp while the write
 * settles. Returning null rather than inventing a time keeps the log honest.
 */
function toIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
}
