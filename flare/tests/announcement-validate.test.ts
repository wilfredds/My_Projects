import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  BODY_MAX,
  TITLE_MAX,
  validateAnnouncement,
} from "../src/lib/announcements/validate.ts";

/**
 * Announcement validation.
 *
 * An announcement lands in every activated account's feed and there is no
 * recall, so the checks run before it is written rather than after somebody
 * notices.
 */

const VALID = {
  type: "system",
  title: "Scheduled system maintenance",
  body: "FLARE will be unavailable on Sunday from 8:00 PM to 10:00 PM.",
};

describe("validateAnnouncement", () => {
  test("accepts a well-formed announcement", () => {
    const result = validateAnnouncement(VALID);

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.type, "system");
  });

  test("accepts every type the design's feed shows", () => {
    for (const type of ["course_update", "resource", "system", "assessment_reminder"]) {
      assert.equal(validateAnnouncement({ ...VALID, type }).ok, true, type);
    }
  });

  test("refuses an unrecognised type rather than storing it", () => {
    // The feed renders by type; an unknown one would arrive with no label.
    const result = validateAnnouncement({ ...VALID, type: "urgent" });

    assert.equal(result.ok, false);
    assert.match(result.ok === false ? result.error : "", /kind/i);
  });

  test("refuses empty or whitespace-only text", () => {
    assert.equal(validateAnnouncement({ ...VALID, title: "" }).ok, false);
    assert.equal(validateAnnouncement({ ...VALID, title: "   " }).ok, false);
    assert.equal(validateAnnouncement({ ...VALID, body: "" }).ok, false);
    assert.equal(validateAnnouncement({ ...VALID, body: "  \n " }).ok, false);
  });

  test("trims, so a pasted trailing newline never reaches the feed", () => {
    const result = validateAnnouncement({
      ...VALID,
      title: "  Drill on Friday  ",
      body: "\nReport at 0600.\n\n",
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.title, "Drill on Friday");
    assert.equal(result.ok && result.value.body, "Report at 0600.");
  });

  test("enforces the length limits at the boundary", () => {
    assert.equal(validateAnnouncement({ ...VALID, title: "a".repeat(TITLE_MAX) }).ok, true);
    assert.equal(validateAnnouncement({ ...VALID, title: "a".repeat(TITLE_MAX + 1) }).ok, false);
    assert.equal(validateAnnouncement({ ...VALID, body: "a".repeat(BODY_MAX) }).ok, true);
    assert.equal(validateAnnouncement({ ...VALID, body: "a".repeat(BODY_MAX + 1) }).ok, false);
  });

  test("refuses non-string fields rather than coercing them", () => {
    assert.equal(validateAnnouncement({ ...VALID, title: 42 }).ok, false);
    assert.equal(validateAnnouncement({ ...VALID, body: null }).ok, false);
    assert.equal(validateAnnouncement({}).ok, false);
  });
});
