import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import type { UserProfile } from "@/lib/types";

/**
 * Profile reads, and the authorization check that goes with them.
 *
 * The session cookie proves who someone is. It does not prove they are
 * allowed in: FLARE is restricted to BFP personnel, so an account waits at
 * status "pending" until an administrator activates it. Every server path
 * that touches training data should go through requireActiveUser() rather
 * than treating a valid session as sufficient.
 */

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getAdminDb().collection("users").doc(uid).get();
  if (!snapshot.exists) return null;
  return { uid, ...snapshot.data() } as UserProfile;
}

export type AuthorizationFailure =
  | "signed_out"
  | "no_profile"
  | "pending"
  | "suspended"
  | "not_admin";

export type AuthorizationResult =
  | { ok: true; profile: UserProfile }
  | { ok: false; reason: AuthorizationFailure };

/** The signed-in, activated user — or why they don't qualify. */
export async function requireActiveUser(): Promise<AuthorizationResult> {
  const session = await getCurrentUser();
  if (!session) return { ok: false, reason: "signed_out" };

  const profile = await getProfile(session.uid);
  if (!profile) return { ok: false, reason: "no_profile" };
  if (profile.status === "pending") return { ok: false, reason: "pending" };
  if (profile.status !== "active") return { ok: false, reason: "suspended" };

  return { ok: true, profile };
}

export async function requireAdmin(): Promise<AuthorizationResult> {
  const result = await requireActiveUser();
  if (!result.ok) return result;
  if (result.profile.role !== "admin") return { ok: false, reason: "not_admin" };
  return result;
}
