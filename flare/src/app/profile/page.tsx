import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/users/profile";
import { AccountStatusNotice } from "@/components/account-status";
import { listCategories, listPublishedLessonIds } from "@/lib/catalog/queries";
import { summarize } from "@/lib/progress/store";
import { getAdminDb } from "@/lib/firebase/admin";
import { Shell } from "@/components/site/shell";
import { HeroArtwork } from "@/components/site/artwork";

/**
 * Profile — identity, and the four training statistics from the design.
 *
 * Every figure is counted from the learner's actual records rather than kept
 * as a stored tally, for the same reason the category percentages are: a
 * counter drifts the moment content changes underneath it, and these numbers
 * are what a firefighter believes about their own compliance.
 */
export default async function ProfilePage() {
  const auth = await requireActiveUser();
  if (!auth.ok) {
    if (auth.reason === "signed_out") redirect("/sign-in?next=/profile");
    return <AccountStatusNotice reason={auth.reason} />;
  }

  const { profile } = auth;
  const categories = await listCategories();

  const summaries = await Promise.all(
    categories.map(async (category) =>
      summarize(profile.uid, category.id, await listPublishedLessonIds(category.id)),
    ),
  );

  const certificates = await getAdminDb()
    .collection("users")
    .doc(profile.uid)
    .collection("certificates")
    .count()
    .get();

  const enrolled = summaries.filter((s) => s.status !== "not_started").length;
  const completed = summaries.filter((s) => s.status === "completed").length;
  // "Pending assessments" counts categories a learner has started but not
  // finished — the assessment itself is the last thing standing between them.
  const pending = summaries.filter((s) => s.status === "in_progress").length;

  return (
    <Shell active="profile">
      <section className="flare-gradient relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <HeroArtwork />
        </div>
        <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 py-10 text-center text-white">
          <div className="flare-glass-strong flex size-24 items-center justify-center rounded-full text-3xl font-bold">
            {initials(profile.fullName || profile.username)}
          </div>
          <p className="text-sm text-[var(--on-gradient-muted)]">
            Welcome{profile.rank ? `, ${profile.rank}` : ""}
          </p>
          <h1 className="flare-label text-2xl sm:text-3xl">
            {profile.fullName || profile.username}
          </h1>
          {profile.position && (
            <span className="flare-glass rounded-full px-3 py-1 text-xs">{profile.position}</span>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-8">
        <h2 className="flare-label mb-4 text-sm text-muted">Training overview</h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Trainings" value={enrolled} caption="Enrolled" />
          <Stat label="Completed" value={completed} caption="Training" />
          <Stat label="Assessments" value={pending} caption="Pending" />
          <Stat label="Certificates" value={certificates.data().count} caption="Earned" />
        </dl>

        <div className="mt-6 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          <p>
            Signed in as <span className="text-foreground">{profile.email}</span>.
          </p>
          {!profile.badgeNumber && (
            <p className="mt-1 text-xs">
              Rank, badge number and station are not recorded on this account. They are
              administrator-managed, and the sign-up form does not collect them — see the open
              questions in the project documentation.
            </p>
          )}
        </div>
      </section>
    </Shell>
  );
}

function Stat({ label, value, caption }: { label: string; value: number; caption: string }) {
  return (
    <div className="rounded-2xl bg-[image:var(--cat-water)] px-4 py-4 text-white">
      <dt className="flare-label text-[0.65rem] opacity-80">{caption}</dt>
      <dd className="mt-1 text-3xl font-extrabold tabular-nums">{value}</dd>
      <dd className="flare-label text-[0.65rem] opacity-80">{label}</dd>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.replace(",", "").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}
