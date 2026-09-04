"use client";

import { useState, useTransition } from "react";
import { createAnnouncement } from "@/app/admin/announcements/actions";
import { ANNOUNCEMENT_TYPES } from "@/lib/types";
import { BODY_MAX, TITLE_MAX } from "@/lib/announcements/validate";

const LABELS: Record<string, string> = {
  course_update: "Course update",
  resource: "New resource",
  system: "System announcement",
  assessment_reminder: "Assessment reminder",
};

export function AnnouncementForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  function onSubmit(formData: FormData) {
    setError(null);
    setPublished(false);
    startTransition(async () => {
      const result = await createAnnouncement(formData);
      if (result.ok) setPublished(true);
      else setError(result.error);
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3 p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Kind</span>
        <select
          name="type"
          defaultValue="system"
          className="rounded border border-border bg-background px-2 py-1.5"
        >
          {ANNOUNCEMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {LABELS[type] ?? type}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Title</span>
        <input
          name="title"
          maxLength={TITLE_MAX}
          placeholder="Scheduled system maintenance"
          className="rounded border border-border bg-background px-2 py-1.5"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Message</span>
        <textarea
          name="body"
          rows={4}
          maxLength={BODY_MAX}
          placeholder="FLARE will be unavailable on Sunday from 8:00 PM to 10:00 PM."
          className="rounded border border-border bg-background px-2 py-1.5"
        />
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}
      {published && <p className="text-sm text-success">Published to every active account.</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {pending ? "Publishing…" : "Publish"}
        </button>
      </div>
    </form>
  );
}
