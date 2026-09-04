// Which lesson sections a learner may tick off themselves.
//
// Separated from store.ts so the validation layer can import it without
// pulling in firebase-admin, which would make the unit tests need
// credentials to run.

/** Sections the design lets a learner mark finished on their own say-so. */
export const SELF_REPORTABLE_SECTIONS = ["discussion", "resources"] as const;

export type SelfReportableSection = (typeof SELF_REPORTABLE_SECTIONS)[number];

export function isSelfReportable(value: string): value is SelfReportableSection {
  return (SELF_REPORTABLE_SECTIONS as readonly string[]).includes(value);
}
