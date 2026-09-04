import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/users/profile";
import { AccountStatusNotice } from "@/components/account-status";
import { listRecentAnnouncements } from "@/lib/announcements/store";
import { Shell } from "@/components/site/shell";
import { formatManilaDateTime } from "@/lib/format";
import type { Announcement } from "@/lib/types";

const KIND_LABELS: Record<string, string> = {
  course_update: "Course update",
  resource: "New resource uploaded",
  system: "System announcement",
  assessment_reminder: "Assessment reminder",
};

/**
 * Feed — announcements, grouped by day as the design shows.
 *
 * Per-recipient read state exists in the data model
 * (users/{uid}/notifications) but there is nothing writing it yet, so the
 * "Mark as read" control from the design is deliberately absent rather than
 * present and inert. A button that does nothing is worse than no button.
 */
export default async function FeedPage() {
  const auth = await requireActiveUser();
  if (!auth.ok) {
    if (auth.reason === "signed_out") redirect("/sign-in?next=/feed");
    return <AccountStatusNotice reason={auth.reason} />;
  }

  const announcements = await listRecentAnnouncements(50);
  const groups = groupByDay(announcements);

  return (
    <Shell active="feed">
      <section className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="flare-label mb-5 w-fit rounded-full bg-[image:var(--grad-cta)] px-4 py-1.5 text-sm text-white">
          Feed
        </h1>

        {groups.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface px-4 py-6 text-sm text-muted">
            Nothing has been announced yet.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map(([day, items]) => (
              <div key={day}>
                <h2 className="flare-label mb-2 text-xs text-muted">{day}</h2>
                <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
                  {items.map((item) => (
                    <li key={item.id} className="border-b border-border p-4 last:border-0">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="flare-label text-[0.7rem] text-accent">
                          {KIND_LABELS[item.type] ?? item.type}
                        </span>
                        <span className="ml-auto text-xs tabular-nums text-muted">
                          {formatManilaDateTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 font-semibold">{item.title}</p>
                      <p className="mt-0.5 max-w-[65ch] text-sm text-muted">{item.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}

/** "Today", "Yesterday", then the date — the grouping the design uses. */
function groupByDay(items: Announcement[]): [string, Announcement[]][] {
  const groups = new Map<string, Announcement[]>();

  for (const item of items) {
    const key = dayLabel(item.createdAt);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  return [...groups.entries()];
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Earlier";

  const manila = (value: Date) =>
    value.toLocaleDateString("en-PH", { timeZone: "Asia/Manila" });

  const today = manila(new Date());
  const yesterday = manila(new Date(Date.now() - 86_400_000));
  const stamped = manila(date);

  if (stamped === today) return "Today";
  if (stamped === yesterday) return "Yesterday";
  return date.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
