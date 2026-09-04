// Relative, with the extension: this module is exercised directly by
// `node --test`, which does not resolve the "@/" path alias.
import {
  LESSON_SECTIONS,
  type CategoryProgress,
  type CategoryStatus,
  type CategorySummary,
} from "../types.ts";

/**
 * Turns a learner's stored section states into the figure the Home card shows.
 *
 * This is deliberately a pure function over the CURRENT lesson list rather
 * than a stored percentage. Two things follow from that, and both matter for a
 * training-compliance system:
 *
 *   - Adding a lesson to a category immediately lowers everyone's percentage,
 *     which is correct: they have not done the new material. A stored number
 *     would keep reporting them complete.
 *   - Progress recorded against a lesson that has since been removed is
 *     ignored rather than counted, so a deleted lesson cannot leave someone
 *     showing more than 100% or completing a category they never finished.
 *
 * @param lessonIds  Lessons currently published in the category. Order is
 *                   irrelevant; only membership is used.
 * @param progress   The learner's stored progress for this category, or null
 *                   if they have never opened it.
 */
export function summarizeCategory(
  lessonIds: readonly string[],
  progress: CategoryProgress | null,
): CategorySummary {
  const totalSections = lessonIds.length * LESSON_SECTIONS.length;

  let finishedSections = 0;
  for (const lessonId of lessonIds) {
    const lesson = progress?.lessons?.[lessonId];
    if (!lesson) continue;
    for (const section of LESSON_SECTIONS) {
      if (lesson[section] === "finished") finishedSections += 1;
    }
  }

  return {
    totalSections,
    finishedSections,
    percent: toPercent(finishedSections, totalSections),
    status: toStatus(finishedSections, totalSections),
  };
}

function toStatus(finished: number, total: number): CategoryStatus {
  // An empty category is "not started" rather than "complete". Reporting a
  // category with no content as finished would hand out certificates for it.
  if (total === 0 || finished === 0) return "not_started";
  return finished >= total ? "completed" : "in_progress";
}

function toPercent(finished: number, total: number): number {
  if (total === 0) return 0;
  if (finished >= total) return 100;

  // Cap short of 100 until every section is genuinely done: rounding alone
  // would render 199/200 as "100%" next to a card that still says CONTINUE.
  return Math.min(99, Math.round((finished / total) * 100));
}
