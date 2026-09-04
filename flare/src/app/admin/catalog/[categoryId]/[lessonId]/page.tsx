import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory, listLessons } from "@/lib/catalog/queries";
import { getSection } from "@/lib/catalog/authoring";
import { EditLessonForm, SectionEditor } from "@/components/admin/catalog-forms";
import { MediaManager } from "@/components/admin/media-manager";
import { Badge, PageHeading, Panel } from "@/components/admin/ui";
import { formatManilaDateTime } from "@/lib/format";
import { LESSON_SECTIONS, type LessonSectionContent } from "@/lib/types";

function hasContent(section: LessonSectionContent | null): boolean {
  if (!section) return false;
  return Boolean(section.body?.trim()) || (section.attachments?.length ?? 0) > 0 || Boolean(section.video);
}

const SECTION_LABELS: Record<string, string> = {
  discussion: "Discussion",
  resources: "Resources",
  assessment: "Assessment",
};

export default async function AdminLessonPage({
  params,
}: PageProps<"/admin/catalog/[categoryId]/[lessonId]">) {
  const { categoryId, lessonId } = await params;

  const [category, lessons] = await Promise.all([
    getCategory(categoryId),
    listLessons(categoryId, true),
  ]);
  const lesson = lessons.find((entry) => entry.id === lessonId);
  if (!category || !lesson) notFound();

  const sections = await Promise.all(
    LESSON_SECTIONS.map(async (id) => ({ id, content: await getSection(categoryId, lessonId, id) })),
  );

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/catalog" className="text-muted underline underline-offset-2">
          Training content
        </Link>
        <span className="text-muted"> / </span>
        <Link href={`/admin/catalog/${categoryId}`} className="text-muted underline underline-offset-2">
          {category.title}
        </Link>
      </p>

      <PageHeading
        title={lesson.title}
        sub="Content is written in Markdown and stored as text, never as HTML — so an authoring account cannot inject script into every firefighter's browser."
      />

      <Panel title="Lesson settings">
        <EditLessonForm
          categoryId={categoryId}
          lessonId={lessonId}
          title={lesson.title}
          published={lesson.published}
        />
      </Panel>

      {sections.map(({ id, content }) => (
        <Panel
          key={id}
          title={SECTION_LABELS[id] ?? id}
          // "Empty" means nothing for a learner to open — text, a file or a
          // video all count. Judging it on the body alone labelled a section
          // holding a manual and a video as empty.
          action={
            hasContent(content) ? (
              <span className="text-xs text-muted">
                {content?.updatedAt ? `Edited ${formatManilaDateTime(content.updatedAt)}` : "Has media"}
              </span>
            ) : (
              <Badge tone="warning">Empty</Badge>
            )
          }
        >
          {id === "assessment" && (
            <p className="border-b border-border px-4 py-2.5 text-xs text-muted">
              Question authoring is not built yet: it is waiting on whether questions are
              single- or multi-answer, and what score passes. This box holds the section&apos;s
              written introduction in the meantime.
            </p>
          )}
          <SectionEditor
            categoryId={categoryId}
            lessonId={lessonId}
            sectionId={id}
            body={content?.body ?? ""}
          />
          <MediaManager
            categoryId={categoryId}
            lessonId={lessonId}
            sectionId={id}
            attachments={content?.attachments ?? []}
            video={content?.video ?? null}
          />
        </Panel>
      ))}
    </>
  );
}
