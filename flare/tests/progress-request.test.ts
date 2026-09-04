import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { parseProgressRequest } from "../src/lib/progress/request.ts";

/**
 * Validation for the progress endpoint.
 *
 * The case that matters most is the assessment one. The design draws the same
 * Not Started / Finished toggle on all three sections, so a client author
 * copying the Discussion call for Assessment is the obvious mistake to make.
 * It has to be refused at the boundary, with an error that says why — a
 * learner marking their own assessment complete is how an unearned
 * certificate gets issued.
 */

const VALID = {
  categoryId: "land",
  lessonId: "lesson-1",
  section: "discussion",
  state: "finished",
};

describe("parseProgressRequest", () => {
  test("accepts a well-formed self-reported completion", () => {
    const result = parseProgressRequest(VALID);

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.value, {
      categoryId: "land",
      lessonId: "lesson-1",
      section: "discussion",
      state: "finished",
    });
  });

  test("accepts un-ticking a section", () => {
    const result = parseProgressRequest({ ...VALID, state: "not_started" });
    assert.equal(result.ok, true);
  });

  test("accepts the resources section", () => {
    const result = parseProgressRequest({ ...VALID, section: "resources" });
    assert.equal(result.ok, true);
  });

  test("REFUSES to let a learner mark their own assessment finished", () => {
    const result = parseProgressRequest({ ...VALID, section: "assessment" });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.error, "assessment_requires_submission");
  });

  test("refuses an unknown section", () => {
    const result = parseProgressRequest({ ...VALID, section: "notes" });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.error, "invalid_section");
  });

  test("refuses an unknown state", () => {
    const result = parseProgressRequest({ ...VALID, state: "completed" });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.error, "invalid_state");
  });

  test("refuses missing or empty identifiers", () => {
    assert.equal(parseProgressRequest({ ...VALID, categoryId: "" }).ok, false);
    assert.equal(parseProgressRequest({ ...VALID, lessonId: "" }).ok, false);
    assert.equal(parseProgressRequest({ ...VALID, categoryId: undefined }).ok, false);
  });

  test("refuses non-string identifiers rather than coercing them", () => {
    const result = parseProgressRequest({ ...VALID, lessonId: 1 });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.error, "invalid_lesson");
  });

  test("refuses bodies that are not objects", () => {
    for (const body of [null, undefined, "finished", 42, []]) {
      assert.equal(parseProgressRequest(body).ok, false, `should refuse ${JSON.stringify(body)}`);
    }
  });

  test("ignores extra fields rather than passing them through", () => {
    // A caller adding `uid` must not be able to write someone else's record:
    // the handler takes the uid from the verified session, and the parser
    // returns only the four fields it recognises.
    const result = parseProgressRequest({ ...VALID, uid: "someone-else", passed: true });

    assert.equal(result.ok, true);
    assert.deepEqual(
      result.ok && Object.keys(result.value).sort(),
      ["categoryId", "lessonId", "section", "state"],
    );
  });
});
