import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { recordAudit } from "@/lib/audit/log";
import { LESSON_SECTIONS, type LessonSection, type LessonSectionContent } from "@/lib/types";
import { slugify, validateSlug, type CategoryDraft, type LessonDraft } from "./validate.ts";

/**
 * Authoring writes for the training catalogue.
 *
 * One rule governs this whole module: **a category or lesson id is never
 * changed once created.** Those ids are foreign keys — every learner's
 * progress document keys its section states by them, and certificates are
 * issued against them. Renaming an id would not error; it would silently
 * strand every existing progress record at a path nothing reads any more, and
 * a compliance report would then show trained personnel as having never
 * started. So a title edit updates the title and leaves the id alone, and the
 * id is generated exactly once, at creation.
 *
 * Deletion is deliberately absent for the same reason. Unpublishing takes
 * content out of circulation while leaving the records that reference it
 * intact, which is what a training-compliance system needs. A hard delete
 * would be the only irreversible action in the admin surface.
 */

export type AuthoringOutcome = { ok: true; id: string } | { ok: false; error: string };

// ------------------------------------------------------------------ categories

export async function createCategory(args: {
  actorUid: string;
  draft: CategoryDraft;
}): Promise<AuthoringOutcome> {
  const { actorUid, draft } = args;

  const slugCheck = validateSlug(slugify(draft.title));
  if (!slugCheck.ok) return { ok: false, error: slugCheck.error };
  const id = slugCheck.value;

  const db = getAdminDb();
  const ref = db.collection("categories").doc(id);

  if ((await ref.get()).exists) {
    // Deliberately not auto-suffixed to "-2": an id nobody chose, differing
    // from a sibling by one character, is a trap for whoever maintains this.
    return { ok: false, error: `A category with the identifier "${id}" already exists.` };
  }

  await ref.set({
    title: draft.title,
    description: draft.description,
    order: await nextOrder(db.collection("categories")),
    theme: id,
    iconPath: null,
    heroImagePath: null,
    published: draft.published,
  });

  await recordAudit({
    uid: actorUid,
    action: "content_created",
    targetPath: `categories/${id}`,
    detail: { title: draft.title, published: draft.published },
  });

  return { ok: true, id };
}

export async function updateCategory(args: {
  actorUid: string;
  categoryId: string;
  draft: CategoryDraft;
}): Promise<AuthoringOutcome> {
  const { actorUid, categoryId, draft } = args;
  const ref = getAdminDb().collection("categories").doc(categoryId);

  if (!(await ref.get()).exists) return { ok: false, error: "That category no longer exists." };

  // Note what is absent: the id. Only the fields below are writable.
  await ref.set(
    { title: draft.title, description: draft.description, published: draft.published },
    { merge: true },
  );

  await recordAudit({
    uid: actorUid,
    action: "content_updated",
    targetPath: `categories/${categoryId}`,
    detail: { title: draft.title, published: draft.published },
  });

  return { ok: true, id: categoryId };
}

// --------------------------------------------------------------------- lessons

export async function createLesson(args: {
  actorUid: string;
  categoryId: string;
  draft: LessonDraft;
}): Promise<AuthoringOutcome> {
  const { actorUid, categoryId, draft } = args;

  const slugCheck = validateSlug(slugify(draft.title));
  if (!slugCheck.ok) return { ok: false, error: slugCheck.error };
  const id = slugCheck.value;

  const db = getAdminDb();
  const lessons = db.collection("categories").doc(categoryId).collection("lessons");
  const ref = lessons.doc(id);

  if (!(await db.collection("categories").doc(categoryId).get()).exists) {
    return { ok: false, error: "That category no longer exists." };
  }
  if ((await ref.get()).exists) {
    return { ok: false, error: `A lesson with the identifier "${id}" already exists here.` };
  }

  await ref.set({
    title: draft.title,
    order: await nextOrder(lessons),
    heroImagePath: null,
    published: draft.published,
  });

  // Create the three sections up front so the editor always has all three to
  // open, matching the design's fixed Discussion / Resources / Assessment tabs.
  const batch = db.batch();
  for (const section of LESSON_SECTIONS) {
    batch.set(ref.collection("sections").doc(section), {
      body: "",
      attachments: [],
      videoPath: null,
      updatedAt: null,
    });
  }
  await batch.commit();

  await recordAudit({
    uid: actorUid,
    action: "content_created",
    targetPath: `categories/${categoryId}/lessons/${id}`,
    detail: { title: draft.title, published: draft.published },
  });

  return { ok: true, id };
}

export async function updateLesson(args: {
  actorUid: string;
  categoryId: string;
  lessonId: string;
  draft: LessonDraft;
}): Promise<AuthoringOutcome> {
  const { actorUid, categoryId, lessonId, draft } = args;

  const ref = getAdminDb()
    .collection("categories")
    .doc(categoryId)
    .collection("lessons")
    .doc(lessonId);

  if (!(await ref.get()).exists) return { ok: false, error: "That lesson no longer exists." };

  await ref.set({ title: draft.title, published: draft.published }, { merge: true });

  await recordAudit({
    uid: actorUid,
    action: "content_updated",
    targetPath: `categories/${categoryId}/lessons/${lessonId}`,
    detail: { title: draft.title, published: draft.published },
  });

  return { ok: true, id: lessonId };
}

// -------------------------------------------------------------------- sections

export async function getSection(
  categoryId: string,
  lessonId: string,
  sectionId: LessonSection,
): Promise<LessonSectionContent | null> {
  const snapshot = await getAdminDb()
    .collection("categories")
    .doc(categoryId)
    .collection("lessons")
    .doc(lessonId)
    .collection("sections")
    .doc(sectionId)
    .get();

  if (!snapshot.exists) return null;
  return { id: sectionId, ...snapshot.data() } as LessonSectionContent;
}

export async function saveSection(args: {
  actorUid: string;
  categoryId: string;
  lessonId: string;
  sectionId: LessonSection;
  body: string;
}): Promise<AuthoringOutcome> {
  const { actorUid, categoryId, lessonId, sectionId, body } = args;

  const lessonRef = getAdminDb()
    .collection("categories")
    .doc(categoryId)
    .collection("lessons")
    .doc(lessonId);

  if (!(await lessonRef.get()).exists) return { ok: false, error: "That lesson no longer exists." };

  await lessonRef
    .collection("sections")
    .doc(sectionId)
    .set({ body, updatedAt: new Date().toISOString() }, { merge: true });

  await recordAudit({
    uid: actorUid,
    action: "content_updated",
    targetPath: `categories/${categoryId}/lessons/${lessonId}/sections/${sectionId}`,
    // The body itself is not copied into the audit entry: it can be 50,000
    // characters, and the log is for who-changed-what, not version history.
    detail: { characters: body.length },
  });

  return { ok: true, id: sectionId };
}

// --------------------------------------------------------------------- helpers

/** Appends to the end of the running order. */
async function nextOrder(
  collection: FirebaseFirestore.CollectionReference,
): Promise<number> {
  const snapshot = await collection.orderBy("order", "desc").limit(1).get();
  if (snapshot.empty) return 1;
  return (snapshot.docs[0].data().order ?? 0) + 1;
}
