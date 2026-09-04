import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/users/profile";

/**
 * The admin surface's authorization boundary.
 *
 * Every page below this layout is gated here, server-side. Middleware only
 * checks that a session cookie exists — it runs on the Edge runtime, which
 * cannot load firebase-admin — so it can redirect a signed-out visitor but
 * cannot tell an administrator from a learner. This check can, and does.
 *
 * Note that it does not protect the Server Actions those pages call: each of
 * those is its own public endpoint and re-checks through withAdmin().
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const auth = await requireAdmin();

  if (!auth.ok) {
    if (auth.reason === "signed_out") redirect("/sign-in?next=/admin");
    // A signed-in learner is sent back to their own dashboard rather than
    // shown an error: from their side, the admin surface simply isn't theirs.
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="font-semibold tracking-tight">
            FLARE <span className="text-muted">Admin</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/admin/users" className="text-muted hover:text-foreground">
              Accounts
            </Link>
            <Link href="/admin/catalog" className="text-muted hover:text-foreground">
              Content
            </Link>
            <Link href="/admin/announcements" className="text-muted hover:text-foreground">
              Announcements
            </Link>
            <Link href="/admin/audit" className="text-muted hover:text-foreground">
              Audit log
            </Link>
          </nav>

          <p className="ml-auto text-sm text-muted">
            {auth.profile.fullName || auth.profile.username}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
