import "server-only";
import { requireAdmin } from "@/lib/users/profile";
import type { UserProfile } from "@/lib/types";

/**
 * The authorization wrapper every admin mutation goes through.
 *
 * The thing to understand about Server Actions: each one compiles to a public
 * HTTP endpoint. The fact that it is only *called* from a page that checked
 * `requireAdmin()` protects nothing — anyone can invoke the action directly
 * with the action ID and their own session cookie. The page's check guards
 * the rendering; this guards the mutation.
 *
 * Admin writes also run through the Firebase Admin SDK, which bypasses
 * Firestore security rules entirely. So there is no second line of defence
 * behind this function the way there is for learner-facing code. Every admin
 * action must be wrapped, without exception.
 */

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { value?: undefined } : { value: T }))
  | { ok: false; error: string };

export function failed(error: string): ActionResult<never> {
  return { ok: false, error };
}

/** Runs `fn` only for a signed-in, active administrator. */
export async function withAdmin<T>(
  fn: (admin: UserProfile) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const auth = await requireAdmin();

  if (!auth.ok) {
    // Deliberately terse. An unauthorized caller learns whether they are
    // signed out, but not how the admin surface is organised.
    const message =
      auth.reason === "signed_out"
        ? "Sign in to continue."
        : "You do not have permission to do that.";
    return { ok: false, error: message };
  }

  return fn(auth.profile);
}
