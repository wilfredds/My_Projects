import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory, listLessons } from "@/lib/catalog/queries";
import { EditCategoryForm, NewLessonForm } from "@/components/admin/catalog-forms";
import { Badge, Empty, PageHeading, Panel, TableWrap } from "@/components/admin/ui";

export default async function AdminCategoryPage({ params }: PageProps<"/admin/catalog/[categoryId]">) {
  const { categoryId } = await params;

  const [category, lessons] = await Promise.all([
    getCategory(categoryId),
    listLessons(categoryId, true),
  ]);
  if (!category) notFound();

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/catalog" className="text-muted underline underline-offset-2">
          Training content
        </Link>
      </p>

      <PageHeading title={category.title} sub={category.description || undefined} />

      <Panel
        title={`Lessons (${lessons.length})`}
        action={
          category.published ? <Badge tone="success">Category published</Badge> : <Badge tone="warning">Category is a draft</Badge>
        }
      >
        {lessons.length === 0 ? (
          <Empty>No lessons yet. Add the first one below.</Empty>
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Identifier</th>
                  <th className="px-4 py-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {lessons.map((lesson) => (
                  <tr key={lesson.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 tabular-nums text-muted">{lesson.order}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link
                        href={`/admin/catalog/${categoryId}/${lesson.id}`}
                        className="font-medium text-accent underline underline-offset-2"
                      >
                        {lesson.title}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted">
                      {lesson.id}
                    </td>
                    <td className="px-4 py-2.5">
                      {lesson.published ? (
                        <Badge tone="success">Published</Badge>
                      ) : (
                        <Badge tone="warning">Draft</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      <Panel title="New lesson">
        <NewLessonForm categoryId={categoryId} />
      </Panel>

      <Panel title="Category settings">
        <EditCategoryForm
          categoryId={categoryId}
          title={category.title}
          description={category.description ?? ""}
          published={category.published}
        />
      </Panel>
    </>
  );
}
