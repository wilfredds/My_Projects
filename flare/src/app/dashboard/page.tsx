import { redirect } from "next/navigation";

/**
 * /dashboard was the placeholder that stood in before the design was built.
 * The real signed-in landing screen is /home. Kept as a redirect rather than
 * deleted, because sign-in links and bookmarks made during development point
 * here, and a 404 is a worse answer than the right page.
 */
export default function DashboardPage() {
  redirect("/home");
}
