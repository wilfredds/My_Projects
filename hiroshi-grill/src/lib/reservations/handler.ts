import { validateReservation, type ReservationPayload } from "../reservation.ts";
import { TURNSTILE_FIELD } from "../turnstile.ts";

/**
 * The reservation endpoint's logic, with its side effects passed in.
 *
 * Everything that touches the outside world — the rate limiter, the database
 * insert, the clock — arrives as a dependency, so the whole decision tree can
 * be tested without a Supabase project, a network, or a running server. The
 * route file in `src/app/api/reservations/route.ts` is then a two-line adapter
 * that supplies the real ones.
 *
 * That matters more than it sounds: the security-relevant behaviour here is
 * mostly about what does NOT happen — a honeypot hit that must not reach the
 * database, a payload that must not be trusted because the browser already
 * checked it. Those are exactly the paths that never get exercised by clicking
 * around, and exactly the ones that quietly rot.
 */

export type ReservationDeps = {
  /** Returns true when the caller is within budget. */
  rateLimit: (request: Request) => Promise<boolean>;
  /** Returns true when the bot challenge passed, or is not configured. */
  verifyCaptcha: (token: string | null, request: Request) => Promise<boolean>;
  /** Writes the row. Throws on failure. */
  insert: (payload: ReservationPayload) => Promise<void>;
};

/** Bodies larger than this are refused unread. A real one is well under 1 KB. */
const MAX_BODY_BYTES = 8 * 1024;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      /* A booking response is never worth storing anywhere. */
      "cache-control": "no-store",
    },
  });
}

/** The response a successful request gets — and, deliberately, a bot too. */
const accepted = () => json({ ok: true }, 201);

export async function handleReservationRequest(
  request: Request,
  deps: ReservationDeps,
): Promise<Response> {
  /* 1. Only JSON. Refusing anything else costs one line and rules out a family
        of confused-deputy tricks that rely on a form POST being read as JSON —
        including CSRF attempts, since a browser cannot send this content type
        cross-origin from a plain <form> without a preflight. */
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ ok: false, error: "Expected application/json." }, 415);
  }

  /* 2. Cap the body before parsing it. Without this, one request claiming to be
        50 MB of JSON ties up a serverless instance parsing it. */
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: "That request is too large." }, 413);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json({ ok: false, error: "Could not read the request." }, 400);
  }

  /* content-length can lie or be absent, so the real check is on what arrived. */
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: "That request is too large." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "That request was not valid JSON." }, 400);
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return json({ ok: false, error: "That request was not valid JSON." }, 400);
  }

  /* 3. The honeypot, checked first because it is free and because it is the
        one branch that must never touch the database.

        A filled honeypot gets the SAME 201 a real booking gets. Telling a bot
        it was caught teaches whoever wrote it to stop filling that field; a
        cheerful success teaches them nothing and they keep walking into it.
        Nothing is stored.

        (A determined attacker could still tell the two apart by timing, since
        the real path does database work and this one returns immediately.
        Closing that gap is not worth the complexity here — the honeypot is
        there to stop commodity spam bots, not a targeted attacker.) */
  const honeypot = (body as Record<string, unknown>).website;
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    console.warn("[reservations] honeypot triggered; request dropped");
    return accepted();
  }

  /* 4. Rate limit before doing any real work.

        Wrapped, because a throw from the limiter must never become a failed
        booking. This is not hypothetical: an earlier version raised on a
        missing config value, and every single reservation attempt came back as
        an unhandled 500. The limiter protects the endpoint; it does not get to
        take it down. */
  let withinBudget = true;
  try {
    withinBudget = await deps.rateLimit(request);
  } catch (error) {
    console.error("[reservations] rate limit check threw; allowing the request:", error);
  }

  if (!withinBudget) {
    return json(
      {
        ok: false,
        error: "That is a lot of requests in a short time. Please try again shortly, or call us.",
      },
      429,
    );
  }

  /* 5. Validate on the server.

        The browser already ran this exact schema and showed friendly errors as
        the guest typed. None of that is a security control: this request may
        never have been near our form. It could be curl. So the schema runs
        again here, on the real payload, and only what comes out of it is
        allowed anywhere near the database.

        Note what we use afterwards — `result.data`, the schema's *output*, not
        `body`. Trimmed, coerced, with unknown keys dropped. Passing the raw
        body along after validating it is a surprisingly common way to undo the
        validation you just did. */
  const result = validateReservation(body);
  if (!result.ok) {
    return json({ ok: false, errors: result.errors }, 400);
  }

  /* 6. The bot challenge, if one is configured.

        Deliberately AFTER validation, which is free and local, so a flood of
        malformed requests costs us nothing at Cloudflare. And deliberately
        after the rate limit, so it cannot be used to make us generate traffic.

        A failure here is reported as a field error on the widget rather than a
        generic refusal, because the usual cause is not an attack — it is a
        guest whose token expired while they filled the form in. */
  const captchaToken = (body as Record<string, unknown>)[TURNSTILE_FIELD];
  const humanEnough = await deps
    .verifyCaptcha(typeof captchaToken === "string" ? captchaToken : null, request)
    .catch((error) => {
      /* Same rule as the rate limiter: a check that cannot answer must not take
         the booking form down with it. */
      console.error("[reservations] captcha check threw; allowing the request:", error);
      return true;
    });

  if (!humanEnough) {
    return json(
      {
        ok: false,
        errors: { captcha: "Please complete the challenge below and try again." },
      },
      400,
    );
  }

  /* 7. Write it. The insert runs as the public `anon` role, so the row still
        has to satisfy the RLS policy — which pins it to status = 'pending'.
        Using the service-role key here would have been easier and would have
        thrown that away. */
  try {
    await deps.insert(result.data);
  } catch (error) {
    /* The real reason goes to the server log. The caller gets a sentence.
       Database errors are full of table names, column names and constraint
       names — a free schema diagram for anyone probing the endpoint. */
    console.error("[reservations] insert failed:", error);
    return json(
      { ok: false, error: "We could not save that request. Please try again, or call us." },
      500,
    );
  }

  return accepted();
}
