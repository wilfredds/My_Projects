import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/users/profile";
import { AccountStatusNotice } from "@/components/account-status";
import { getCategory, listLessons } from "@/lib/catalog/queries";
import { getCategoryProgress } from "@/lib/progress/store";
import { categoryGradient } from "@/lib/catalog/theme";
import { Shell } from "@/components/site/shell";
import { CategoryArtwork } from "@/components/site/artwork";
import { LESSON_SECTIONS } from "@/lib/types";

/**
 * A training category — the Overview and lesson tiles from the design, each
 * showing how much of it the learner has finished.
 */
export default async function CategoryPage({ params }: PageProps<"/training/[categoryId]">) {
  const { categoryId } = await params;

  const auth = await requireActiveUser();
  if (!auth.ok) {
    if (auth.reason === "signed_out") redirect(`/sign-in?next=/training/${categoryId}`);
    return <AccountStatusNotice reason={auth.reason} />;
  }

  const [category, lessons, progress] = await Promise.all([
    getCategory(categoryId),
    listLessons(categoryId),
    getCategoryProgress(auth.profile.uid, categoryId),
  ]);

  // An unpublished category is not visible to learners, only to authors.
  if (!category || !category.published) notFound();

  return (
    <Shell active="home" back="/home">
      <section className="relative h-40 overflow-hidden sm:h-52">
        <div className="absolute inset-0" aria-hidden="true">
          <CategoryArtwork categoryId={categoryId} />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-5 py-4">
          <h1 className="flare-label text-2xl text-white sm:text-3xl">{category.title}</h1>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-8">
        {category.description && (
          <p className="mb-6 max-w-[65ch] text-sm text-muted">{category.description}</p>
        )}

        {lessons.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface px-4 py-6 text-sm text-muted">
            No lessons have been published in this category yet.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((lesson) => {
              const state = progress?.lessons?.[lesson.id];
              const done = LESSON_SECTIONS.filter((s) => state?.[s] === "finished").length;

              return (
                <li key={lesson.id}>
                  <Link
                    href={`/training/${categoryId}/${lesson.id}`}
                    className="flex h-full flex-col justify-between gap-4 rounded-2xl p-4 text-white shadow-sm transition hover:brightness-110"
                    style={{ backgroundImage: categoryGradient(categoryId) }}
                  >
                    <span className="flare-label text-base leading-tight">{lesson.title}</span>
                    <span className="text-xs font-semibold text-white/85">
                      {done === LESSON_SECTIONS.length
                        ? "Finished"
                        : done === 0
                          ? "Not started"
                          : `${done} of ${LESSON_SECTIONS.length} sections`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Shell>
  );
}
