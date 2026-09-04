// Validation and identifier generation for authored training content.
//
// Pure and dependency-free so `node --test` can run it directly, which is why
// the imports are relative and carry extensions.
import { LESSON_SECTIONS, type LessonSection } from "../types.ts";

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 500;
export const BODY_MAX = 50_000;

/** Firestore reserves ids of the form __name__, and rejects "." and "..". */
const RESERVED = /^__.*__$/;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Turns a title into a document id.
 *
 * These ids are not cosmetic. Every learner's progress document keys its
 * sections by category id and lesson id, so an id is a foreign key held in
 * thousands of other documents. That is why ids are generated once at
 * creation and never regenerated when a title is edited — see
 * `authoring.ts`, where renaming updates the title only.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    // Strip the combining marks NFKD just split off, so "Dasmariñas" becomes
    // "dasmarinas" rather than losing the character entirely. Written as an
    // escape range because the literal characters are invisible in source.
    .replace(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    // A trailing hyphen can reappear after the length cut.
    .replace(/-+$/g, "");
}

export function validateSlug(slug: string): ValidationResult<string> {
  if (!slug) {
    return { ok: false, error: "That title has no letters or numbers to build an identifier from." };
  }
  if (slug === "." || slug === "..") return { ok: false, error: "That identifier is not allowed." };
  if (RESERVED.test(slug)) return { ok: false, error: "That identifier is reserved." };

  return { ok: true, value: slug };
}

export type CategoryDraft = {
  title: string;
  description: string;
  published: boolean;
};

export function validateCategoryDraft(input: {
  title?: unknown;
  description?: unknown;
  published?: unknown;
}): ValidationResult<CategoryDraft> {
  const title = asTrimmedString(input.title);
  if (!title) return { ok: false, error: "Give the category a title." };
  if (title.length > TITLE_MAX) {
    return { ok: false, error: `Titles are limited to ${TITLE_MAX} characters.` };
  }

  const description = asTrimmedString(input.description);
  if (description.length > DESCRIPTION_MAX) {
    return { ok: false, error: `Descriptions are limited to ${DESCRIPTION_MAX} characters.` };
  }

  return { ok: true, value: { title, description, published: input.published === true } };
}

export type LessonDraft = {
  title: string;
  published: boolean;
};

export function validateLessonDraft(input: {
  title?: unknown;
  published?: unknown;
}): ValidationResult<LessonDraft> {
  const title = asTrimmedString(input.title);
  if (!title) return { ok: false, error: "Give the lesson a title." };
  if (title.length > TITLE_MAX) {
    return { ok: false, error: `Titles are limited to ${TITLE_MAX} characters.` };
  }

  return { ok: true, value: { title, published: input.published === true } };
}

/**
 * Section bodies are stored as Markdown text, never as HTML.
 *
 * Authored content is rendered into every firefighter's browser, so storing
 * HTML would mean an authoring account could inject script into the whole
 * Bureau's session — a stored XSS with the widest possible blast radius.
 * Markdown keeps the stored value inert text: it is rendered through a
 * controlled converter at display time rather than trusted as markup, and it
 * stays readable, diffable and exportable in the database.
 */
export function validateSectionBody(input: unknown): ValidationResult<string> {
  if (typeof input !== "string") return { ok: false, error: "Write the section content." };

  const body = input.trim();
  if (body.length > BODY_MAX) {
    return { ok: false, error: `Sections are limited to ${BODY_MAX.toLocaleString()} characters.` };
  }

  // An empty section is allowed: a lesson may legitimately have nothing under
  // Resources yet, and forcing filler text would be worse than a blank.
  return { ok: true, value: body };
}

export function isLessonSection(value: unknown): value is LessonSection {
  return typeof value === "string" && (LESSON_SECTIONS as readonly string[]).includes(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
