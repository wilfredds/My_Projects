import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { createClient } from "./supabase/server";

/**
 * Rate limiting for public endpoints (§6).
 *
 * The counting happens in Postgres — see `check_rate_limit` in schema.sql for
 * why, and for why it is one atomic upsert. This module's job is the two
 * decisions that have to be made in application code: *who* is calling, and
 * how to name them without storing a record of who visited the site.
 */

/** The reservation form: generous enough for a family arguing over a date. */
export const RESERVATION_LIMIT = { limit: 8, windowSeconds: 15 * 60 } as const;

/** Sign-in, from milestone 4. Tighter, because this one guards passwords. */
export const LOGIN_LIMIT = { limit: 10, windowSeconds: 10 * 60 } as const;

/**
 * The caller's IP address.
 *
 * Header order matters here, and getting it wrong is the classic way to ship a
 * rate limiter that does not limit.
 *
 * `x-forwarded-for` is just a header. Anyone can send one, with any value they
 * like. If we trusted its leftmost entry unconditionally, an attacker would put
 * a different fake address on every request, land in a fresh bucket each time,
 * and never hit the cap — the limiter would be decoration.
 *
 * What makes it trustworthy is a proxy in front that OVERWRITES it, and on
 * Vercel that proxy sets `x-vercel-forwarded-for` itself. So we prefer the
 * header the platform controls, and fall back to the client-controlled one only
 * for local development, where there is no attacker to worry about.
 */
export function clientIp(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]!.trim();

  const real = headers.get("x-real-ip");
  if (real) return real.trim();

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();

  /* No address at all. Everyone in this situation shares one bucket, so an
     unidentifiable flood still gets capped rather than waved through. */
  return "unknown";
}

/**
 * Held for the life of the process so the fallback below stays stable between
 * requests. Without this the salt would change per call and every request would
 * land in a fresh bucket — a limiter that never limits.
 */
let fallbackSalt: string | null = null;

function rateLimitSalt(): string {
  const configured = process.env.RATE_LIMIT_SALT;
  if (configured) return configured;

  if (process.env.NODE_ENV !== "production") {
    /* Development. A fixed salt keeps buckets stable across restarts while you
       are testing. It is never used in production because it is public. */
    return "dev-only-salt-do-not-use-in-production";
  }

  /**
   * Production with no salt configured. This used to throw — which turned a
   * missing environment variable into an unhandled exception on every single
   * booking attempt, taking the whole reservation form down. A smoke test
   * against the built server caught it, and the lesson is worth keeping: a
   * config check that fails harder than the thing it protects is not a safety
   * feature.
   *
   * So we degrade instead. A random per-process salt still hashes the address
   * (privacy intact — it is strictly less reversible than a shared secret), and
   * still recognises a repeat caller within this instance. What is lost is
   * agreement BETWEEN instances, so the effective limit becomes per-instance
   * rather than global.
   *
   * That is worse than configured, better than nothing, and much better than a
   * restaurant that cannot take bookings. Set the variable.
   */
  if (!fallbackSalt) {
    fallbackSalt = randomBytes(32).toString("base64");
    console.error(
      "[rate-limit] RATE_LIMIT_SALT is not set. Falling back to a per-instance " +
        "salt, which means rate limits are enforced per serverless instance " +
        "instead of globally. Generate one with: openssl rand -base64 32",
    );
  }
  return fallbackSalt;
}

/**
 * Turns a scope and an IP into a bucket key: `reservations:Ux7f…`.
 *
 * The address is salted and hashed rather than stored. The limiter only ever
 * needs to answer "is this the same caller as before?", and a hash answers that
 * perfectly — while leaving the database holding no record of who visited.
 *
 * The salt is what makes it worth doing. An unsalted SHA-256 of an IPv4 address
 * is reversible in seconds: there are only four billion of them, so anyone with
 * the table can hash every possible address and match. With a secret salt they
 * would need the salt too, and that never leaves the server.
 */
export function bucketFor(scope: string, ip: string): string {
  const digest = createHash("sha256")
    .update(`${rateLimitSalt()}:${ip}`)
    .digest("base64url")
    .slice(0, 24);
  return `${scope}:${digest}`;
}

/**
 * Returns true if the request is within budget.
 *
 * Fails OPEN: if the database cannot be reached, the booking still goes
 * through. That is a deliberate call for this endpoint. The worst case of
 * failing open is some spam a host has to delete; the worst case of failing
 * closed is a restaurant that silently stops taking bookings because of a
 * blip in a supporting table. For the login endpoint in milestone 4, where the
 * thing being protected is passwords, the trade-off runs the other way.
 */
export async function checkRateLimit(
  scope: string,
  headers: Headers,
  limit: number,
  windowSeconds: number,
  options: { failClosed?: boolean } = {},
): Promise<boolean> {
  /* What to do when the limiter itself cannot answer. See the note above the
     function for why the reservation form and the login page differ. */
  const onFailure = options.failClosed ? false : true;

  try {
    /* Bucket derivation lives inside the try on purpose. It reads configuration
       and hashes, both of which can fail, and a throw escaping this function
       would surface as an unhandled 500 on a booking rather than as a rate
       limiter that quietly stopped working. */
    const bucket = bucketFor(scope, clientIp(headers));

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error("[rate-limit] check failed:", error.message);
      return onFailure;
    }

    return data !== false;
  } catch (error) {
    console.error("[rate-limit] check threw:", error);
    return onFailure;
  }
}

/**
 * Rate limits a sign-in attempt, on two independent buckets.
 *
 * Both are needed, because they stop different attacks:
 *
 *   by IP    — one machine working through a list of email addresses.
 *   by email — many machines all guessing at one account, where each
 *              individual address stays comfortably under the per-IP cap.
 *
 * Checking only the first is the common mistake, and it leaves the owner's
 * account open to exactly the attack worth worrying about.
 *
 * This one fails CLOSED, unlike the reservation form. The reasoning is not
 * "logins are more important" in the abstract — it is that failing closed here
 * costs almost nothing. The limiter and Supabase Auth are the same service, so
 * if this check cannot reach the database, the sign-in was going to fail
 * anyway. We give up a case that was already lost, and in exchange an outage
 * can never become an unlimited window for guessing passwords.
 */
export async function checkLoginRateLimit(headers: Headers, email: string): Promise<boolean> {
  const [ipOk, emailOk] = await Promise.all([
    checkRateLimit("login-ip", headers, LOGIN_LIMIT.limit, LOGIN_LIMIT.windowSeconds, {
      failClosed: true,
    }),
    /* The email is hashed the same way an IP is — the buckets table never
       learns which staff addresses exist, let alone which are under attack. */
    checkEmailBucket(email),
  ]);

  return ipOk && emailOk;
}

async function checkEmailBucket(email: string): Promise<boolean> {
  const headers = new Headers({ "x-real-ip": email.trim().toLowerCase() });
  return checkRateLimit("login-email", headers, LOGIN_LIMIT.limit, LOGIN_LIMIT.windowSeconds, {
    failClosed: true,
  });
}
