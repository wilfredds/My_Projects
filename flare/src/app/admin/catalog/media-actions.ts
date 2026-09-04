"use server";

import { revalidatePath } from "next/cache";
import { withAdmin, type ActionResult } from "@/lib/admin/guard";
import { isLessonSection } from "@/lib/catalog/validate";
import { recordAttachment, removeAttachment, setVideo } from "@/lib/media/store";
import { parseVideoUrl } from "@/lib/media/video";
import {
  ALLOWED_CONTENT_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_VIDEO_BYTES,
  storagePathFor,
} from "@/lib/media/attachments";

/**
 * Recording uploads, once the browser has put the file in Storage.
 *
 * These re-check everything the browser checked. That is not belt-and-braces
 * duplication: the browser's checks decide what the UI offers, and these
 * decide what is true. A caller invoking this action directly — which anyone
 * can, it is a public endpoint — never touched the browser's copy.
 *
 * The storage path is rebuilt here from the ids rather than accepted from the
 * caller, so a client cannot point a lesson's attachment record at some other
 * lesson's file, or at a path outside catalog/.
 */

export async function attachFile(input: {
  categoryId: string;
  lessonId: string;
  sectionId: string;
  fileId: string;
  name: string;
  sizeBytes: number;
  contentType: string;
}): Promise<ActionResult> {
  return withAdmin(async (admin) => {
    const { categoryId, lessonId, sectionId, fileId, name, sizeBytes, contentType } = input;

    if (!isLessonSection(sectionId)) return { ok: false, error: "Unknown section." };
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(fileId)) return { ok: false, error: "Bad file identifier." };
    if (!ALLOWED_CONTENT_TYPES[contentType]) {
      return { ok: false, error: "That file type cannot be attached." };
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: "That file is too large." };
    }

    const result = await recordAttachment({
      actorUid: admin.uid,
      categoryId,
      lessonId,
      sectionId,
      attachment: {
        id: fileId,
        name,
        // Rebuilt, never taken from the caller.
        storagePath: storagePathFor({ categoryId, lessonId, sectionId, fileId }),
        sizeBytes,
        contentType,
      },
    });
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath(`/admin/catalog/${categoryId}/${lessonId}`);
    return { ok: true };
  });
}

export async function detachFile(input: {
  categoryId: string;
  lessonId: string;
  sectionId: string;
  attachmentId: string;
}): Promise<ActionResult> {
  return withAdmin(async (admin) => {
    const { categoryId, lessonId, sectionId, attachmentId } = input;
    if (!isLessonSection(sectionId)) return { ok: false, error: "Unknown section." };

    const result = await removeAttachment({
      actorUid: admin.uid,
      categoryId,
      lessonId,
      sectionId,
      attachmentId,
    });
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath(`/admin/catalog/${categoryId}/${lessonId}`);
    return { ok: true };
  });
}

/** Points the section at an uploaded video file. */
export async function setUploadedVideo(input: {
  categoryId: string;
  lessonId: string;
  sectionId: string;
  fileId: string;
  name: string;
  sizeBytes: number;
  contentType: string;
}): Promise<ActionResult> {
  return withAdmin(async (admin) => {
    const { categoryId, lessonId, sectionId, fileId, name, sizeBytes, contentType } = input;

    if (!isLessonSection(sectionId)) return { ok: false, error: "Unknown section." };
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(fileId)) return { ok: false, error: "Bad file identifier." };
    if (!ALLOWED_VIDEO_TYPES[contentType]) return { ok: false, error: "Use an MP4 or WebM file." };
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_VIDEO_BYTES) {
      return { ok: false, error: "That video is too large." };
    }

    const result = await setVideo({
      actorUid: admin.uid,
      categoryId,
      lessonId,
      sectionId,
      video: {
        kind: "upload",
        storagePath: storagePathFor({ categoryId, lessonId, sectionId, fileId }),
        name,
        sizeBytes,
      },
    });
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath(`/admin/catalog/${categoryId}/${lessonId}`);
    return { ok: true };
  });
}

/** Points the section at a YouTube or Vimeo link. */
export async function setEmbeddedVideo(input: {
  categoryId: string;
  lessonId: string;
  sectionId: string;
  url: string;
}): Promise<ActionResult> {
  return withAdmin(async (admin) => {
    const { categoryId, lessonId, sectionId, url } = input;
    if (!isLessonSection(sectionId)) return { ok: false, error: "Unknown section." };

    // The canonical embed URL is rebuilt here, not taken from the browser —
    // this value ends up as an iframe src.
    const parsed = parseVideoUrl(url);
    if (!parsed.ok) return { ok: false, error: parsed.error };

    const result = await setVideo({
      actorUid: admin.uid,
      categoryId,
      lessonId,
      sectionId,
      video: parsed.value,
    });
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath(`/admin/catalog/${categoryId}/${lessonId}`);
    return { ok: true };
  });
}

export async function clearVideo(input: {
  categoryId: string;
  lessonId: string;
  sectionId: string;
}): Promise<ActionResult> {
  return withAdmin(async (admin) => {
    const { categoryId, lessonId, sectionId } = input;
    if (!isLessonSection(sectionId)) return { ok: false, error: "Unknown section." };

    const result = await setVideo({
      actorUid: admin.uid,
      categoryId,
      lessonId,
      sectionId,
      video: null,
    });
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath(`/admin/catalog/${categoryId}/${lessonId}`);
    return { ok: true };
  });
}
