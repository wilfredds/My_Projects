import "server-only";
import { getStorage } from "firebase-admin/storage";
import { getAdminDb } from "@/lib/firebase/admin";
import { recordAudit } from "@/lib/audit/log";
import { safeFileName } from "./attachments.ts";
import type { Attachment, LessonSection, LessonVideo } from "@/lib/types";

/**
 * Recording what was uploaded, and removing it again.
 *
 * The file itself goes browser → Storage directly; this module owns the
 * Firestore record that points at it. The order matters and is deliberate:
 *
 *   uploading  — the file is stored first, then recorded. If the record fails
 *                the result is an orphaned object, which costs a little
 *                storage and nothing else.
 *   removing   — the record is cleared first, then the file deleted. If the
 *                delete fails the result is the same harmless orphan.
 *
 * The reverse order in either case would leave a Firestore record pointing at
 * a file that does not exist, which every learner would meet as a broken
 * download. An orphan nobody can see is the better failure.
 */

function lessonRef(categoryId: string, lessonId: string) {
  return getAdminDb()
    .collection("categories")
    .doc(categoryId)
    .collection("lessons")
    .doc(lessonId);
}

function sectionRef(categoryId: string, lessonId: string, sectionId: LessonSection) {
  return lessonRef(categoryId, lessonId).collection("sections").doc(sectionId);
}

/**
 * The lesson is what has to exist; the section document does not.
 *
 * Every lesson has exactly the same three sections — the design's fixed
 * Discussion / Resources / Assessment tabs — so they are implied structure
 * rather than something that must be provisioned first. createLesson() writes
 * them up front for convenience, but a lesson that predates that (seeded
 * data, an import) is still a real lesson, and refusing to attach a file to
 * it because a placeholder document is missing would be a distinction without
 * a difference. Writes below use merge, which creates the section if needed.
 */
async function lessonExists(categoryId: string, lessonId: string): Promise<boolean> {
  return (await lessonRef(categoryId, lessonId).get()).exists;
}

export type MediaOutcome = { ok: true } | { ok: false; error: string };

export async function recordAttachment(args: {
  actorUid: string;
  categoryId: string;
  lessonId: string;
  sectionId: LessonSection;
  attachment: Omit<Attachment, "uploadedAt" | "name"> & { name: string };
}): Promise<MediaOutcome> {
  const { actorUid, categoryId, lessonId, sectionId, attachment } = args;

  if (!(await lessonExists(categoryId, lessonId))) {
    return { ok: false, error: "That lesson no longer exists." };
  }
  const ref = sectionRef(categoryId, lessonId, sectionId);

  const stored: Attachment = {
    ...attachment,
    // Sanitised again server-side: the browser already did this, but the
    // browser is not what makes it true.
    name: safeFileName(attachment.name),
    uploadedAt: new Date().toISOString(),
  };

  const existing = await readAttachments(ref);
  await ref.set({ attachments: [...existing, stored] }, { merge: true });

  await recordAudit({
    uid: actorUid,
    action: "content_updated",
    targetPath: `categories/${categoryId}/lessons/${lessonId}/sections/${sectionId}`,
    detail: { change: "attachment_added", file: stored.name, bytes: stored.sizeBytes },
  });

  return { ok: true };
}

export async function removeAttachment(args: {
  actorUid: string;
  categoryId: string;
  lessonId: string;
  sectionId: LessonSection;
  attachmentId: string;
}): Promise<MediaOutcome> {
  const { actorUid, categoryId, lessonId, sectionId, attachmentId } = args;

  const ref = sectionRef(categoryId, lessonId, sectionId);
  const existing = await readAttachments(ref);
  const target = existing.find((entry) => entry.id === attachmentId);
  if (!target) return { ok: false, error: "That file has already been removed." };

  await ref.set(
    { attachments: existing.filter((entry) => entry.id !== attachmentId) },
    { merge: true },
  );

  await deleteObject(target.storagePath);

  await recordAudit({
    uid: actorUid,
    action: "content_updated",
    targetPath: `categories/${categoryId}/lessons/${lessonId}/sections/${sectionId}`,
    detail: { change: "attachment_removed", file: target.name },
  });

  return { ok: true };
}

export async function setVideo(args: {
  actorUid: string;
  categoryId: string;
  lessonId: string;
  sectionId: LessonSection;
  video: LessonVideo | null;
}): Promise<MediaOutcome> {
  const { actorUid, categoryId, lessonId, sectionId, video } = args;

  if (!(await lessonExists(categoryId, lessonId))) {
    return { ok: false, error: "That lesson no longer exists." };
  }
  const ref = sectionRef(categoryId, lessonId, sectionId);
  const previous = ((await ref.get()).data()?.video ?? null) as LessonVideo | null;

  await ref.set({ video }, { merge: true });

  // Replacing or clearing an uploaded video removes the file it displaced,
  // so a re-upload does not quietly accumulate hundreds of megabytes per edit.
  if (previous?.kind === "upload" && previous.storagePath !== (video as { storagePath?: string } | null)?.storagePath) {
    await deleteObject(previous.storagePath);
  }

  await recordAudit({
    uid: actorUid,
    action: "content_updated",
    targetPath: `categories/${categoryId}/lessons/${lessonId}/sections/${sectionId}`,
    detail: { change: video ? `video_set_${video.kind}` : "video_cleared" },
  });

  return { ok: true };
}

async function readAttachments(
  ref: FirebaseFirestore.DocumentReference,
): Promise<Attachment[]> {
  const snapshot = await ref.get();
  return (snapshot.data()?.attachments ?? []) as Attachment[];
}

/**
 * Best effort. A file that outlives its record is invisible clutter; failing
 * the administrator's request over it would be the worse outcome.
 */
async function deleteObject(storagePath: string): Promise<void> {
  try {
    await getStorage().bucket().file(storagePath).delete({ ignoreNotFound: true });
  } catch (error) {
    console.error("[media] could not delete", storagePath, error);
  }
}
