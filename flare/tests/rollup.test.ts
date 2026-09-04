import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { summarizeCategory } from "../src/lib/progress/rollup.ts";
import type { CategoryProgress } from "../src/lib/types.ts";

/**
 * The category rollup, as a regression guard.
 *
 * This function decides what the Home card claims about a firefighter's
 * training. For a Bureau of Fire Protection compliance programme, an
 * over-count is not a cosmetic bug: certificates are issued off the back of
 * it. The cases below are the ones where a stored percentage would have gone
 * wrong and a derived one does not.
 */

const LESSONS = ["overview", "lesson-1", "lesson-2"];

/** Builds a progress document from a terse map of lesson -> finished sections. */
function progress(
  finished: Record<string, Array<"discussion" | "resources" | "assessment">>,
): CategoryProgress {
  const lessons: CategoryProgress["lessons"] = {};
  for (const [lessonId, sections] of Object.entries(finished)) {
    lessons[lessonId] = Object.fromEntries(sections.map((s) => [s, "finished"]));
  }
  return { lessons, updatedAt: null };
}

describe("summarizeCategory", () => {
  test("a learner who has never opened the category is not started", () => {
    const summary = summarizeCategory(LESSONS, null);

    assert.equal(summary.status, "not_started");
    assert.equal(summary.percent, 0);
    assert.equal(summary.finishedSections, 0);
    assert.equal(summary.totalSections, 9);
  });

  test("counts three sections per lesson, not one", () => {
    // The design puts a separate Finished toggle on Discussion, Resources and
    // Assessment. Treating a lesson as one unit would report 33% here.
    const summary = summarizeCategory(LESSONS, progress({ overview: ["discussion"] }));

    assert.equal(summary.finishedSections, 1);
    assert.equal(summary.totalSections, 9);
    assert.equal(summary.percent, 11);
    assert.equal(summary.status, "in_progress");
  });

  test("every section finished completes the category", () => {
    const all = progress({
      overview: ["discussion", "resources", "assessment"],
      "lesson-1": ["discussion", "resources", "assessment"],
      "lesson-2": ["discussion", "resources", "assessment"],
    });
    const summary = summarizeCategory(LESSONS, all);

    assert.equal(summary.status, "completed");
    assert.equal(summary.percent, 100);
    assert.equal(summary.finishedSections, 9);
  });

  test("progress for a lesson no longer in the category is ignored", () => {
    // The crux of deriving rather than storing. An admin retires lesson-2 and
    // replaces it; the learner's record still mentions the retired lesson.
    // Counting it would credit work for material that no longer exists.
    const stale = progress({
      overview: ["discussion", "resources", "assessment"],
      "retired-lesson": ["discussion", "resources", "assessment"],
    });
    const summary = summarizeCategory(LESSONS, stale);

    assert.equal(summary.finishedSections, 3);
    assert.equal(summary.status, "in_progress");
    assert.ok(summary.percent < 100);
  });

  test("adding a lesson lowers an already-complete learner's percentage", () => {
    const done = progress({
      overview: ["discussion", "resources", "assessment"],
      "lesson-1": ["discussion", "resources", "assessment"],
    });

    const before = summarizeCategory(["overview", "lesson-1"], done);
    const after = summarizeCategory(["overview", "lesson-1", "lesson-3"], done);

    assert.equal(before.status, "completed");
    assert.equal(after.status, "in_progress");
    assert.ok(after.percent < before.percent);
  });

  test("never reports 100% until the last section is finished", () => {
    // 199 of 200 rounds to 100%. Showing that beside a CONTINUE button
    // would read as a bug to the learner and as complete to a compliance report.
    const lessons = Array.from({ length: 100 }, (_, i) => `lesson-${i}`);
    const nearlyAll: CategoryProgress = { lessons: {}, updatedAt: null };
    for (const id of lessons) {
      nearlyAll.lessons[id] = { discussion: "finished", resources: "finished", assessment: "finished" };
    }
    // Undo a single section.
    nearlyAll.lessons["lesson-99"] = { discussion: "finished", resources: "finished" };

    const summary = summarizeCategory(lessons, nearlyAll);

    assert.equal(summary.finishedSections, 299);
    assert.equal(summary.totalSections, 300);
    assert.equal(summary.percent, 99);
    assert.equal(summary.status, "in_progress");
  });

  test("an empty category is not started, not complete", () => {
    // Guards a divide-by-zero, and the worse outcome behind it: a category
    // with no lessons reporting as finished and issuing a certificate.
    const summary = summarizeCategory([], null);

    assert.equal(summary.totalSections, 0);
    assert.equal(summary.percent, 0);
    assert.equal(summary.status, "not_started");
  });

  test("sections explicitly marked not_started do not count", () => {
    const summary = summarizeCategory(LESSONS, {
      lessons: { overview: { discussion: "finished", resources: "not_started" } },
      updatedAt: null,
    });

    assert.equal(summary.finishedSections, 1);
  });
});
