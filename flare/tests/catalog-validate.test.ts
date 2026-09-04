import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  BODY_MAX,
  DESCRIPTION_MAX,
  TITLE_MAX,
  slugify,
  validateCategoryDraft,
  validateLessonDraft,
  validateSectionBody,
  validateSlug,
} from "../src/lib/catalog/validate.ts";

/**
 * Content authoring validation.
 *
 * The slug tests carry the most weight. A category or lesson id is a foreign
 * key: every learner's progress document keys its section states by those
 * ids. An id that changes, collides, or contains a character Firestore
 * refuses does not fail loudly — it strands training records that a
 * compliance report will later read as "never started".
 */

describe("slugify", () => {
  test("builds a readable id from a title", () => {
    assert.equal(slugify("Standard Operating Procedures"), "standard-operating-procedures");
    assert.equal(slugify("Lesson 1"), "lesson-1");
  });

  test("matches the ids already seeded for the six categories", () => {
    assert.equal(slugify("Fire Training"), "fire-training");
    assert.equal(slugify("Equipment & Apparatus"), "equipment-apparatus");
    assert.equal(slugify("Fitness & Wellness"), "fitness-wellness");
  });

  test("strips accents rather than dropping the letter", () => {
    // Philippine place names carry them: Dasmariñas is a real BFP station.
    assert.equal(slugify("Dasmariñas Operations"), "dasmarinas-operations");
  });

  test("collapses punctuation and whitespace into single hyphens", () => {
    assert.equal(slugify("  Fire   //  Water:  Rescue!  "), "fire-water-rescue");
  });

  test("never leaves a leading or trailing hyphen", () => {
    assert.equal(slugify("--- Overview ---"), "overview");
    assert.equal(slugify("!!!"), "");
  });

  test("truncates without leaving a trailing hyphen", () => {
    // The naive version cuts mid-word and can end on a separator, which then
    // reads as a typo in every URL it appears in.
    const slug = slugify("a".repeat(58) + " bravo charlie");
    assert.ok(slug.length <= 60);
    assert.ok(!slug.endsWith("-"), `got ${JSON.stringify(slug)}`);
  });

  test("produces only characters Firestore accepts in a document id", () => {
    const slug = slugify("Fire/Water Training: Level #1 — Advanced (2026)");
    assert.match(slug, /^[a-z0-9-]+$/);
    assert.ok(!slug.includes("/"), "a slash would create a subcollection path");
  });
});

describe("validateSlug", () => {
  test("accepts an ordinary slug", () => {
    assert.equal(validateSlug("fire-training").ok, true);
  });

  test("refuses a title with nothing to build an id from", () => {
    // "!!!" slugifies to "", which would otherwise become a document at the
    // collection root.
    const result = validateSlug(slugify("!!!"));
    assert.equal(result.ok, false);
  });

  test("refuses the ids Firestore reserves", () => {
    assert.equal(validateSlug(".").ok, false);
    assert.equal(validateSlug("..").ok, false);
    assert.equal(validateSlug("__proto__").ok, false);
    assert.equal(validateSlug("__name__").ok, false);
  });
});

describe("validateCategoryDraft", () => {
  test("accepts a well-formed category", () => {
    const result = validateCategoryDraft({
      title: "Land Training",
      description: "Rope work, knots and land-based rescue.",
      published: true,
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.published, true);
  });

  test("treats a missing published flag as unpublished", () => {
    // Safer default: new content should not appear to every firefighter, and
    // lower everyone's completion percentage, the instant it is created.
    const result = validateCategoryDraft({ title: "Draft category" });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.published, false);
  });

  test("refuses an empty or whitespace-only title", () => {
    assert.equal(validateCategoryDraft({ title: "" }).ok, false);
    assert.equal(validateCategoryDraft({ title: "   " }).ok, false);
  });

  test("enforces length limits at the boundary", () => {
    assert.equal(validateCategoryDraft({ title: "a".repeat(TITLE_MAX) }).ok, true);
    assert.equal(validateCategoryDraft({ title: "a".repeat(TITLE_MAX + 1) }).ok, false);
    assert.equal(
      validateCategoryDraft({ title: "ok", description: "a".repeat(DESCRIPTION_MAX + 1) }).ok,
      false,
    );
  });

  test("trims, so a pasted title does not carry whitespace into the slug", () => {
    const result = validateCategoryDraft({ title: "  Water Training \n" });
    assert.equal(result.ok && result.value.title, "Water Training");
  });
});

describe("validateLessonDraft", () => {
  test("accepts a well-formed lesson", () => {
    assert.equal(validateLessonDraft({ title: "Lesson 1", published: true }).ok, true);
  });

  test("refuses an empty title", () => {
    assert.equal(validateLessonDraft({ title: "  " }).ok, false);
  });

  test("defaults to unpublished", () => {
    const result = validateLessonDraft({ title: "Lesson 2" });
    assert.equal(result.ok && result.value.published, false);
  });
});

describe("validateSectionBody", () => {
  test("accepts Markdown text", () => {
    const result = validateSectionBody("## Overview\n\nCheck the SCBA seal before entry.");
    assert.equal(result.ok, true);
  });

  test("accepts an empty section", () => {
    // A lesson may have nothing under Resources yet. Forcing filler text
    // would be worse than a blank.
    const result = validateSectionBody("   ");
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, "");
  });

  test("refuses a non-string", () => {
    assert.equal(validateSectionBody(null).ok, false);
    assert.equal(validateSectionBody(42).ok, false);
  });

  test("enforces the length limit at the boundary", () => {
    assert.equal(validateSectionBody("a".repeat(BODY_MAX)).ok, true);
    assert.equal(validateSectionBody("a".repeat(BODY_MAX + 1)).ok, false);
  });

  test("stores markup as inert text rather than rejecting it", () => {
    // The defence is that this is never rendered as HTML, not that angle
    // brackets are banned — an author writing about an XML config file has a
    // legitimate reason to type them.
    const result = validateSectionBody("<script>alert(1)</script>");
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value, "<script>alert(1)</script>");
  });
});
