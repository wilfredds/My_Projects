import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

// Placeholder — real layout arrives once the Figma design is accessible.
// Demonstrates the pattern every future protected page should follow:
// verify the session server-side (never trust middleware's cookie-presence
// check alone) before rendering anything gated.
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/dashboard");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-black/70 dark:text-white/70">Signed in as {user.email}.</p>
    </main>
  );
}
