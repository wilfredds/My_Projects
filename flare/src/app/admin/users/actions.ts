"use server";

import { revalidatePath } from "next/cache";
import { withAdmin, type ActionResult } from "@/lib/admin/guard";
import { setUserRole, setUserStatus } from "@/lib/users/admin";
import type { UserRole, UserStatus } from "@/lib/types";

/**
 * Account mutations.
 *
 * Each of these is a public HTTP endpoint once compiled — being called from a
 * page that already checked `requireAdmin()` protects nothing. withAdmin()
 * re-verifies on every call, and the guards inside setUserStatus /
 * setUserRole re-read the administrator count from Firestore rather than
 * trusting anything the browser sent.
 */

export async function updateUserStatus(
  targetUid: string,
  nextStatus: UserStatus,
): Promise<ActionResult> {
  return withAdmin(async (admin) => {
    const outcome = await setUserStatus({ actor: admin, targetUid, nextStatus });
    if (!outcome.ok) return { ok: false, error: outcome.error };

    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { ok: true };
  });
}

export async function updateUserRole(
  targetUid: string,
  nextRole: UserRole,
): Promise<ActionResult> {
  return withAdmin(async (admin) => {
    const outcome = await setUserRole({ actor: admin, targetUid, nextRole });
    if (!outcome.ok) return { ok: false, error: outcome.error };

    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { ok: true };
  });
}
