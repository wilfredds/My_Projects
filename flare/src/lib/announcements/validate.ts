// Validation for the announcement composer.
//
// Announcements reach every activated user's feed, so a malformed one is
// visible to the whole Bureau. Kept pure and separate from the store so it
// can be tested without Firestore. Relative imports with extensions, because
// `node --test` runs this file directly.
import { ANNOUNCEMENT_TYPES, type AnnouncementType } from "../types.ts";

export const TITLE_MAX = 120;
export const BODY_MAX = 2000;

export type AnnouncementDraft = {
  type: AnnouncementType;
  title: string;
  body: string;
};

export type ValidationResult =
  | { ok: true; value: AnnouncementDraft }
  | { ok: false; error: string };

export function validateAnnouncement(input: {
  type?: unknown;
  title?: unknown;
  body?: unknown;
}): ValidationResult {
  const type = typeof input.type === "string" ? input.type : "";
  if (!(ANNOUNCEMENT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: "Choose what kind of announcement this is." };
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return { ok: false, error: "Give the announcement a title." };
  if (title.length > TITLE_MAX) {
    return { ok: false, error: `Titles are limited to ${TITLE_MAX} characters.` };
  }

  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!body) return { ok: false, error: "Write the announcement text." };
  if (body.length > BODY_MAX) {
    return { ok: false, error: `Announcements are limited to ${BODY_MAX} characters.` };
  }

  // Trimmed values are returned, so trailing whitespace from a paste never
  // reaches the feed.
  return { ok: true, value: { type: type as AnnouncementType, title, body } };
}
