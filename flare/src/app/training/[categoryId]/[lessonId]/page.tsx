import { notFound, redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/users/profile";
import { AccountStatusNotice } from "@/components/account-status";
import { getCategory, getLessonSections, listLessons } from "@/lib/catalog/queries";
import { getCategoryProgress } from "@/lib/progress/store";
import { categoryGradient } from "@/lib/catalog/theme";
import { Shell } from "@/components/site/shell";
import { LessonView } from "@/components/site/lesson-view";

export default async function LessonPage({
  params,
}: PageProps<"/training/[categoryId]/[lessonId]">) {
  const { categoryId, lessonId } = await params;

  const auth = await requireActiveUser();
  if (!auth.ok) {
    if (auth.reason === "signed_out") {
      redirect(`/sign-in?next=/training/${categoryId}/${lessonId}`);
    }
    return <AccountStatusNotice reason={auth.reason} />;
  }

  const [category, lessons, sections, progress] = await Promise.all([
    getCategory(categoryId),
    listLessons(categoryId),
    getLessonSections(categoryId, lessonId),
    getCategoryProgress(auth.profile.uid, categoryId),
  ]);

  const lesson = lessons.find((entry) => entry.id === lessonId);
  // Unpublished content is invisible to learners even by direct URL: listLessons
  // excludes drafts, so a draft lesson simply does not exist here.
  if (!category || !category.published || !lesson) notFound();

  return (
    <Shell active="home" back={`/training/${categoryId}`}>
      <LessonView
        categoryId={categoryId}
        lessonId={lessonId}
        title={lesson.title}
        gradient={categoryGradient(categoryId)}
        sections={sections}
        initialState={progress?.lessons?.[lessonId] ?? {}}
        backHref={`/training/${categoryId}`}
      />
    </Shell>
  );
}
