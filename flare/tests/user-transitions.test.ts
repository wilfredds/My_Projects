import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { canChangeRole, canChangeStatus, explainRefusal } from "../src/lib/users/transitions.ts";
import type { TransitionRefusal } from "../src/lib/users/transitions.ts";

/**
 * Administrator action guards.
 *
 * Admin writes go through the Firebase Admin SDK, which bypasses security
 * rules — so unlike everything else in FLARE, there is no second line of
 * defence behind these checks. The lockout cases are the ones that matter:
 * FLARE has no recovery path, so an administrator who removes the last
 * administrator leaves a system where nobody can approve an account or
 * publish a lesson again without hand-editing Firestore in the console.
 */

const ADMIN = { uid: "admin-1", role: "admin", status: "active" } as const;
const OTHER_ADMIN = { uid: "admin-2", role: "admin", status: "active" } as const;
const LEARNER = { uid: "learner-1", role: "learner", status: "active" } as const;
const APPLICANT = { uid: "applicant-1", role: "learner", status: "pending" } as const;

function reasonOf(check: ReturnType<typeof canChangeStatus>): TransitionRefusal | null {
  return check.allowed ? null : check.reason;
}

describe("canChangeStatus", () => {
  test("approves a pending applicant", () => {
    const check = canChangeStatus({
      actorUid: ADMIN.uid,
      target: APPLICANT,
      nextStatus: "active",
      activeAdminCount: 1,
    });

    assert.equal(check.allowed, true);
  });

  test("rejects a pending applicant by suspending them", () => {
    const check = canChangeStatus({
      actorUid: ADMIN.uid,
      target: APPLICANT,
      nextStatus: "suspended",
      activeAdminCount: 1,
    });

    assert.equal(check.allowed, true);
  });

  test("suspends and reinstates an ordinary learner", () => {
    const suspend = canChangeStatus({
      actorUid: ADMIN.uid, target: LEARNER, nextStatus: "suspended", activeAdminCount: 1,
    });
    const reinstate = canChangeStatus({
      actorUid: ADMIN.uid,
      target: { ...LEARNER, status: "suspended" },
      nextStatus: "active",
      activeAdminCount: 1,
    });

    assert.equal(suspend.allowed, true);
    assert.equal(reinstate.allowed, true);
  });

  test("REFUSES to let an administrator suspend themselves", () => {
    // Takes effect immediately and removes the privilege needed to undo it.
    const check = canChangeStatus({
      actorUid: ADMIN.uid,
      target: ADMIN,
      nextStatus: "suspended",
      activeAdminCount: 5,
    });

    assert.equal(reasonOf(check), "self_suspend");
  });

  test("REFUSES to suspend the last active administrator", () => {
    const check = canChangeStatus({
      actorUid: OTHER_ADMIN.uid,
      target: ADMIN,
      nextStatus: "suspended",
      activeAdminCount: 1,
    });

    assert.equal(reasonOf(check), "last_admin");
  });

  test("allows suspending an administrator while others remain", () => {
    const check = canChangeStatus({
      actorUid: OTHER_ADMIN.uid,
      target: ADMIN,
      nextStatus: "suspended",
      activeAdminCount: 2,
    });

    assert.equal(check.allowed, true);
  });

  test("never returns an account to pending", () => {
    // "pending" means never reviewed. Going back would hide the fact that a
    // decision was taken, and make a reinstated account look like a new
    // applicant in the approval queue.
    for (const status of ["active", "suspended"] as const) {
      const check = canChangeStatus({
        actorUid: ADMIN.uid,
        target: { ...LEARNER, status },
        nextStatus: "pending",
        activeAdminCount: 2,
      });
      assert.equal(reasonOf(check), "invalid_transition", `from ${status}`);
    }
  });

  test("refuses a no-op rather than writing a pointless audit entry", () => {
    const check = canChangeStatus({
      actorUid: ADMIN.uid, target: LEARNER, nextStatus: "active", activeAdminCount: 2,
    });

    assert.equal(reasonOf(check), "no_change");
  });
});

describe("canChangeRole", () => {
  test("promotes a learner", () => {
    const check = canChangeRole({
      actorUid: ADMIN.uid, target: LEARNER, nextRole: "admin", activeAdminCount: 1,
    });

    assert.equal(check.allowed, true);
  });

  test("REFUSES to let an administrator demote themselves", () => {
    const check = canChangeRole({
      actorUid: ADMIN.uid, target: ADMIN, nextRole: "learner", activeAdminCount: 5,
    });

    assert.equal(reasonOf(check), "self_demote");
  });

  test("REFUSES to demote the last active administrator", () => {
    const check = canChangeRole({
      actorUid: OTHER_ADMIN.uid, target: ADMIN, nextRole: "learner", activeAdminCount: 1,
    });

    assert.equal(reasonOf(check), "last_admin");
  });

  test("allows demoting an administrator while others remain", () => {
    const check = canChangeRole({
      actorUid: OTHER_ADMIN.uid, target: ADMIN, nextRole: "learner", activeAdminCount: 3,
    });

    assert.equal(check.allowed, true);
  });

  test("a suspended administrator does not count toward the safety net", () => {
    // activeAdminCount counts ACTIVE administrators. Demoting a suspended one
    // cannot cause lockout, because they could not administer anything anyway.
    const check = canChangeRole({
      actorUid: OTHER_ADMIN.uid,
      target: { ...ADMIN, status: "suspended" },
      nextRole: "learner",
      activeAdminCount: 1,
    });

    assert.equal(check.allowed, true);
  });

  test("refuses a no-op", () => {
    const check = canChangeRole({
      actorUid: ADMIN.uid, target: LEARNER, nextRole: "learner", activeAdminCount: 2,
    });

    assert.equal(reasonOf(check), "no_change");
  });
});

describe("explainRefusal", () => {
  test("every refusal has wording an administrator can act on", () => {
    const reasons: TransitionRefusal[] = [
      "self_suspend", "self_demote", "last_admin", "no_change", "invalid_transition",
    ];

    for (const reason of reasons) {
      const message = explainRefusal(reason);
      assert.ok(message.length > 0, `${reason} needs wording`);
      // No apologies, no vagueness: say what happened and what to do.
      assert.ok(!/sorry/i.test(message), `${reason} should not apologise`);
    }
  });
});
