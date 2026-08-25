import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getStaff } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/auth/login";
import { restaurant } from "@/lib/restaurant";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Staff sign-in",
  /* Keep the staff entrance out of search results. A courtesy, not a security
     control — the real protection is the login plus Row Level Security. Never
     treat "hard to find" as "protected". */
  robots: { index: false, follow: false },
};

/* Never cached: what this page should show depends on who is asking. */
export const dynamic = "force-dynamic";

export default async function PortalSignInPage({
  searchParams,
}: PageProps<"/portal">) {
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : null);

  /* Already signed in? Skip the form. Showing a login page to someone who is
     logged in is how people end up with two sessions and a confusing bug. */
  const staff = await getStaff();
  if (staff) {
    redirect(next);
  }

  return (
    <main className="flex grow items-center justify-center px-5 py-20">
      <div className="flex w-full max-w-sm flex-col items-center">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-lacquer">
          Staff only
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-sumi">
          {restaurant.shortName} portal
        </h1>
        <p className="mt-3 mb-8 text-center text-sm leading-relaxed text-sumi-muted">
          Sign in to see today&apos;s bookings.
        </p>

        <SignInForm next={next} />
      </div>
    </main>
  );
}
