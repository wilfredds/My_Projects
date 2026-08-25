import { RESERVATION_LIMIT, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { handleReservationRequest } from "@/lib/reservations/handler";
import { insertReservation } from "@/lib/reservations/insert";
import { verifyTurnstile } from "@/lib/turnstile";

/**
 * POST /api/reservations
 *
 * A thin adapter. All the decisions live in `handler.ts`, which takes its side
 * effects as arguments so they can be tested; this file supplies the real ones.
 */

/* Never prerender or cache this route. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleReservationRequest(request, {
    rateLimit: (req) =>
      checkRateLimit(
        "reservations",
        req.headers,
        RESERVATION_LIMIT.limit,
        RESERVATION_LIMIT.windowSeconds,
      ),
    verifyCaptcha: async (token, req) => {
      const result = await verifyTurnstile(token, clientIp(req.headers), {
        /* Server-only. A Turnstile SECRET key in the browser bundle would let
           anyone mint their own passes. */
        secret: process.env.TURNSTILE_SECRET_KEY,
      });
      return result.ok;
    },
    insert: insertReservation,
  });
}

/**
 * Anything that is not a POST gets a flat refusal.
 *
 * Without this, a GET to /api/reservations returns Next's 405 — which is
 * correct, but this makes the intent explicit and keeps the endpoint from
 * looking like it might have a readable list behind it. Reading reservations
 * is the staff dashboard's job, through the database's policies.
 */
export async function GET() {
  return new Response(JSON.stringify({ ok: false, error: "Method not allowed." }), {
    status: 405,
    headers: { "content-type": "application/json", allow: "POST" },
  });
}
