"use client";

import { useRef, useState, useTransition } from "react";
import { ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import {
  attachFile,
  clearVideo,
  detachFile,
  setEmbeddedVideo,
  setUploadedVideo,
} from "@/app/admin/catalog/media-actions";
import {
  ALLOWED_CONTENT_TYPES,
  ALLOWED_VIDEO_TYPES,
  checkAttachment,
  checkVideoFile,
  formatBytes,
  safeFileName,
  storagePathFor,
} from "@/lib/media/attachments";
import type { Attachment, LessonSection, LessonVideo } from "@/lib/types";

/**
 * Uploading files and setting a lesson's video.
 *
 * The file goes browser → Storage directly, because a 500 MB video cannot pass
 * through a serverless function. storage.rules authorizes that write; the
 * server action afterwards only records what landed.
 *
 * Order matters: store the file, then record it. The reverse would leave a
 * record pointing at a file that does not exist, which every learner meets as
 * a broken download. An orphaned object nobody can see is the better failure.
 */

const inputClass = "rounded border border-border bg-background px-2 py-1.5";

function newFileId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function MediaManager({
  categoryId,
  lessonId,
  sectionId,
  attachments,
  video,
}: {
  categoryId: string;
  lessonId: string;
  sectionId: LessonSection;
  attachments: Attachment[];
  video: LessonVideo | null;
}) {
  return (
    <div className="flex flex-col gap-5 border-t border-border px-4 py-4">
      <Attachments
        categoryId={categoryId}
        lessonId={lessonId}
        sectionId={sectionId}
        attachments={attachments}
      />
      <VideoPanel
        categoryId={categoryId}
        lessonId={lessonId}
        sectionId={sectionId}
        video={video}
      />
    </div>
  );
}

function Attachments({
  categoryId,
  lessonId,
  sectionId,
  attachments,
}: {
  categoryId: string;
  lessonId: string;
  sectionId: LessonSection;
  attachments: Attachment[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);

    const check = checkAttachment(file);
    if (!check.ok) {
      setError(check.error);
      return;
    }

    setBusy(true);
    try {
      const fileId = newFileId();
      const path = storagePathFor({ categoryId, lessonId, sectionId, fileId });

      await uploadBytes(ref(storage, path), file, { contentType: file.type });

      const recorded = await attachFile({
        categoryId,
        lessonId,
        sectionId,
        fileId,
        name: safeFileName(file.name),
        sizeBytes: file.size,
        contentType: file.type,
      });
      if (!recorded.ok) setError(recorded.error);
      else if (fileInput.current) fileInput.current.value = "";
    } catch {
      setError("The upload did not finish. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function remove(attachmentId: string) {
    setError(null);
    startTransition(async () => {
      const result = await detachFile({ categoryId, lessonId, sectionId, attachmentId });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Attachments</h3>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted">No files attached.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {attachments.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-border px-3 py-1.5 text-sm"
            >
              <span className="font-medium">{file.name}</span>
              <span className="text-xs tabular-nums text-muted">{formatBytes(file.sizeBytes)}</span>
              <span className="text-xs text-muted">
                {ALLOWED_CONTENT_TYPES[file.contentType] ?? file.contentType}
              </span>
              <button
                type="button"
                onClick={() => remove(file.id)}
                disabled={pending}
                className="ml-auto rounded border border-border px-2 py-0.5 text-xs hover:border-danger hover:text-danger disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={Object.keys(ALLOWED_CONTENT_TYPES).join(",")}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
          className="text-sm"
        />
        {busy && <span className="text-xs text-muted">Uploading…</span>}
      </div>

      <p className="text-xs text-muted">
        PDF, images, Word, Excel, PowerPoint, text and CSV, up to 25 MB. Executables, HTML and
        SVG are refused — these files are served to every firefighter.
      </p>

      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}

function VideoPanel({
  categoryId,
  lessonId,
  sectionId,
  video,
}: {
  categoryId: string;
  lessonId: string;
  sectionId: LessonSection;
  video: LessonVideo | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();

  async function uploadVideo(file: File) {
    setError(null);

    const check = checkVideoFile(file);
    if (!check.ok) {
      setError(check.error);
      return;
    }

    setBusy(true);
    try {
      const fileId = newFileId();
      await uploadBytes(
        ref(storage, storagePathFor({ categoryId, lessonId, sectionId, fileId })),
        file,
        { contentType: file.type },
      );

      const recorded = await setUploadedVideo({
        categoryId,
        lessonId,
        sectionId,
        fileId,
        name: safeFileName(file.name),
        sizeBytes: file.size,
        contentType: file.type,
      });
      if (!recorded.ok) setError(recorded.error);
    } catch {
      setError("The upload did not finish. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function embed() {
    setError(null);
    startTransition(async () => {
      const result = await setEmbeddedVideo({ categoryId, lessonId, sectionId, url });
      if (result.ok) setUrl("");
      else setError(result.error);
    });
  }

  function clear() {
    setError(null);
    startTransition(async () => {
      const result = await clearVideo({ categoryId, lessonId, sectionId });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Video</h3>

      {video ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-border px-3 py-1.5 text-sm">
          {video.kind === "upload" ? (
            <>
              <span className="font-medium">{video.name}</span>
              <span className="text-xs tabular-nums text-muted">{formatBytes(video.sizeBytes)}</span>
              <span className="text-xs text-muted">Hosted on Firebase Storage</span>
            </>
          ) : (
            <>
              <span className="font-medium capitalize">{video.provider}</span>
              <span className="truncate text-xs text-muted">{video.embedUrl}</span>
            </>
          )}
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className="ml-auto rounded border border-border px-2 py-0.5 text-xs hover:border-danger hover:text-danger disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">No video set.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">Embed a link</span>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://vimeo.com/123456789"
              className={`${inputClass} min-w-0 flex-1 text-sm`}
            />
            <button
              type="button"
              onClick={embed}
              disabled={pending || !url.trim()}
              className="rounded border border-border px-2.5 py-1 text-xs font-medium disabled:opacity-50"
            >
              Set
            </button>
          </div>
          <span className="text-xs text-muted">
            YouTube or Vimeo. Embedded privately — no advertising cookies until the learner plays it.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">Or upload a file</span>
          <input
            type="file"
            accept={Object.keys(ALLOWED_VIDEO_TYPES).join(",")}
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadVideo(file);
            }}
            className="text-sm"
          />
          <span className="text-xs text-muted">
            MP4 or WebM, up to 500 MB. Hosting costs bandwidth on every view; embedding does not.
          </span>
          {busy && <span className="text-xs text-muted">Uploading…</span>}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
