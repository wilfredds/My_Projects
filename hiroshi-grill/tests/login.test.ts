import assert from "node:assert/strict";
import test, { beforeEach, describe } from "node:test";

import {
  handleLogin,
  safeRedirectPath,
  type LoginDeps,
} from "../src/lib/auth/login.ts";

/**
 * Tests for sign-in.
 *
 * The two things worth testing here are both invisible from the form: that
 * every kind of failure produces the *same* sentence, and that the `next`
 * parameter cannot be turned into a link to somebody else's site.
 */

let rateLimitCalls: string[];
let allowAttempts: boolean;
let credentialsGood: boolean;
let signInThrows: boolean;
let signInCalls: number;

function deps(): LoginDeps {
  return {
    rateLimit: async (email) => {
      rateLimitCalls.push(email);
      return allowAttempts;
    },
    signIn: async () => {
      signInCalls += 1;
      if (signInThrows) throw new Error("AuthApiError: User not found (uid=8f21…)");
      return credentialsGood;
    },
  };
}

beforeEach(() => {
  rateLimitCalls = [];
  allowAttempts = true;
  credentialsGood = true;
  signInThrows = false;
  signInCalls = 0;
});

const good = { email: "host@example.com", password: "correct horse battery staple" };

describe("a valid sign-in", () => {
  test("succeeds and goes to the dashboard", async () => {
    const result = await handleLogin(good, null, deps());

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.redirectTo, "/portal/dashboard");
  });

  test("honours a safe next path", async () => {
    const result = await handleLogin(good, "/portal/dashboard/today", deps());
    assert.equal(result.ok && result.redirectTo, "/portal/dashboard/today");
  });

  test("normalises the email before rate limiting", async () => {
    // Trimmed AND lowercased. Without the lowercase, an attacker gets a fresh
    // per-email budget for every capitalisation of the same address.
    await handleLogin({ ...good, email: "  Host@Example.com  " }, null, deps());
    assert.equal(rateLimitCalls[0], "host@example.com");
  });

  test("a stray space does not stop a real person signing in", async () => {
    // Regression: the schema validated the address before trimming it, so a
    // phone keyboard adding a trailing space locked staff out entirely.
    const result = await handleLogin({ ...good, email: "host@example.com " }, null, deps());
    assert.equal(result.ok, true);
  });
});

describe("failures all look the same", () => {
  // User enumeration: if "no such account" and "wrong password" read
  // differently, an attacker walks a list of addresses and keeps the ones that
  // say "wrong password". That shortlist is the whole attack.
  test("wrong password and unknown account give an identical message", async () => {
    credentialsGood = false;
    const wrongPassword = await handleLogin(good, null, deps());

    beforeEachReset();
    signInThrows = true;
    const unknownAccount = await handleLogin(good, null, deps());

    assert.equal(wrongPassword.ok, false);
    assert.equal(unknownAccount.ok, false);
    assert.equal(
      !wrongPassword.ok && wrongPassword.message,
      !unknownAccount.ok && unknownAccount.message,
      "the two failures must be indistinguishable",
    );
  });

  test("never leaks the provider's own error text", async () => {
    signInThrows = true;
    const result = await handleLogin(good, null, deps());

    assert.equal(result.ok, false);
    const message = !result.ok ? result.message : "";
    assert.ok(!message.includes("User not found"), "must not confirm the account is unknown");
    assert.ok(!message.includes("uid="), "must not leak internal identifiers");
    assert.ok(!message.includes("AuthApiError"), "must not leak the provider's error class");
  });

  test("never says whether the email exists, even for a well-formed miss", async () => {
    credentialsGood = false;
    const result = await handleLogin(
      { email: "definitely-not-staff@example.com", password: "x" },
      null,
      deps(),
    );

    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.message : "", /did not match/i);
  });
});

describe("rate limiting", () => {
  test("refuses once the caller is over budget", async () => {
    allowAttempts = false;

    const result = await handleLogin(good, null, deps());

    assert.equal(result.ok, false);
    assert.equal(signInCalls, 0, "must not attempt the credentials at all");
    assert.match(!result.ok ? result.message : "", /too many/i);
  });

  test("fails CLOSED when the limiter itself breaks", async () => {
    // The opposite of the reservation form, on purpose. The limiter and
    // Supabase Auth are the same service, so a limiter that cannot answer means
    // the sign-in was going to fail anyway — refusing costs a case that was
    // already lost, and denies an outage as a window for guessing passwords.
    const brokenDeps: LoginDeps = {
      ...deps(),
      rateLimit: async () => {
        throw new Error("database unreachable");
      },
    };

    const result = await handleLogin(good, null, brokenDeps);

    assert.equal(result.ok, false);
    assert.equal(signInCalls, 0, "must not fall through to the credential check");
  });

  test("is checked before the password is", async () => {
    allowAttempts = false;
    await handleLogin(good, null, deps());
    assert.equal(signInCalls, 0);
  });
});

describe("malformed input", () => {
  for (const [description, input] of [
    ["a missing email", { email: "", password: "x" }],
    ["an email that is not one", { email: "not-an-email", password: "x" }],
    ["a missing password", { email: "host@example.com", password: "" }],
    ["a null body", null],
    ["a string body", "email=host@example.com"],
  ] as [string, unknown][]) {
    test(`refuses ${description}`, async () => {
      const result = await handleLogin(input, null, deps());
      assert.equal(result.ok, false);
      assert.equal(signInCalls, 0, "must never reach the credential check");
    });
  }
});

describe("the next parameter cannot become an open redirect", () => {
  // A link to /portal?next=https://hiroshi-grlll.example/portal would send
  // staff to a lookalike site the instant they sign in — at the exact moment
  // they are least suspicious, because the URL they clicked really was ours.
  const hostile = [
    "https://evil.example/portal",
    "http://evil.example",
    "//evil.example",
    "//evil.example/portal",
    "\\\\evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/portal/../../etc/passwd",
    "/",
    "/menu",
    "/api/reservations",
  ];

  for (const next of hostile) {
    test(`refuses ${JSON.stringify(next)}`, async () => {
      assert.equal(
        safeRedirectPath(next),
        "/portal/dashboard",
        `${next} should fall back to the dashboard`,
      );
    });
  }

  for (const next of ["/portal", "/portal/dashboard", "/portal/dashboard/today"]) {
    test(`allows ${JSON.stringify(next)}`, async () => {
      assert.equal(safeRedirectPath(next), next);
    });
  }

  test("falls back when absent", () => {
    assert.equal(safeRedirectPath(null), "/portal/dashboard");
    assert.equal(safeRedirectPath(undefined), "/portal/dashboard");
    assert.equal(safeRedirectPath(""), "/portal/dashboard");
  });

  test("the guard is applied by handleLogin, not just exported", async () => {
    const result = await handleLogin(good, "https://evil.example", deps());
    assert.equal(result.ok && result.redirectTo, "/portal/dashboard");
  });
});

/** Resets the module-level fakes mid-test, for the comparison above. */
function beforeEachReset() {
  rateLimitCalls = [];
  allowAttempts = true;
  credentialsGood = true;
  signInThrows = false;
  signInCalls = 0;
}
