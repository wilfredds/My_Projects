import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireActiveUser } from "@/lib/users/profile";
import { AccountStatusNotice } from "@/components/account-status";
import { Shell } from "@/components/site/shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/site/sign-out";
import { THEME_COOKIE, themeOrDefault } from "@/lib/theme/theme";

export default async function SettingsPage() {
  const auth = await requireActiveUser();
  if (!auth.ok) {
    if (auth.reason === "signed_out") redirect("/sign-in?next=/settings");
    return <AccountStatusNotice reason={auth.reason} />;
  }

  const store = await cookies();
  const theme = themeOrDefault(store.get(THEME_COOKIE)?.value);

  return (
    <Shell active="settings">
      <section className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="flare-label mb-5 w-fit rounded-full bg-[image:var(--grad-cta)] px-4 py-1.5 text-sm text-white">
          Settings
        </h1>

        <div className="flex flex-col gap-4">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition hover:border-accent"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-[image:var(--grad-cta)] text-sm font-bold text-white">
              {(auth.profile.fullName || auth.profile.username).slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">
                {auth.profile.fullName || auth.profile.username}
              </span>
              <span className="block text-xs text-muted">
                {auth.profile.position || auth.profile.role}
              </span>
            </span>
            <span className="ml-auto text-muted">›</span>
          </Link>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="flare-label mb-3 text-xs text-muted">Appearance</h2>
            <ThemeToggle initial={theme} />
          </div>

          {/* The design also lists Pause Notification, Security and Language.
              They are left out rather than drawn as dead switches: nothing
              sends notifications yet, the language list is still an open
              question with the client, and Security needs the password-change
              flow. Each is one small screen once those are settled. */}
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            <h2 className="flare-label mb-2 text-xs">Not available yet</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>Pause notifications — nothing sends them yet</li>
              <li>Language — which languages to offer is still being decided</li>
              <li>Security — password change and sign-out-everywhere</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-surface">
            {[
              ["About us", "/about"],
              ["Privacy", "/about#privacy"],
              ["Terms of service", "/about#terms"],
            ].map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="flex items-center border-b border-border px-4 py-3 text-sm last:border-0 hover:text-accent"
              >
                {label}
                <span className="ml-auto text-muted">›</span>
              </Link>
            ))}
          </div>

          <SignOutButton />
        </div>
      </section>
    </Shell>
  );
}
