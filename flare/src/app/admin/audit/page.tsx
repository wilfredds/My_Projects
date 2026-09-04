import { listRecentAuditEntries } from "@/lib/audit/query";
import { listUsersForAdmin } from "@/lib/users/admin";
import { Empty, PageHeading, Panel, TableWrap } from "@/components/admin/ui";
import { formatManilaDateTime } from "@/lib/format";

const ACTION_LABELS: Record<string, string> = {
  sign_in: "Signed in",
  sign_out: "Signed out",
  section_completed: "Marked a section",
  assessment_submitted: "Submitted an assessment",
  certificate_issued: "Certificate issued",
  profile_updated: "Account changed",
  announcement_published: "Announcement published",
  content_created: "Content created",
  content_updated: "Content edited",
};

export default async function AdminAuditPage() {
  // Read together so the log can name people rather than only UIDs.
  const [entries, users] = await Promise.all([listRecentAuditEntries(), listUsersForAdmin()]);

  const nameByUid = new Map(
    [...users.pending, ...users.active, ...users.suspended].map((user) => [
      user.uid,
      user.fullName || user.username || user.email,
    ]),
  );

  return (
    <>
      <PageHeading
        title="Audit log"
        sub="FLARE's Privacy Notice tells users it records login history, IP address and system usage. This is that record. It cannot be edited or deleted by anyone, including administrators."
      />

      <Panel title={`Most recent ${entries.length} entries`}>
        {entries.length === 0 ? (
          <Empty>Nothing recorded yet.</Empty>
        ) : (
          <TableWrap>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="whitespace-nowrap px-4 py-2 font-medium">When</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Who</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Detail</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted">
                      {formatManilaDateTime(entry.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      {nameByUid.get(entry.uid) ?? <span className="text-muted">{entry.uid}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </td>
                    <td className="px-4 py-2 text-muted">
                      <span className="font-mono text-xs">{describe(entry.detail, entry.targetPath)}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted">
                      {entry.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}

function describe(
  detail: Record<string, string | number | boolean | null> | null,
  targetPath: string | null,
): string {
  const parts: string[] = [];
  if (detail) {
    for (const [key, value] of Object.entries(detail)) {
      if (value !== null) parts.push(`${key}=${value}`);
    }
  }
  if (targetPath) parts.push(targetPath);
  return parts.join("  ") || "—";
}
