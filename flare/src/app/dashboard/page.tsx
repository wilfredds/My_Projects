import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/users/profile";
import { AccountStatusNotice } from "@/components/account-status";

/**
 * Placeholder — real layout arrives once the Figma design is accessible.
 *
 * Demonstrates the pattern every learner page must follow: authorize with
 * requireActiveUser(), not merely getCurrentUser(). A valid session only
 * proves who someone is; it does not prove they have been admitted, and
 * FLARE is restricted to approved BFP personnel. Middleware cannot make this
 * distinction either — it runs on the Edge runtime and cannot load
 * firebase-admin — so this check is the one that counts.
 */
export default async function DashboardPage() {
  const auth = await requireActiveUser();

  if (!auth.ok) {
    if (auth.reason === "signed_out") redirect("/sign-in?next=/dashboard");
    // Pending and suspended accounts are told which they are, rather than
    // being bounced back to a sign-in form they just used successfully.
    return <AccountStatusNotice reason={auth.reason} />;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-muted">Signed in as {auth.profile.fullName || auth.profile.email}.</p>
    </main>
  );
}
