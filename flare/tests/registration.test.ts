import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  validateRegistration,
} from "../src/lib/users/registration.ts";

const VALID = {
  username: "fo1santos",
  email: "maria.santos@bfp.gov.ph",
  password: "correct horse battery",
  confirmPassword: "correct horse battery",
};

describe("validateRegistration", () => {
  test("accepts a well-formed registration", () => {
    const result = validateRegistration(VALID);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.username, "fo1santos");
  });

  test("lowercases the email so one address cannot register twice", () => {
    const result = validateRegistration({ ...VALID, email: "Maria.Santos@BFP.gov.ph" });
    assert.equal(result.ok && result.value.email, "maria.santos@bfp.gov.ph");
  });

  test("refuses mismatched passwords, naming the confirm field", () => {
    const result = validateRegistration({ ...VALID, confirmPassword: "something else" });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.field, "confirm");
  });

  test("enforces the password minimum at the boundary", () => {
    const short = "a".repeat(PASSWORD_MIN - 1);
    const exact = "a".repeat(PASSWORD_MIN);
    assert.equal(validateRegistration({ ...VALID, password: short, confirmPassword: short }).ok, false);
    assert.equal(validateRegistration({ ...VALID, password: exact, confirmPassword: exact }).ok, true);
  });

  test("does not trim passwords", () => {
    // Trimming silently changes the credential, and the account then cannot
    // be opened with the password its owner believes they set.
    const padded = "  spaced out  ";
    const result = validateRegistration({ ...VALID, password: padded, confirmPassword: padded });
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.password, padded);
  });

  test("enforces username length at both boundaries", () => {
    assert.equal(validateRegistration({ ...VALID, username: "a".repeat(USERNAME_MIN - 1) }).ok, false);
    assert.equal(validateRegistration({ ...VALID, username: "a".repeat(USERNAME_MIN) }).ok, true);
    assert.equal(validateRegistration({ ...VALID, username: "a".repeat(USERNAME_MAX) }).ok, true);
    assert.equal(validateRegistration({ ...VALID, username: "a".repeat(USERNAME_MAX + 1) }).ok, false);
  });

  test("refuses usernames with spaces or markup characters", () => {
    for (const username of ["fo1 santos", "<script>", "santos/admin", "maría"]) {
      assert.equal(validateRegistration({ ...VALID, username }).ok, false, username);
    }
  });

  test("refuses obviously malformed email addresses", () => {
    for (const email of ["maria", "maria@", "@bfp.gov.ph", "maria bfp.gov.ph", "a@b"]) {
      assert.equal(validateRegistration({ ...VALID, email }).ok, false, email);
    }
  });

  test("reports which field failed, so the form can point at it", () => {
    const blankUsername = validateRegistration({ ...VALID, username: "" });
    const badEmail = validateRegistration({ ...VALID, email: "nope" });

    assert.equal(blankUsername.ok === false && blankUsername.field, "username");
    assert.equal(badEmail.ok === false && badEmail.field, "email");
  });

  test("refuses non-string input rather than coercing it", () => {
    assert.equal(validateRegistration({}).ok, false);
    assert.equal(validateRegistration({ ...VALID, username: 42 }).ok, false);
  });
});
