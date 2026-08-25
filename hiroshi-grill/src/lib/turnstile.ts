/**
 * Cloudflare Turnstile — bot protection for the public reservation form (§6).
 *
 * ---------------------------------------------------------------------------
 * WHY BOTH THIS AND THE HONEYPOT
 * ---------------------------------------------------------------------------
 * They catch different things and cost different amounts.
 *
 * The honeypot is free, invisible, and stops commodity spam bots that fill
 * every field they can parse. It asks nothing of a real guest.
 *
 * Turnstile costs a round trip to Cloudflare and can, occasionally, make a real
 * guest click something. In exchange it stops the bot that was written for this
 * specific form and knows to leave the honeypot alone.
 *
 * Keeping both means the cheap defence handles the common case and the
 * expensive one handles the determined case.
 *
 * ---------------------------------------------------------------------------
 * OPTIONAL BY DESIGN
 * ---------------------------------------------------------------------------
 * With no keys configured, Turnstile is simply off and the honeypot carries the
 * load. A restaurant that has not signed up for a Cloudflare account should
 * still be able to take bookings, and a security feature that breaks the
 * product when unconfigured tends to get ripped out rather than configured.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** The field name Cloudflare's widget uses. Not ours to choose. */
export const TURNSTILE_FIELD = "cf-turnstile-response";

export type TurnstileResult = { ok: true } | { ok: false; reason: string };

export type VerifyDeps = {
  secret: string | undefined;
  /** Injected so the tests never touch the network. */
  fetchImpl?: typeof fetch;
};

/** Safe in the browser — a site key is meant to be public. */
export function turnstileSiteKey(): string | undefined {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined;
}

/**
 * Verifies a widget token with Cloudflare.
 *
 * Returns ok when Turnstile is not configured at all — see "optional by design"
 * above. The caller cannot tell the difference, which is intentional: whether
 * the restaurant has a Cloudflare account is not something a visitor should be
 * able to probe.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp: string | null,
  deps: VerifyDeps,
): Promise<TurnstileResult> {
  const secret = deps.secret;

  /* Not configured: nothing to check. */
  if (!secret) return { ok: true };

  /* Configured, but the client sent nothing. Either the widget did not load or
     the request never came from our form. Either way there is no proof of
     humanity to check, so this is a refusal, not a pass. */
  if (!token) return { ok: false, reason: "missing-token" };

  /* Cloudflare caps the token at 2048 characters. Anything longer is not a
     token, and there is no reason to forward it. */
  if (token.length > 2048) return { ok: false, reason: "malformed-token" };

  const body = new URLSearchParams({ secret, response: token });
  /* The visitor's address helps Cloudflare score the request. It is optional,
     and we skip it rather than send something wrong when we do not know it. */
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  const doFetch = deps.fetchImpl ?? fetch;

  try {
    const response = await doFetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      /* Do not let a slow verifier hold a booking open indefinitely. */
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      /* Cloudflare answered, but not with a verdict. Treat like an outage. */
      console.error(`[turnstile] siteverify returned ${response.status}`);
      return { ok: true };
    }

    const result = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (result.success === true) return { ok: true };

    const codes = result["error-codes"] ?? [];
    console.warn("[turnstile] challenge failed:", codes.join(", ") || "no reason given");
    return { ok: false, reason: codes[0] ?? "failed" };
  } catch (error) {
    /**
     * Cloudflare is unreachable, or timed out.
     *
     * This FAILS OPEN, matching the reservation endpoint's rate limiter and for
     * the same reason: the cost of being wrong is some spam a host deletes,
     * against a restaurant that silently stops taking bookings because a third
     * party had a bad afternoon. The honeypot is still in front of this, so
     * failing open is not the same as being undefended.
     *
     * Note this is not a hole an attacker can open at will — they would have to
     * make Cloudflare unreachable *from our server*, which is not something a
     * visitor can arrange.
     */
    console.error("[turnstile] could not reach siteverify, allowing the request:", error);
    return { ok: true };
  }
}
