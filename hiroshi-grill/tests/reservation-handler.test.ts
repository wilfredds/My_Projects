import assert from "node:assert/strict";
import test, { beforeEach, describe } from "node:test";

import { handleReservationRequest, type ReservationDeps } from "../src/lib/reservations/handler.ts";
import type { ReservationPayload } from "../src/lib/reservation.ts";

/**
 * Tests for the reservation endpoint.
 *
 * Run with `npm test`. No framework, no Supabase project, no server — the
 * handler takes its side effects as arguments, so these are ordinary function
 * calls.
 *
 * Most of what follows checks that something did NOT happen: the honeypot
 * request never reached the database, the pre-confirmed payload never got
 * through, the oversized body was never parsed. Those paths are invisible when
 * you test by clicking, which is exactly why they are the ones that rot.
 */

/** A booking a few days out, so it is always in the future when the suite runs. */
function futureDate(daysAhead = 3): string {
  const now = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Ana Reyes",
    contact: "0917 123 4567",
    reserveDate: futureDate(),
    reserveTime: "18:30",
    partySize: "4",
    package: "master",
    notes: "",
    website: "",
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://hiroshi.test/api/reservations", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

let inserted: ReservationPayload[];
let rateLimitCalls: number;
let allowRequests: boolean;
let insertThrows: boolean;
let captchaCalls: (string | null)[];
let captchaPasses: boolean;

function deps(): ReservationDeps {
  return {
    rateLimit: async () => {
      rateLimitCalls += 1;
      return allowRequests;
    },
    verifyCaptcha: async (token) => {
      captchaCalls.push(token);
      return captchaPasses;
    },
    insert: async (payload) => {
      if (insertThrows) throw new Error("connection refused to db-prod-1.internal:5432");
      inserted.push(payload);
    },
  };
}

beforeEach(() => {
  inserted = [];
  rateLimitCalls = 0;
  allowRequests = true;
  insertThrows = false;
  captchaCalls = [];
  captchaPasses = true;
});

describe("a genuine booking", () => {
  test("is accepted and written once", async () => {
    const response = await handleReservationRequest(post(validBody()), deps());

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0]!.name, "Ana Reyes");
  });

  test("is stored from the schema's output, not the raw body", async () => {
    // Untrimmed name, party size as a string, and an extra field the client
    // had no business sending.
    await handleReservationRequest(
      post(validBody({ name: "  Ana Reyes  ", partySize: "4", status: "confirmed" })),
      deps(),
    );

    const row = inserted[0]!;
    assert.equal(row.name, "Ana Reyes", "name should be trimmed by the schema");
    assert.equal(row.partySize, 4, "party size should be coerced to a number");
    assert.equal(
      (row as Record<string, unknown>).status,
      undefined,
      "an unknown key must not survive validation — the database sets the status",
    );
  });

  test("is never cached", async () => {
    const response = await handleReservationRequest(post(validBody()), deps());
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

describe("server-side validation", () => {
  // The browser ran the same schema already. This proves that meant nothing:
  // every one of these gets past the form and dies at the endpoint.
  const rejected: [string, Record<string, unknown>][] = [
    ["an empty name", { name: "" }],
    ["a name of one character", { name: "A" }],
    ["a missing contact number", { contact: "" }],
    ["a contact number full of letters", { contact: "call me maybe" }],
    ["a date in the past", { reserveDate: "2020-01-01" }],
    ["a date beyond the booking horizon", { reserveDate: "2099-01-01" }],
    ["a malformed date", { reserveDate: "not-a-date" }],
    ["a malformed time", { reserveTime: "25:99" }],
    ["a party of zero", { partySize: "0" }],
    ["a party of a thousand", { partySize: "1000" }],
    ["a negative party size", { partySize: "-4" }],
    ["a package that does not exist", { package: "free-food" }],
    ["notes longer than the column allows", { notes: "x".repeat(501) }],
  ];

  for (const [description, override] of rejected) {
    test(`rejects ${description}`, async () => {
      const response = await handleReservationRequest(post(validBody(override)), deps());

      assert.equal(response.status, 400, `${description} should be refused`);
      assert.equal(inserted.length, 0, `${description} must never reach the database`);

      const payload = (await response.json()) as { ok: boolean; errors: Record<string, string> };
      assert.equal(payload.ok, false);
      assert.ok(Object.keys(payload.errors).length > 0, "should say which field was wrong");
    });
  }

  test("cannot be talked into a pre-confirmed booking", async () => {
    // Belt and braces with the RLS policy: even if this got through, the
    // database would refuse it. Neither layer relies on the other.
    await handleReservationRequest(post(validBody({ status: "confirmed" })), deps());
    assert.equal((inserted[0] as Record<string, unknown>).status, undefined);
  });
});

describe("the honeypot", () => {
  test("drops the request without touching the database", async () => {
    const response = await handleReservationRequest(
      post(validBody({ website: "https://buy-cheap-things.example" })),
      deps(),
    );

    assert.equal(inserted.length, 0, "a honeypot hit must never be stored");
    assert.equal(rateLimitCalls, 0, "and must not cost a database round trip either");
    assert.equal(response.status, 201, "but must look exactly like success to the bot");
    assert.deepEqual(await response.json(), { ok: true });
  });

  test("ignores whitespace, which a real browser can leave behind", async () => {
    await handleReservationRequest(post(validBody({ website: "   " })), deps());
    assert.equal(inserted.length, 1, "whitespace alone is not a bot");
  });
});

describe("rate limiting", () => {
  test("refuses with 429 once the caller is over budget", async () => {
    allowRequests = false;

    const response = await handleReservationRequest(post(validBody()), deps());

    assert.equal(response.status, 429);
    assert.equal(inserted.length, 0);
  });

  test("a limiter that throws must not take the endpoint down", async () => {
    // Regression: the limiter once raised on a missing config value, and every
    // booking came back as an unhandled 500. The limiter protects the endpoint;
    // it does not get to break it.
    const throwingDeps: ReservationDeps = {
      ...deps(),
      rateLimit: async () => {
        throw new Error("RATE_LIMIT_SALT is required in production");
      },
    };

    const response = await handleReservationRequest(post(validBody()), throwingDeps);

    assert.equal(response.status, 201, "the booking should still go through");
    assert.equal(inserted.length, 1);
  });

  test("is checked before the payload is validated", async () => {
    // A flood of garbage should be cheap to refuse: the limiter runs first, so
    // an attacker cannot make us do validation work by sending nonsense fast.
    allowRequests = false;

    const response = await handleReservationRequest(post(validBody({ name: "" })), deps());

    assert.equal(response.status, 429, "the limit should answer before validation does");
  });
});

describe("malformed requests", () => {
  test("refuses a body that is not JSON", async () => {
    const response = await handleReservationRequest(post("this is not json"), deps());
    assert.equal(response.status, 400);
    assert.equal(inserted.length, 0);
  });

  test("refuses a JSON array", async () => {
    const response = await handleReservationRequest(post([1, 2, 3]), deps());
    assert.equal(response.status, 400);
  });

  test("refuses a JSON null", async () => {
    const response = await handleReservationRequest(post(null), deps());
    assert.equal(response.status, 400);
  });

  test("refuses a form post", async () => {
    const response = await handleReservationRequest(
      post(validBody(), { "content-type": "application/x-www-form-urlencoded" }),
      deps(),
    );
    assert.equal(response.status, 415);
    assert.equal(rateLimitCalls, 0);
  });

  test("refuses an oversized body without parsing it", async () => {
    const huge = JSON.stringify({ ...validBody(), notes: "x".repeat(20_000) });
    const response = await handleReservationRequest(post(huge), deps());

    assert.equal(response.status, 413);
    assert.equal(rateLimitCalls, 0, "an oversized body should cost nothing downstream");
  });

  test("refuses a body whose content-length lies about being small", async () => {
    const huge = JSON.stringify({ ...validBody(), notes: "x".repeat(20_000) });
    const response = await handleReservationRequest(
      post(huge, { "content-length": "10" }),
      deps(),
    );

    assert.equal(response.status, 413, "the real size is what counts, not the claim");
  });
});

describe("when the database is down", () => {
  test("apologises without leaking the reason", async () => {
    insertThrows = true;

    const response = await handleReservationRequest(post(validBody()), deps());
    const payload = (await response.json()) as { ok: boolean; error: string };

    assert.equal(response.status, 500);
    assert.equal(payload.ok, false);
    // The real error names an internal host and port. None of that belongs in
    // a response to the public.
    assert.ok(!payload.error.includes("db-prod-1"), "must not leak internal hostnames");
    assert.ok(!payload.error.includes("5432"), "must not leak internal ports");
    assert.match(payload.error, /try again|call us/i, "should tell the guest what to do");
  });
});

describe("the bot challenge", () => {
  test("passes the widget token through to the verifier", async () => {
    await handleReservationRequest(
      post(validBody({ "cf-turnstile-response": "0.token-from-widget" })),
      deps(),
    );

    assert.deepEqual(captchaCalls, ["0.token-from-widget"]);
  });

  test("reports null when the client sent no token", async () => {
    await handleReservationRequest(post(validBody()), deps());
    assert.deepEqual(captchaCalls, [null], "the verifier decides whether that matters");
  });

  test("refuses the booking when the challenge fails", async () => {
    captchaPasses = false;

    const response = await handleReservationRequest(post(validBody()), deps());
    const payload = (await response.json()) as { errors: Record<string, string> };

    assert.equal(response.status, 400);
    assert.equal(inserted.length, 0, "a failed challenge must never reach the database");
    assert.ok(payload.errors.captcha, "should point at the widget, not a random field");
  });

  test("is checked after validation, so junk costs nothing at Cloudflare", async () => {
    const response = await handleReservationRequest(post(validBody({ name: "" })), deps());

    assert.equal(response.status, 400);
    assert.equal(captchaCalls.length, 0, "a malformed payload should not reach the verifier");
  });

  test("is not consulted at all for a honeypot hit", async () => {
    await handleReservationRequest(post(validBody({ website: "spam" })), deps());
    assert.equal(captchaCalls.length, 0);
  });

  test("a verifier that throws must not take the endpoint down", async () => {
    const throwingDeps: ReservationDeps = {
      ...deps(),
      verifyCaptcha: async () => {
        throw new Error("challenges.cloudflare.com ETIMEDOUT");
      },
    };

    const response = await handleReservationRequest(post(validBody()), throwingDeps);

    assert.equal(response.status, 201, "the booking should still go through");
    assert.equal(inserted.length, 1);
  });
});
