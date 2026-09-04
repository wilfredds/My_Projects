import "server-only";
import { headers } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { AuditAction } from "@/lib/types";

/**
 * The audit trail.
 *
 * FLARE's Privacy Notice tells users the platform records login history, IP
 * address, device and browser information, and system usage logs. That makes
 * this a published commitment rather than optional instrumentation, which is
 * why it ships with the first backend code instead of being added later.
 *
 * Entries are written only here, through the Admin SDK. `auditLogs` is
 * unreachable from every client — see firestore.rules — because an audit log
 * the audited party can edit is worse than none: it still gets trusted.
 */

export type AuditEntry = {
  uid: string;
  action: AuditAction;
  /** Document path the action concerned, when it concerned one. */
  targetPath?: string;
  /** Anything action-specific worth keeping. Must not hold credentials. */
  detail?: Record<string, string | number | boolean | null>;
};

/**
 * Appends an entry. Deliberately never throws.
 *
 * Auditing is a side effect of the user's action, not part of it. If Firestore
 * is briefly unavailable, a firefighter should still be able to finish their
 * lesson — failing their request to protect the log would be the wrong trade.
 * The failure is reported to the server console so it is visible in logs.
 */
export async function recordAudit(entry: AuditEntry, request?: Request): Promise<void> {
  try {
    await getAdminDb()
      .collection("auditLogs")
      .add({
        uid: entry.uid,
        action: entry.action,
        targetPath: entry.targetPath ?? null,
        detail: entry.detail ?? null,
        ...(await describeCaller(request)),
        // Server timestamp rather than a value computed here: the database's
        // clock is the one an auditor can reason about.
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (error) {
    console.error("[audit] failed to record entry", entry.action, error);
  }
}

/**
 * Where the request came from.
 *
 * Route handlers hand us the Request directly. Server Actions do not get one
 * — but they still run inside a request scope, so next/headers reaches the
 * same headers. Without this fallback the admin actions, which are the most
 * security-sensitive things FLARE does, would be the only entries recording
 * no IP at all.
 */
async function describeCaller(request?: Request) {
  const source = request?.headers ?? (await safeHeaders());
  if (!source) return { ip: null, userAgent: null };

  return {
    ip: clientIp(source),
    userAgent: source.get("user-agent"),
  };
}

/** headers() throws outside a request scope — a background job, say. */
async function safeHeaders(): Promise<Headers | null> {
  try {
    return await headers();
  } catch {
    return null;
  }
}

/**
 * The caller's address as seen past the hosting proxy.
 *
 * `x-forwarded-for` is a client-supplied header that the platform's proxy
 * appends to, so only the LAST entry is attributable — anything earlier can
 * be invented by the caller. Vercel's `x-real-ip` is set by the proxy itself
 * and is preferred where present.
 */
function clientIp(source: Headers): string | null {
  const realIp = source.get("x-real-ip");
  if (realIp) return realIp;

  const forwarded = source.get("x-forwarded-for");
  if (!forwarded) return null;

  const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
  return hops.at(-1) ?? null;
}
