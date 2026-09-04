import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { recordAudit } from "@/lib/audit/log";
import { canChangeRole, canChangeStatus, explainRefusal } from "./transitions.ts";
import type { UserProfile, UserRole, UserStatus } from "@/lib/types";

/**
 * Account administration.
 *
 * This is the surface that resolves FLARE's registration gap: the design
 * shows open self-registration, but the platform is restricted to authorized
 * BFP personnel. Accounts therefore land at status "pending" and stay
 * inert until somebody here approves them.
 */

export type AdminUserListing = {
  pending: UserProfile[];
  active: UserProfile[];
  suspended: UserProfile[];
  activeAdminCount: number;
};

export async function listUsersForAdmin(): Promise<AdminUserListing> {
  const snapshot = await getAdminDb().collection("users").get();

  const users = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }) as UserProfile);
  const byName = (a: UserProfile, b: UserProfile) =>
    (a.fullName ?? "").localeCompare(b.fullName ?? "");

  return {
    // Applicants first and oldest-first: an approval queue is a queue.
    pending: users
      .filter((user) => user.status === "pending")
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "")),
    active: users.filter((user) => user.status === "active").sort(byName),
    suspended: users.filter((user) => user.status === "suspended").sort(byName),
    activeAdminCount: countActiveAdmins(users),
  };
}

function countActiveAdmins(users: UserProfile[]): number {
  return users.filter((user) => user.role === "admin" && user.status === "active").length;
}

/**
 * Counts active administrators straight from Firestore.
 *
 * Read immediately before a change rather than taken from whatever the page
 * rendered: the listing a browser is looking at may be minutes old, and the
 * "last administrator" guard is only as good as the number it is given.
 */
async function currentActiveAdminCount(): Promise<number> {
  const snapshot = await getAdminDb()
    .collection("users")
    .where("role", "==", "admin")
    .where("status", "==", "active")
    .get();

  return snapshot.size;
}

export type MutationOutcome = { ok: true } | { ok: false; error: string };

export async function setUserStatus(args: {
  actor: UserProfile;
  targetUid: string;
  nextStatus: UserStatus;
  request?: Request;
}): Promise<MutationOutcome> {
  const { actor, targetUid, nextStatus, request } = args;

  const target = await readTarget(targetUid);
  if (!target) return { ok: false, error: "That account no longer exists." };

  const check = canChangeStatus({
    actorUid: actor.uid,
    target: { uid: target.uid, role: target.role, status: target.status },
    nextStatus,
    activeAdminCount: await currentActiveAdminCount(),
  });
  if (!check.allowed) return { ok: false, error: explainRefusal(check.reason) };

  await getAdminDb()
    .collection("users")
    .doc(targetUid)
    .set({ status: nextStatus, updatedAt: new Date().toISOString() }, { merge: true });

  await recordAudit(
    {
      uid: actor.uid,
      action: "profile_updated",
      targetPath: `users/${targetUid}`,
      detail: { change: "status", from: target.status, to: nextStatus },
    },
    request,
  );

  return { ok: true };
}

export async function setUserRole(args: {
  actor: UserProfile;
  targetUid: string;
  nextRole: UserRole;
  request?: Request;
}): Promise<MutationOutcome> {
  const { actor, targetUid, nextRole, request } = args;

  const target = await readTarget(targetUid);
  if (!target) return { ok: false, error: "That account no longer exists." };

  const check = canChangeRole({
    actorUid: actor.uid,
    target: { uid: target.uid, role: target.role, status: target.status },
    nextRole,
    activeAdminCount: await currentActiveAdminCount(),
  });
  if (!check.allowed) return { ok: false, error: explainRefusal(check.reason) };

  await getAdminDb()
    .collection("users")
    .doc(targetUid)
    .set({ role: nextRole, updatedAt: new Date().toISOString() }, { merge: true });

  await recordAudit(
    {
      uid: actor.uid,
      action: "profile_updated",
      targetPath: `users/${targetUid}`,
      detail: { change: "role", from: target.role, to: nextRole },
    },
    request,
  );

  return { ok: true };
}

async function readTarget(uid: string): Promise<UserProfile | null> {
  const snapshot = await getAdminDb().collection("users").doc(uid).get();
  if (!snapshot.exists) return null;
  return { uid, ...snapshot.data() } as UserProfile;
}
