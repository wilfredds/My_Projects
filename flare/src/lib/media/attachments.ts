// Rules for what may be attached to a lesson section, and where it is stored.
//
// Pure and dependency-free so `node --test` runs it directly, and so the same
// rules apply on both sides of the upload: the browser checks before starting,
// the server checks before recording, and storage.rules checks independently
// of both.
import type { LessonSection } from "../types.ts";

/**
 * What an author may attach.
 *
 * An allowlist, not a blocklist. The design shows a download icon on every
 * section, so these files go to firefighters as downloads — and a training
 * portal that will serve any file type is a convenient way to distribute
 * anything. Everything here opens in ordinary office software; nothing here
 * executes, and SVG is deliberately absent because it can carry script.
 */
export const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG image",
  "image/jpeg": "JPEG image",
  "image/webp": "WebP image",
  "text/plain": "Text file",
  "text/csv": "CSV",
  "application/msword": "Word document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
  "application/vnd.ms-excel": "Excel workbook",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel workbook",
  "application/vnd.ms-powerpoint": "PowerPoint deck",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint deck",
};

export const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "MP4 video",
  "video/webm": "WebM video",
};

/** 25 MB for documents. Generous for a manual, far short of a video. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** 500 MB for an uploaded video. Storage egress is billed — see the README. */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

export const MAX_FILENAME_LENGTH = 120;

/** Control characters and DEL, as escapes: they are invisible in source. */
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;

export type FileCheck = { ok: true } | { ok: false; error: string };

export function checkAttachment(file: { name: string; size: number; type: string }): FileCheck {
  if (!ALLOWED_CONTENT_TYPES[file.type]) {
    return {
      ok: false,
      error: `${describeType(file.type)} cannot be attached. Allowed: ${listAllowed(ALLOWED_CONTENT_TYPES)}.`,
    };
  }
  return checkCommon(file, MAX_ATTACHMENT_BYTES);
}

export function checkVideoFile(file: { name: string; size: number; type: string }): FileCheck {
  if (!ALLOWED_VIDEO_TYPES[file.type]) {
    return { ok: false, error: `${describeType(file.type)} cannot be uploaded. Use MP4 or WebM.` };
  }
  return checkCommon(file, MAX_VIDEO_BYTES);
}

function checkCommon(file: { name: string; size: number }, limit: number): FileCheck {
  if (!file.name.trim()) return { ok: false, error: "That file has no name." };
  if (file.size <= 0) return { ok: false, error: "That file is empty." };
  if (file.size > limit) {
    return { ok: false, error: `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(limit)}.` };
  }
  return { ok: true };
}

/**
 * A display name safe to echo into a page and a download attribute.
 *
 * Path separators and control characters are removed rather than escaped:
 * this value is only ever a label, never a path — the stored location comes
 * from storagePathFor() below, which the author does not influence. A newline
 * in a filename would break a Content-Disposition header, which is why the
 * control characters go too.
 */
export function safeFileName(name: string): string {
  const cleaned = name
    .replace(CONTROL_CHARACTERS, "")
    .replaceAll("\\", "/")
    .split("/")
    .pop()!
    .trim();

  if (!cleaned || cleaned === "." || cleaned === "..") return "file";
  return cleaned.slice(0, MAX_FILENAME_LENGTH);
}

/**
 * Where a file lives in Storage.
 *
 * Built entirely from ids the server already trusts plus a generated id — no
 * part of it comes from the uploaded filename. That is what lets
 * storage.rules gate writes by path prefix, and it means a file called
 * "../../secret.pdf" is stored as an ordinary object rather than escaping
 * its folder.
 */
export function storagePathFor(args: {
  categoryId: string;
  lessonId: string;
  sectionId: LessonSection;
  fileId: string;
}): string {
  const { categoryId, lessonId, sectionId, fileId } = args;
  return `catalog/${categoryId}/${lessonId}/${sectionId}/${fileId}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function describeType(type: string): string {
  return type ? `Files of type ${type}` : "Files with no type";
}

function listAllowed(types: Record<string, string>): string {
  return [...new Set(Object.values(types))].join(", ");
}
