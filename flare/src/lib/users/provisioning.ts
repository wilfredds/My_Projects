import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { recordAudit } from "@/lib/audit/log";
import type { UserProfile, UserStatus } from "@/lib/types";

/**
 * Creating the Firestore profile behind a new Firebase Auth account.
 *
 * firestore.rules denies user-document creation to every client, so this is
 * the only way a profile comes into existence — a browser that could write
 * its own would write itself an active administrator.
 */

/**
 * Whether a new registration can use FLARE immediately.
 *
 * FLARE is described throughout as restricted to authorized BFP personnel,
 * which argues for "pending": an administrator reviews each registration
 * before it becomes usable. The admin surface that does that review exists in
 * this repository, but the client has said they do not need it — and with no
 * reviewer, "pending" means every account is inert forever and nobody can use
 * the site at all.
 *
 * So registrations are activated on creation. This is the one place that
 * decides it: set it to "pending" and the approval flow at /admin/users is
 * live again, with no other change anywhere.
 */
export const NEW_ACCOUNT_STATUS: UserStatus = "active";

export type ProvisionResult = { ok: true } | { ok: false; error: string };

export async function createProfile(args: {
  uid: string;
  username: string;
  email: string;
  request?: Request;
}): Promise<ProvisionResult> {
  const { uid, username, email, request } = args;
  const db = getAdminDb();
  const ref = db.collection("users").doc(uid);

  if ((await ref.get()).exists) {
    return { ok: false, error: "That account already has a profile." };
  }

  // Usernames are shown to other people, so a duplicate is confusing rather
  // than dangerous — the email is what identifies the account.
  const clash = await db.collection("users").where("username", "==", username).limit(1).get();
  if (!clash.empty) return { ok: false, error: "That username is taken." };

  const profile: Omit<UserProfile, "uid"> = {
    username,
    email,
    fullName: "",
    // BFP identity is administrator-managed and not collected at sign-up —
    // the design's Sign Up screen asks for none of it. See docs/DATA-MODEL.md.
    rank: "",
    badgeNumber: "",
    unit: "",
    position: "",
    contactNumber: "",
    role: "learner",
    status: NEW_ACCOUNT_STATUS,
    preferences: { theme: "system", language: "en", notificationsPaused: false },
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };

  await ref.set(profile);

  await recordAudit(
    { uid, action: "profile_updated", targetPath: `users/${uid}`, detail: { change: "registered" } },
    request,
  );

  return { ok: true };
}
