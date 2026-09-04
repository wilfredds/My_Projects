import Link from "next/link";
import { listCategories, listLessons } from "@/lib/catalog/queries";
import { NewCategoryForm } from "@/components/admin/catalog-forms";
import { Badge, Empty, PageHeading, Panel, TableWrap } from "@/components/admin/ui";

export default async function AdminCatalogPage() {
  const categories = await listCategories(true);

  // Lesson counts alongside each category, so an author can see at a glance
  // which tracks are still empty.
  const counts = await Promise.all(
    categories.map(async (category) => {
      const all = await listLessons(category.id, true);
      return {
        id: category.id,
        total: all.length,
        published: all.filter((lesson) => lesson.published).length,
      };
    }),
  );
  const countById = new Map(counts.map((entry) => [entry.id, entry]));

  return (
    <>
      <PageHeading
        title="Training content"
        sub="Six categories, each holding an Overview and its lessons. Unpublished content is hidden from learners and left out of completion percentages."
      />

      <Panel title={`Categories (${categories.length})`}>
        {categories.length === 0 ? (
          <Empty>No categories yet. Create the first one below.</Empty>
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Identifier</th>
                  <th className="px-4 py-2 font-medium">Lessons</th>
                  <th className="px-4 py-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => {
                  const count = countById.get(category.id);
                  return (
                    <tr key={category.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <Link
                          href={`/admin/catalog/${category.id}`}
                          className="font-medium text-accent underline underline-offset-2"
                        >
                          {category.title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted">
                        {category.id}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                        {count ? `${count.published} of ${count.total} published` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {category.published ? (
                          <Badge tone="success">Published</Badge>
                        ) : (
                          <Badge tone="warning">Draft</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

      <Panel title="New category">
        <NewCategoryForm />
      </Panel>
    </>
  );
}
