"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  addCategory,
  addLesson,
  editCategory,
  editLesson,
  saveLessonSection,
} from "@/app/admin/catalog/actions";
import { slugify } from "@/lib/catalog/validate";

/**
 * Authoring forms.
 *
 * Every one of these shows the identifier the title will produce, because an
 * id is permanent: it is the key every learner's progress record uses, so it
 * is generated once and never regenerated when a title is edited. Surfacing
 * it at the moment of creation is the only chance an author has to notice
 * "fire-traning" before thousands of documents point at it.
 */

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, onDone?: () => void) {
    setError(null);
    setSaved(false);
    start(async () => {
      const result = await fn();
      if (result.ok) {
        setSaved(true);
        onDone?.();
      } else {
        setError(result.error ?? "That did not work.");
      }
    });
  }

  return { pending, error, saved, run };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputClass = "rounded border border-border bg-background px-2 py-1.5";

function Submit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

function Status({ error, saved, savedText }: { error: string | null; saved: boolean; savedText: string }) {
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (saved) return <p className="text-sm text-success">{savedText}</p>;
  return null;
}

/** Live preview of the permanent identifier a title will generate. */
function SlugPreview({ title }: { title: string }) {
  const slug = slugify(title);
  return (
    <span className="text-xs text-muted">
      Identifier:{" "}
      <code className="font-mono">{slug || "—"}</code>
      {slug ? " · permanent, cannot be changed later" : ""}
    </span>
  );
}

// ------------------------------------------------------------------ categories

export function NewCategoryForm() {
  const { pending, error, saved, run } = useAction();
  const [title, setTitle] = useState("");

  return (
    <form
      action={(formData) => run(() => addCategory(formData), () => setTitle(""))}
      className="flex flex-col gap-3 p-4"
    >
      <Field label="Title">
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Hazardous Materials"
          className={inputClass}
        />
      </Field>
      <SlugPreview title={title} />

      <Field label="Description">
        <textarea name="description" rows={2} className={inputClass} />
      </Field>

      <PublishCheckbox
        hint="Unpublished categories are hidden from learners and excluded from completion percentages."
      />

      <Status error={error} saved={saved} savedText="Category created." />
      <div>
        <Submit pending={pending}>Create category</Submit>
      </div>
    </form>
  );
}

export function EditCategoryForm({
  categoryId,
  title,
  description,
  published,
}: {
  categoryId: string;
  title: string;
  description: string;
  published: boolean;
}) {
  const { pending, error, saved, run } = useAction();

  return (
    <form
      action={(formData) => run(() => editCategory(categoryId, formData))}
      className="flex flex-col gap-3 p-4"
    >
      <Field label="Title" hint={`Identifier "${categoryId}" stays as it is — learner progress is keyed to it.`}>
        <input name="title" defaultValue={title} className={inputClass} />
      </Field>

      <Field label="Description">
        <textarea name="description" rows={2} defaultValue={description} className={inputClass} />
      </Field>

      <PublishCheckbox defaultChecked={published} />

      <Status error={error} saved={saved} savedText="Saved." />
      <div>
        <Submit pending={pending}>Save category</Submit>
      </div>
    </form>
  );
}

// --------------------------------------------------------------------- lessons

export function NewLessonForm({ categoryId }: { categoryId: string }) {
  const { pending, error, saved, run } = useAction();
  const [title, setTitle] = useState("");

  return (
    <form
      action={(formData) => run(() => addLesson(categoryId, formData), () => setTitle(""))}
      className="flex flex-col gap-3 p-4"
    >
      <Field label="Title">
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Lesson 3"
          className={inputClass}
        />
      </Field>
      <SlugPreview title={title} />

      <PublishCheckbox hint="Discussion, Resources and Assessment are created empty and can be written straight away." />

      <Status error={error} saved={saved} savedText="Lesson created." />
      <div>
        <Submit pending={pending}>Create lesson</Submit>
      </div>
    </form>
  );
}

export function EditLessonForm({
  categoryId,
  lessonId,
  title,
  published,
}: {
  categoryId: string;
  lessonId: string;
  title: string;
  published: boolean;
}) {
  const { pending, error, saved, run } = useAction();

  return (
    <form
      action={(formData) => run(() => editLesson(categoryId, lessonId, formData))}
      className="flex flex-wrap items-end gap-3 p-4"
    >
      <div className="min-w-56 flex-1">
        <Field label="Title" hint={`Identifier "${lessonId}" is permanent.`}>
          <input name="title" defaultValue={title} className={`${inputClass} w-full`} />
        </Field>
      </div>

      <PublishCheckbox defaultChecked={published} />
      <Submit pending={pending}>Save</Submit>
      <Status error={error} saved={saved} savedText="Saved." />
    </form>
  );
}

// -------------------------------------------------------------------- sections

export function SectionEditor({
  categoryId,
  lessonId,
  sectionId,
  body,
}: {
  categoryId: string;
  lessonId: string;
  sectionId: string;
  body: string;
}) {
  const { pending, error, saved, run } = useAction();
  const [value, setValue] = useState(body);

  return (
    <form
      action={(formData) => run(() => saveLessonSection(categoryId, lessonId, sectionId, formData))}
      className="flex flex-col gap-2 p-4"
    >
      <textarea
        name="body"
        rows={14}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Write in Markdown. Headings with ##, lists with -, links with [text](url)."
        className={`${inputClass} font-mono text-sm`}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Submit pending={pending}>Save section</Submit>
        <span className="text-xs tabular-nums text-muted">{value.length.toLocaleString()} characters</span>
        <Status error={error} saved={saved} savedText="Saved." />
      </div>
    </form>
  );
}

function PublishCheckbox({ defaultChecked = false, hint }: { defaultChecked?: boolean; hint?: string }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={defaultChecked} />
        <span className="font-medium">Published</span>
      </label>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
