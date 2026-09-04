import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { recordAudit } from "@/lib/audit/log";
import { summarizeCategory } from "./rollup.ts";
import type { SelfReportableSection } from "./sections.ts";
import type { CategoryProgress, CategorySummary, SectionState } from "@/lib/types";

/**
 * Progress reads and writes.
 *
 * Every write lands here rather than in the browser, because `progress` is
 * closed to clients in firestore.rules. Two reasons:
 *
 *   - Certificates are issued from these records for a government training
 *     programme, so a learner must not be able to declare their own results.
 *   - The Privacy Notice promises a record of course participation and
 *     completion, which means each change has to be auditable.
 *
 * The section a learner may self-report and the section a grader sets are
 * split into two functions rather than one function with a flag. The
 * constraint is then structural: there is no code path that lets a
 * self-reported call touch the assessment state, so it cannot be forgotten
 * at a future call site.
 */

function progressRef(uid: string, categoryId: string) {
  return getAdminDb().collection("users").doc(uid).collection("progress").doc(categoryId);
}

export async function getCategoryProgress(
  uid: string,
  categoryId: string,
): Promise<CategoryProgress | null> {
  const snapshot = await progressRef(uid, categoryId).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data() ?? {};
  return { lessons: data.lessons ?? {}, updatedAt: data.updatedAt ?? null };
}

export async function summarize(
  uid: string,
  categoryId: string,
  lessonIds: readonly string[],
): Promise<CategorySummary> {
  return summarizeCategory(lessonIds, await getCategoryProgress(uid, categoryId));
}

/**
 * Records the learner ticking Discussion or Resources.
 *
 * Cannot reach the assessment state: the parameter type does not admit it.
 */
export async function markSelfReportedSection(args: {
  uid: string;
  categoryId: string;
  lessonId: string;
  section: SelfReportableSection;
  state: SectionState;
  request?: Request;
}): Promise<void> {
  const { uid, categoryId, lessonId, section, state, request } = args;

  await writeSectionState(uid, categoryId, lessonId, section, state);

  await recordAudit(
    {
      uid,
      action: "section_completed",
      targetPath: `categories/${categoryId}/lessons/${lessonId}/sections/${section}`,
      detail: { state },
    },
    request,
  );
}

/**
 * Records the outcome of a graded assessment.
 *
 * Called by the grading path only — never in response to a learner simply
 * saying they are finished.
 */
export async function recordAssessmentOutcome(args: {
  uid: string;
  categoryId: string;
  lessonId: string;
  passed: boolean;
  request?: Request;
}): Promise<void> {
  const { uid, categoryId, lessonId, passed, request } = args;

  await writeSectionState(
    uid,
    categoryId,
    lessonId,
    "assessment",
    passed ? "finished" : "not_started",
  );

  await recordAudit(
    {
      uid,
      action: "assessment_submitted",
      targetPath: `categories/${categoryId}/lessons/${lessonId}/sections/assessment`,
      detail: { passed },
    },
    request,
  );
}

/**
 * Merges one section's state into the category document.
 *
 * Uses a field path rather than reading, mutating and writing the whole
 * document, so two lessons finished in quick succession cannot overwrite one
 * another's result.
 */
async function writeSectionState(
  uid: string,
  categoryId: string,
  lessonId: string,
  section: string,
  state: SectionState,
): Promise<void> {
  await progressRef(uid, categoryId).set(
    {
      lessons: { [lessonId]: { [section]: state } },
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}
