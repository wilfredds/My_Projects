import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { verifyTurnstile } from "../src/lib/turnstile.ts";

/**
 * Turnstile verification.
 *
 * The `fetch` is injected, so these never touch the network — which matters
 * beyond speed: the failure modes worth testing (Cloudflare down, Cloudflare
 * answering with a 500, a forged token) are precisely the ones you cannot
 * arrange against the real service.
 */

const SECRET = "1x0000000000000000000000000000000AA";
const TOKEN = "0.abc123";

/** A siteverify that answers however the test needs. */
function verifier(payload: unknown, status = 200) {
  const calls: { url: string; body: string }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body ?? "") });
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("when Turnstile is not configured", () => {
  test("passes without calling Cloudflare at all", async () => {
    const { fetchImpl, calls } = verifier({ success: false });

    const result = await verifyTurnstile(null, "203.0.113.5", { secret: undefined, fetchImpl });

    assert.deepEqual(result, { ok: true });
    assert.equal(calls.length, 0, "must not call out when there is no secret");
  });

  test("passes even when a token is present", async () => {
    const { fetchImpl } = verifier({ success: false });
    const result = await verifyTurnstile(TOKEN, null, { secret: "", fetchImpl });
    assert.deepEqual(result, { ok: true });
  });
});

describe("when Turnstile is configured", () => {
  test("accepts a token Cloudflare approves", async () => {
    const { fetchImpl, calls } = verifier({ success: true });

    const result = await verifyTurnstile(TOKEN, "203.0.113.5", { secret: SECRET, fetchImpl });

    assert.deepEqual(result, { ok: true });
    assert.equal(calls.length, 1);
    assert.match(calls[0]!.url, /challenges\.cloudflare\.com/);
  });

  test("sends the secret and token, and the caller's ip", async () => {
    const { fetchImpl, calls } = verifier({ success: true });

    await verifyTurnstile(TOKEN, "203.0.113.5", { secret: SECRET, fetchImpl });

    const body = new URLSearchParams(calls[0]!.body);
    assert.equal(body.get("secret"), SECRET);
    assert.equal(body.get("response"), TOKEN);
    assert.equal(body.get("remoteip"), "203.0.113.5");
  });

  test("omits the ip rather than sending a placeholder", async () => {
    const { fetchImpl, calls } = verifier({ success: true });

    await verifyTurnstile(TOKEN, "unknown", { secret: SECRET, fetchImpl });

    const body = new URLSearchParams(calls[0]!.body);
    assert.equal(body.get("remoteip"), null, "'unknown' is not an address");
  });

  test("refuses a request with no token", async () => {
    const { fetchImpl, calls } = verifier({ success: true });

    const result = await verifyTurnstile(null, null, { secret: SECRET, fetchImpl });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, "missing-token");
    assert.equal(calls.length, 0, "no point asking Cloudflare about nothing");
  });

  test("refuses an empty token", async () => {
    const { fetchImpl } = verifier({ success: true });
    const result = await verifyTurnstile("", null, { secret: SECRET, fetchImpl });
    assert.equal(result.ok, false);
  });

  test("refuses an absurdly long token without forwarding it", async () => {
    const { fetchImpl, calls } = verifier({ success: true });

    const result = await verifyTurnstile("x".repeat(5000), null, { secret: SECRET, fetchImpl });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, "malformed-token");
    assert.equal(calls.length, 0, "must not relay junk to Cloudflare");
  });

  test("refuses a token Cloudflare rejects, and keeps the reason", async () => {
    const { fetchImpl } = verifier({ success: false, "error-codes": ["invalid-input-response"] });

    const result = await verifyTurnstile(TOKEN, null, { secret: SECRET, fetchImpl });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, "invalid-input-response");
  });

  test("refuses a replayed token", async () => {
    // Turnstile tokens are single-use; Cloudflare reports a second use with
    // this code. Nothing for us to track — but we must honour the verdict.
    const { fetchImpl } = verifier({ success: false, "error-codes": ["timeout-or-duplicate"] });

    const result = await verifyTurnstile(TOKEN, null, { secret: SECRET, fetchImpl });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, "timeout-or-duplicate");
  });

  test("refuses even when Cloudflare gives no reason", async () => {
    const { fetchImpl } = verifier({ success: false });
    const result = await verifyTurnstile(TOKEN, null, { secret: SECRET, fetchImpl });
    assert.equal(result.ok, false);
  });
});

describe("when Cloudflare is having a bad day", () => {
  // Fails OPEN, deliberately, and matching the reservation rate limiter. The
  // honeypot is still in front of this, and an attacker cannot make Cloudflare
  // unreachable from our server on demand.

  test("allows the booking when siteverify is unreachable", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const result = await verifyTurnstile(TOKEN, null, { secret: SECRET, fetchImpl });

    assert.deepEqual(result, { ok: true });
  });

  test("allows the booking when siteverify answers with a 500", async () => {
    const { fetchImpl } = verifier({}, 500);
    const result = await verifyTurnstile(TOKEN, null, { secret: SECRET, fetchImpl });
    assert.deepEqual(result, { ok: true });
  });

  test("allows the booking when siteverify returns unparseable junk", async () => {
    const fetchImpl = (async () =>
      new Response("<html>504 Gateway Timeout</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as unknown as typeof fetch;

    const result = await verifyTurnstile(TOKEN, null, { secret: SECRET, fetchImpl });

    assert.deepEqual(result, { ok: true }, "a broken response is an outage, not a failed challenge");
  });
});
