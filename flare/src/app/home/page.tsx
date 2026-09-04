import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/users/profile";
import { AccountStatusNotice } from "@/components/account-status";
import { listCategories, listPublishedLessonIds } from "@/lib/catalog/queries";
import { summarize } from "@/lib/progress/store";
import { categoryGradient } from "@/lib/catalog/theme";
import { Shell } from "@/components/site/shell";
import { HeroArtwork } from "@/components/site/artwork";
import type { CategorySummary } from "@/lib/types";

/**
 * Home — the hero and the training-category cards.
 *
 * Every card's state comes from the learner's real progress, derived at read
 * time from the lessons currently published. The design shows three states,
 * and they are the three the rollup produces: ACCESS, a percentage with
 * CONTINUE, and the certificate row.
 */
export default async function HomePage() {
  const auth = await requireActiveUser();
  if (!auth.ok) {
    if (auth.reason === "signed_out") redirect("/sign-in?next=/home");
    return <AccountStatusNotice reason={auth.reason} />;
  }

  const categories = await listCategories();
  const cards = await Promise.all(
    categories.map(async (category) => {
      const lessonIds = await listPublishedLessonIds(category.id);
      return {
        category,
        summary: await summarize(auth.profile.uid, category.id, lessonIds),
      };
    }),
  );

  return (
    <Shell active="home">
      <section className="flare-gradient relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <HeroArtwork />
        </div>
        <div className="relative mx-auto flex max-w-5xl flex-col gap-4 px-5 py-12 sm:py-16">
          <h1 className="max-w-lg text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            Where Knowledge Fuels Firefighters&rsquo; Readiness.
          </h1>
          <Link
            href="#training"
            className="flare-label w-fit rounded-full bg-[image:var(--grad-cta)] px-5 py-2.5 text-sm text-white shadow-lg"
          >
            Let&rsquo;s get started
          </Link>
        </div>
      </section>

      <section id="training" className="mx-auto max-w-5xl px-5 py-8">
        <h2 className="flare-label mb-4 text-sm text-muted">Training</h2>

        {cards.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface px-4 py-6 text-sm text-muted">
            No training categories have been published yet.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ category, summary }) => (
              <li key={category.id}>
                <CategoryCard
                  id={category.id}
                  title={category.title}
                  summary={summary}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

function CategoryCard({
  id,
  title,
  summary,
}: {
  id: string;
  title: string;
  summary: CategorySummary;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <Link
        href={`/training/${id}`}
        className="flex min-h-32 flex-1 flex-col justify-between p-4 text-white transition hover:brightness-110"
        style={{ backgroundImage: categoryGradient(id) }}
      >
        {/* The design puts an illustrated icon badge here. This is a neutral
            stand-in holding its place and weight — see components/site/artwork. */}
        <span
          aria-hidden="true"
          className="flare-glass-strong flex size-10 items-center justify-center rounded-full text-sm font-bold"
        >
          {title.slice(0, 1)}
        </span>
        <span className="flare-label mt-4 text-base leading-tight">{title}</span>
      </Link>

      <div className="flex flex-col gap-2 p-3">
        {summary.status === "completed" && (
          <>
            <span className="flare-label rounded-full bg-[image:var(--grad-cta)] px-3 py-1 text-center text-[0.7rem] text-white">
              Certificate
            </span>
            <div className="flex gap-2">
              <span className="flare-label flex-1 rounded-full border border-border px-3 py-1 text-center text-[0.7rem] text-muted">
                Complete
              </span>
              <Link
                href={`/training/${id}`}
                className="flare-label flex-1 rounded-full border border-border px-3 py-1 text-center text-[0.7rem] hover:border-accent hover:text-accent"
              >
                Restart
              </Link>
            </div>
          </>
        )}

        {summary.status === "in_progress" && (
          <>
            <div className="flex items-center gap-2">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-valuenow={summary.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${title} progress`}
              >
                <div
                  className="h-full rounded-full bg-[image:var(--grad-cta)]"
                  style={{ width: `${summary.percent}%` }}
                />
              </div>
              <span className="text-xs font-semibold tabular-nums text-muted">{summary.percent}%</span>
            </div>
            <Link
              href={`/training/${id}`}
              className="flare-label rounded-full border border-border px-3 py-1 text-center text-[0.7rem] hover:border-accent hover:text-accent"
            >
              Continue
            </Link>
          </>
        )}

        {summary.status === "not_started" && (
          <Link
            href={`/training/${id}`}
            className="flare-label rounded-full border border-border px-3 py-1 text-center text-[0.7rem] hover:border-accent hover:text-accent"
          >
            Access
          </Link>
        )}
      </div>
    </div>
  );
}
