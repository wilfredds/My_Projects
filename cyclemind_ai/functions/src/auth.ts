/**
 * Request authentication, authorisation and abuse controls.
 *
 * WHY THIS EXISTS:
 * These functions hold the Anthropic API key. An unauthenticated endpoint that
 * fronts a paid API key is a billing-drain vulnerability: anyone who learns the
 * URL can spend the key's budget. Every handler must therefore establish a
 * caller identity before doing any model work.
 */
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import type { Response } from "express";
import type { Request } from "firebase-functions/v2/https";

/**
 * App Check proves the call came from a genuine build of our app rather than a
 * script. It defaults to ON: a security control that defaults to off is a trap,
 * because staging config quietly becomes production config. Set
 * `REQUIRE_APP_CHECK=false` only for local emulator work.
 */
const requireAppCheck = process.env.REQUIRE_APP_CHECK !== "false";

/** Daily per-user budget, in cost units (see UNIT_COST per endpoint). */
const DAILY_UNIT_BUDGET = 100;

export class RequestRejected extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Verifies the Firebase App Check token, when enforced. */
async function verifyAppCheck(req: Request): Promise<void> {
  const token = req.header("X-Firebase-AppCheck");
  if (!token) {
    if (requireAppCheck) {
      throw new RequestRejected(401, "Missing App Check token.");
    }
    return;
  }
  try {
    await getAppCheck().verifyToken(token);
  } catch {
    throw new RequestRejected(401, "Invalid App Check token.");
  }
}

/** Verifies the Firebase ID token and returns the caller's uid. */
async function verifyCaller(req: Request): Promise<string> {
  const match = /^Bearer (.+)$/.exec(req.header("Authorization") ?? "");
  if (!match) {
    throw new RequestRejected(401, "Missing Authorization: Bearer <idToken>.");
  }
  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    return decoded.uid;
  } catch {
    throw new RequestRejected(401, "Invalid or expired ID token.");
  }
}

/**
 * Charges `units` against the caller's daily budget.
 *
 * Uses a transaction so concurrent requests cannot race past the cap. The
 * counter doc is keyed by uid + UTC date, so it self-expires in relevance
 * without needing a cleanup job (add a TTL policy on `resetAt` to reclaim).
 */
async function charge(uid: string, units: number): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const ref = getFirestore().doc(`ai_usage/${uid}_${day}`);
  await getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = (snap.exists ? snap.get("units") : 0) ?? 0;
    if (used + units > DAILY_UNIT_BUDGET) {
      throw new RequestRejected(429, "Daily AI usage limit reached.");
    }
    tx.set(
      ref,
      {
        uid,
        day,
        units: FieldValue.increment(units),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

/**
 * Wraps a handler so it only runs for an authenticated, app-attested caller
 * who is within their usage budget. Errors are normalised so we never leak
 * internal details (or the shape of the key) to the client.
 */
export function guarded(
  units: number,
  handler: (req: Request, res: Response, uid: string) => Promise<void>
) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      if (req.method !== "POST") {
        throw new RequestRejected(405, "Use POST.");
      }
      await verifyAppCheck(req);
      const uid = await verifyCaller(req);
      await charge(uid, units);
      await handler(req, res, uid);
    } catch (err) {
      if (err instanceof RequestRejected) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      logger.error("Unhandled error in guarded handler", err);
      res.status(500).json({ error: "Internal error." });
    }
  };
}
