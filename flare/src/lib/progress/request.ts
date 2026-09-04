// Validation for the progress endpoint's request body.
//
// Kept out of the route handler so it can be tested without a server, a
// session or a database — the same split hiroshi-grill uses. Relative
// imports with extensions, because `node --test` runs this file directly and
// does not resolve the "@/" alias.
import type { SectionState } from "../types.ts";
import { isSelfReportable } from "./sections.ts";

export type ProgressRequest = {
  categoryId: string;
  lessonId: string;
  section: "discussion" | "resources";
  state: SectionState;
};

export type ParseResult =
  | { ok: true; value: ProgressRequest }
  | { ok: false; error: string };

export function parseProgressRequest(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "invalid_body" };
  }

  const { categoryId, lessonId, section, state } = body as Record<string, unknown>;

  if (typeof categoryId !== "string" || !categoryId) return { ok: false, error: "invalid_category" };
  if (typeof lessonId !== "string" || !lessonId) return { ok: false, error: "invalid_lesson" };
  if (typeof section !== "string") return { ok: false, error: "invalid_section" };

  // The assessment state is set by grading, never by a learner saying so.
  // Given its own error rather than being lumped in with a mistyped section
  // name: this is a different mistake, and a client author needs to be told
  // that submission is the route, not that the value was unrecognised.
  if (section === "assessment") {
    return { ok: false, error: "assessment_requires_submission" };
  }
  if (!isSelfReportable(section)) return { ok: false, error: "invalid_section" };

  if (state !== "finished" && state !== "not_started") {
    return { ok: false, error: "invalid_state" };
  }

  return { ok: true, value: { categoryId, lessonId, section, state } };
}
