import { Shell } from "@/components/site/shell";
import { Markdown } from "@/components/site/markdown";
import { ABOUT_SECTIONS } from "@/lib/legal/content";

/**
 * About us, Privacy and Terms — the "A.P.T" screen.
 *
 * Public: the design reaches it from the footer of every screen, including
 * before sign-in, and a privacy notice nobody can read without an account
 * would defeat its purpose.
 *
 * The text lives in src/lib/legal/content.ts rather than Firestore. It is the
 * client's own wording, carried over from the design frames, and it changes
 * on legal review rather than through an editor — keeping it in the
 * repository means changes are reviewed and versioned like any other change.
 */
export default function AboutPage() {
  return (
    <Shell active="settings" back="/settings">
      <section className="mx-auto max-w-3xl px-5 py-8">
        <div className="flex flex-col gap-6">
          {ABOUT_SECTIONS.map((section) => (
            <article
              key={section.id}
              id={section.id}
              className="overflow-hidden rounded-2xl border border-border bg-surface scroll-mt-20"
            >
              <h2 className="flare-label bg-[image:var(--grad-cta)] px-4 py-2.5 text-sm text-white">
                {section.title}
              </h2>
              <div className="px-4 py-4">
                <Markdown>{section.body}</Markdown>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-6 text-xs text-muted">
          Effective dates and the Data Protection Officer&rsquo;s contact details are marked
          below and still need to be supplied by the Bureau before launch.
        </p>
      </section>
    </Shell>
  );
}
