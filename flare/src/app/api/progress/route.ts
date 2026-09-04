import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/users/profile";
import { listPublishedLessonIds } from "@/lib/catalog/queries";
import { markSelfReportedSection, summarize } from "@/lib/progress/store";
import { parseProgressRequest } from "@/lib/progress/request";

/**
 * The endpoint behind the lesson screen's "Not Started / Finished" toggle.
 *
 * Progress is closed to clients in firestore.rules, so this is the only way a
 * learner's record changes — which is what makes it auditable, and what stops
 * an assessment being marked complete without being taken.
 */
export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if (!auth.ok) {
    // "pending" is a distinct case worth telling the user about: their
    // account exists and is waiting on an administrator, which is not the
    // same as being signed out.
    const status = auth.reason === "signed_out" ? 401 : 403;
    return NextResponse.json({ error: auth.reason }, { status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseProgressRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { categoryId, lessonId, section, state } = parsed.value;

  // Reject a lesson that isn't actually published in this category, rather
  // than writing progress against a path that does not exist.
  const lessonIds = await listPublishedLessonIds(categoryId);
  if (!lessonIds.includes(lessonId)) {
    return NextResponse.json({ error: "unknown_lesson" }, { status: 404 });
  }

  await markSelfReportedSection({
    uid: auth.profile.uid,
    categoryId,
    lessonId,
    section,
    state,
    request,
  });

  // Hand back the recomputed summary so the Home card and the category
  // progress bar update from the server's arithmetic, not the browser's.
  const summary = await summarize(auth.profile.uid, categoryId, lessonIds);
  return NextResponse.json({ ok: true, summary });
}
