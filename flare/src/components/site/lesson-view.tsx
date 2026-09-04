"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Markdown } from "./markdown";
import { LESSON_SECTIONS, type LessonSection, type LessonSectionContent, type SectionState } from "@/lib/types";

/**
 * The lesson screen: three sections reachable both as tabs and as stacked
 * panels, each with its own Not Started / Finished control, exactly as drawn.
 *
 * The completion control writes through /api/progress rather than to
 * Firestore. That is what keeps an assessment from being marked complete
 * without being taken, and what puts the event in the audit log.
 */

const LABELS: Record<LessonSection, string> = {
  discussion: "Discussion",
  resources: "Resources",
  assessment: "Assessment",
};

export function LessonView({
  categoryId,
  lessonId,
  title,
  gradient,
  sections,
  initialState,
  backHref,
}: {
  categoryId: string;
  lessonId: string;
  title: string;
  gradient: string;
  sections: LessonSectionContent[];
  initialState: Partial<Record<LessonSection, SectionState>>;
  backHref: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<LessonSection>("discussion");
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState<LessonSection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(sections.map((section) => [section.id, section]));
  const allDone = LESSON_SECTIONS.every((id) => state[id] === "finished");

  async function mark(section: LessonSection, next: SectionState) {
    setError(null);
    setBusy(section);
    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, lessonId, section, state: next }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        setError(
          detail.error === "assessment_requires_submission"
            ? "Assessments are marked complete by taking them, not by this button."
            : "That change did not save. Try again.",
        );
        return;
      }
      setState((current) => ({ ...current, [section]: next }));

      // Home, the category page and the profile all render this learner's
      // progress on the server. Without this they keep serving the copy the
      // router cached before the change, so finishing a section and going
      // Home shows the old percentage — which, for a training-compliance
      // record, reads as work that was not saved.
      router.refresh();
    } catch {
      setError("That change did not save. Check your connection.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <section className="relative h-36 overflow-hidden sm:h-44" style={{ backgroundImage: gradient }}>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-5 py-4">
          <h1 className="flare-label text-2xl text-white sm:text-3xl">{title}</h1>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-6">
        {/* Tabs. The panels below are all present regardless — the tabs move
            focus rather than hide content, which matches the design, where
            every section is also reachable by scrolling. */}
        <div role="tablist" aria-label="Lesson sections" className="mb-5 flex overflow-hidden rounded-full border border-border">
          {LESSON_SECTIONS.map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={open === id}
              aria-controls={`panel-${id}`}
              onClick={() => setOpen(id)}
              className={`flex-1 px-3 py-2 text-sm font-semibold transition ${
                open === id ? "bg-[image:var(--grad-cta)] text-white" : "bg-surface text-muted hover:text-foreground"
              }`}
            >
              {LABELS[id]}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-danger/40 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div className="flex flex-col gap-4">
          {LESSON_SECTIONS.map((id) => {
            const content = byId.get(id);
            const finished = state[id] === "finished";

            return (
              <section
                key={id}
                id={`panel-${id}`}
                aria-labelledby={`heading-${id}`}
                className={`overflow-hidden rounded-2xl border transition ${
                  open === id ? "border-accent/50 shadow-sm" : "border-border"
                } bg-surface`}
              >
                <button
                  id={`heading-${id}`}
                  onClick={() => setOpen(open === id ? ("discussion" as LessonSection) : id)}
                  aria-expanded={open === id}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="flare-label rounded-full bg-[image:var(--grad-cta)] px-3 py-1 text-[0.7rem] text-white">
                    {LABELS[id]}
                  </span>
                  {finished && <span className="text-xs font-semibold text-success">Finished</span>}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    className={`ml-auto transition ${open === id ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>

                {open === id && (
                  <div className="flex flex-col gap-4 px-4 pb-4">
                    {content?.body ? (
                      <Markdown>{content.body}</Markdown>
                    ) : (
                      <p className="text-sm text-muted">Nothing has been written here yet.</p>
                    )}

                    {content?.video && <VideoBlock video={content.video} />}

                    {content?.attachments && content.attachments.length > 0 && (
                      <ul className="flex flex-col gap-1.5">
                        {content.attachments.map((file) => (
                          <li
                            key={file.id}
                            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path
                                d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <span className="min-w-0 flex-1 truncate">{file.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {id === "assessment" ? (
                      <p className="rounded-xl border border-border px-3 py-2 text-xs text-muted">
                        Questions are not built yet — they are waiting on whether answers are
                        single- or multiple-choice and what score passes.
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => mark(id, "not_started")}
                          disabled={busy === id}
                          className={`flare-label flex-1 rounded-full px-3 py-1.5 text-[0.7rem] transition disabled:opacity-50 ${
                            finished ? "border border-border text-muted" : "bg-border text-foreground"
                          }`}
                        >
                          Not started
                        </button>
                        <button
                          onClick={() => mark(id, "finished")}
                          disabled={busy === id}
                          className={`flare-label flex-1 rounded-full px-3 py-1.5 text-[0.7rem] transition disabled:opacity-50 ${
                            finished
                              ? "bg-[image:var(--grad-cta)] text-white"
                              : "border border-border text-muted hover:border-accent hover:text-accent"
                          }`}
                        >
                          {busy === id ? "Saving…" : "Finished"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* The design puts BACK at the foot of a completed lesson. */}
        {allDone && (
          <Link
            href={backHref}
            className="flare-label mx-auto mt-6 block w-fit rounded-full bg-[image:var(--grad-cta)] px-8 py-2.5 text-sm text-white shadow"
          >
            Back
          </Link>
        )}
      </div>
    </>
  );
}

function VideoBlock({ video }: { video: NonNullable<LessonSectionContent["video"]> }) {
  if (video.kind === "embed") {
    return (
      <div className="aspect-video overflow-hidden rounded-xl border border-border">
        <iframe
          src={video.embedUrl}
          title="Lesson video"
          allowFullScreen
          // The src was rebuilt from the provider and id server-side, never
          // passed through from what an author typed.
          referrerPolicy="no-referrer"
          className="h-full w-full"
        />
      </div>
    );
  }

  return (
    <p className="rounded-xl border border-border px-3 py-2 text-sm text-muted">
      Video: {video.name} — playback of uploaded files is not wired up yet.
    </p>
  );
}
