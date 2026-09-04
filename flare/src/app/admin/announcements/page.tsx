import { listRecentAnnouncements } from "@/lib/announcements/store";
import { AnnouncementForm } from "@/components/admin/announcement-form";
import { Badge, Empty, PageHeading, Panel } from "@/components/admin/ui";
import { formatManilaDateTime } from "@/lib/format";

const LABELS: Record<string, string> = {
  course_update: "Course update",
  resource: "New resource",
  system: "System announcement",
  assessment_reminder: "Assessment reminder",
};

export default async function AdminAnnouncementsPage() {
  const announcements = await listRecentAnnouncements();

  return (
    <>
      <PageHeading
        title="Announcements"
        sub="Published to the Feed of every activated account. There is no recall, so read it back before publishing."
      />

      <Panel title="New announcement">
        <AnnouncementForm />
      </Panel>

      <Panel title="Recently published">
        {announcements.length === 0 ? (
          <Empty>Nothing published yet.</Empty>
        ) : (
          <ul>
            {announcements.map((announcement) => (
              <li key={announcement.id} className="border-b border-border px-4 py-3 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{LABELS[announcement.type] ?? announcement.type}</Badge>
                  <span className="font-medium">{announcement.title}</span>
                  <span className="ml-auto text-xs text-muted">
                    {formatManilaDateTime(announcement.createdAt)}
                  </span>
                </div>
                <p className="mt-1 max-w-3xl text-sm text-muted">{announcement.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
