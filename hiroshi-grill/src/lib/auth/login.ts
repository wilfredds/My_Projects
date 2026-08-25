import { z } from "zod";

/**
 * Sign-in logic, with its side effects passed in — same shape as the
 * reservation handler, for the same reason: the interesting behaviour here is
 * what the code refuses to do, and none of it is visible from clicking a form.
 */

export const loginSchema = z.object({
  /**
   * Normalise BEFORE validating, not after — the order is the whole point.
   *
   * `z.email().trim()` reads as if it trims, but the check runs first, so
   * "  host@example.com  " was rejected outright and anyone who let their phone
   * add a trailing space simply could not sign in.
   *
   * Lowercasing matters for a second, less obvious reason: the rate limiter
   * buckets by email, and "Host@example.com" and "host@example.com" are
   * different strings. Without this, an attacker gets a fresh budget for every
   * capitalisation of the same address — a per-email limit that limits nothing.
   */
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter the email address on your staff account.").max(200)),
  /* No complexity rules on the way IN. Password strength is enforced where
     accounts are created, not where they are used — a minimum length here
     would only tell an attacker how short they can stop guessing. The single
     character check exists so an empty submit does not cost a round trip. */
  password: z.string().min(1, "Enter your password.").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

export type LoginDeps = {
  /** False when the caller is over budget. */
  rateLimit: (email: string) => Promise<boolean>;
  /** Resolves when the credentials are good; rejects or returns false if not. */
  signIn: (input: LoginInput) => Promise<boolean>;
};

export type LoginResult =
  | { ok: true; redirectTo: string }
  | { ok: false; message: string };

/**
 * The one message every failure gets.
 *
 * "No account with that email" and "wrong password" are two different
 * sentences, and the difference is a free tool for finding out which addresses
 * are real. That is user enumeration: an attacker walks a list of addresses,
 * keeps the ones that say "wrong password", and now has a shortlist of staff
 * accounts worth attacking. One message for both costs nothing.
 */
const GENERIC_FAILURE = "That email and password did not match. Please try again.";

/**
 * Where to send someone after they sign in.
 *
 * The `next` parameter exists so that being bounced to the login page and back
 * lands you where you were going. It is also a classic open redirect: left
 * unchecked, a link to
 *
 *   /portal?next=https://hiroshi-grlll.example/portal
 *
 * sends staff to a lookalike site immediately after a successful login, at the
 * exact moment they are least suspicious — the URL they clicked really was ours.
 *
 * So only same-site paths inside the portal are honoured. Anything else falls
 * back to the dashboard rather than being rejected: a bad `next` is not worth
 * an error page, it is worth ignoring.
 */
export function safeRedirectPath(next: string | null | undefined): string {
  const fallback = "/portal/dashboard";
  if (!next) return fallback;

  /**
   * Parse it as a URL against a placeholder origin rather than testing the
   * string by hand. Hand-written checks kept missing cases:
   *
   *   "//evil.example"            looks relative, is absolute
   *   "\\evil.example"            browsers treat backslash as slash
   *   "javascript:alert(1)"       not a path at all
   *   "/portal/../../etc/passwd"  starts with /portal/ and still escapes it
   *
   * The last one got past the first version of this function, which checked the
   * prefix and nothing else. Letting the URL parser resolve the path first, and
   * only then checking where it landed, handles all four the same way — and any
   * fifth trick nobody has thought of yet.
   */
  const placeholder = "https://internal.invalid";
  let url: URL;
  try {
    url = new URL(next, placeholder);
  } catch {
    return fallback;
  }

  /* Anything that resolved to another origin — or to no origin, like a
     javascript: URL — is not ours. */
  if (url.origin !== placeholder) return fallback;

  /* Check the RESOLVED path, after ".." segments have been applied. */
  if (url.pathname !== "/portal" && !url.pathname.startsWith("/portal/")) {
    return fallback;
  }

  /* Query strings are kept so a filtered view survives the round trip; the
     fragment is dropped because the server never sees it anyway. */
  return `${url.pathname}${url.search}`;
}

export async function handleLogin(
  raw: unknown,
  next: string | null,
  deps: LoginDeps,
): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    /* Field-level messages are fine here — "enter an email address" tells an
       attacker nothing they did not already know. It is only the *outcome* of
       a well-formed attempt that has to stay uniform. */
    return { ok: false, message: parsed.error.issues[0]?.message ?? GENERIC_FAILURE };
  }

  const input = parsed.data;

  const withinBudget = await deps.rateLimit(input.email).catch((error) => {
    /* Fail closed. See checkLoginRateLimit for why this costs so little. */
    console.error("[login] rate limit check threw; refusing the attempt:", error);
    return false;
  });

  if (!withinBudget) {
    return {
      ok: false,
      message: "Too many sign-in attempts. Please wait a few minutes and try again.",
    };
  }

  let signedIn = false;
  try {
    signedIn = await deps.signIn(input);
  } catch (error) {
    /* The real reason — "user not found", "invalid grant" — goes to the log and
       nowhere else. */
    console.error("[login] sign-in failed:", error);
    return { ok: false, message: GENERIC_FAILURE };
  }

  if (!signedIn) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  return { ok: true, redirectTo: safeRedirectPath(next) };
}
