// Rules governing what an administrator may do to an account.
//
// These matter more than they look. Admin actions run through the Firebase
// Admin SDK, which bypasses security rules entirely — so firestore.rules
// cannot help here. This module is the only thing standing between an
// administrator and an unrecoverable mistake, and the worst of those is
// lockout: FLARE has no other way back in. If the last active administrator
// suspends themselves, nobody can approve accounts, publish content, or
// restore the administrator — the system is bricked short of someone editing
// Firestore by hand in the Firebase console.
//
// Relative imports with extensions: `node --test` runs this file directly.
import type { UserRole, UserStatus } from "../types.ts";

export type TransitionRefusal =
  | "self_suspend"
  | "self_demote"
  | "last_admin"
  | "no_change"
  | "invalid_transition";

export type TransitionCheck =
  | { allowed: true }
  | { allowed: false; reason: TransitionRefusal };

const ALLOW: TransitionCheck = { allowed: true };
const refuse = (reason: TransitionRefusal): TransitionCheck => ({ allowed: false, reason });

/**
 * Status changes an administrator may make.
 *
 * "pending" is never a destination. It means "registered, never reviewed",
 * so moving an account back to it would erase the fact that a decision was
 * taken — and a reviewer looking at the queue could not tell a new applicant
 * from a reinstated one.
 */
const VALID_STATUS_MOVES: Record<UserStatus, readonly UserStatus[]> = {
  pending: ["active", "suspended"],
  active: ["suspended"],
  suspended: ["active"],
};

export function canChangeStatus(args: {
  actorUid: string;
  target: { uid: string; role: UserRole; status: UserStatus };
  nextStatus: UserStatus;
  /** Active administrators INCLUDING the target, as counted before the change. */
  activeAdminCount: number;
}): TransitionCheck {
  const { actorUid, target, nextStatus, activeAdminCount } = args;

  if (target.status === nextStatus) return refuse("no_change");
  if (!VALID_STATUS_MOVES[target.status].includes(nextStatus)) {
    return refuse("invalid_transition");
  }

  // Suspending yourself takes effect immediately and removes the privilege
  // needed to undo it.
  if (actorUid === target.uid && nextStatus === "suspended") {
    return refuse("self_suspend");
  }

  // Suspending someone else who happens to be the only remaining active
  // administrator has the same end state, one step removed.
  if (
    nextStatus === "suspended" &&
    target.role === "admin" &&
    target.status === "active" &&
    activeAdminCount <= 1
  ) {
    return refuse("last_admin");
  }

  return ALLOW;
}

export function canChangeRole(args: {
  actorUid: string;
  target: { uid: string; role: UserRole; status: UserStatus };
  nextRole: UserRole;
  /** Active administrators INCLUDING the target, as counted before the change. */
  activeAdminCount: number;
}): TransitionCheck {
  const { actorUid, target, nextRole, activeAdminCount } = args;

  if (target.role === nextRole) return refuse("no_change");

  // Demoting yourself is the quieter half of the lockout problem: the account
  // still works, it just can no longer reach the admin surface, and only an
  // administrator could put the role back.
  if (actorUid === target.uid && nextRole === "learner") {
    return refuse("self_demote");
  }

  if (nextRole === "learner" && target.role === "admin" && target.status === "active" && activeAdminCount <= 1) {
    return refuse("last_admin");
  }

  return ALLOW;
}

/** Wording for the administrator who tried it. */
export function explainRefusal(reason: TransitionRefusal): string {
  switch (reason) {
    case "self_suspend":
      return "You cannot suspend your own account. Ask another administrator to do it.";
    case "self_demote":
      return "You cannot remove your own administrator role. Ask another administrator to do it.";
    case "last_admin":
      return "This is the only active administrator. Promote someone else first, or FLARE will have nobody who can approve accounts.";
    case "no_change":
      return "That is already the current value.";
    case "invalid_transition":
      return "That change is not allowed. An account cannot be returned to pending once it has been reviewed.";
  }
}
