import Link from "next/link";
import { listUsersForAdmin } from "@/lib/users/admin";
import { listCategories } from "@/lib/catalog/queries";
import { listRecentAuditEntries } from "@/lib/audit/query";
import { Badge, PageHeading, Panel, StatTile, Empty } from "@/components/admin/ui";
import { formatManilaDateTime } from "@/lib/format";

export default async function AdminDashboardPage() {
  const [users, categories, recent] = await Promise.all([
    listUsersForAdmin(),
    listCategories(true),
    listRecentAuditEntries(8),
  ]);

  return (
    <>
      <PageHeading title="Overview" />

      {/* Pending approvals lead, because they are the only figure here that
          is a queue of work rather than a measurement. */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Waiting for approval"
          value={users.pending.length}
          tone={users.pending.length > 0 ? "warning" : "neutral"}
        />
        <StatTile label="Active accounts" value={users.active.length} />
        <StatTile label="Suspended" value={users.suspended.length} />
        <StatTile label="Training categories" value={categories.length} />
      </div>

      {users.pending.length > 0 && (
        <Panel title="Needs attention" action={<Badge tone="warning">Approval queue</Badge>}>
          <p className="px-4 py-3 text-sm">
            {users.pending.length} registration{users.pending.length === 1 ? " is" : "s are"} waiting.
            Until approved, {users.pending.length === 1 ? "that account" : "those accounts"} cannot
            open any training material.{" "}
            <Link href="/admin/users" className="text-accent underline underline-offset-2">
              Review them
            </Link>
            .
          </p>
        </Panel>
      )}

      <Panel
        title="Recent activity"
        action={
          <Link href="/admin/audit" className="text-xs text-muted underline underline-offset-2">
            Full audit log
          </Link>
        }
      >
        {recent.length === 0 ? (
          <Empty>Nothing recorded yet.</Empty>
        ) : (
          <ul className="text-sm">
            {recent.map((entry) => (
              <li key={entry.id} className="flex gap-3 border-b border-border px-4 py-2 last:border-0">
                <span className="whitespace-nowrap tabular-nums text-muted">
                  {formatManilaDateTime(entry.createdAt)}
                </span>
                <span>{entry.action.replaceAll("_", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Not built yet">
        <ul className="px-4 py-3 text-sm text-muted">
          <li>
            <strong className="text-foreground">Assessment questions</strong> — blocked until the
            client confirms whether questions are single- or multi-answer, and what score passes.
            Lesson text can be written today; the questions themselves cannot.
          </li>
          <li className="mt-1.5">
            <strong className="text-foreground">File and video uploads</strong> — needs Firebase
            Storage, and a decision on whether video is hosted or embedded. Links written into a
            section work in the meantime.
          </li>
          <li className="mt-1.5">
            <strong className="text-foreground">Certificates and compliance reports</strong> —
            blocked on the certificate template and signatory.
          </li>
        </ul>
      </Panel>
    </>
  );
}
