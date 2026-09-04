import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { FlareWordmark } from "@/components/site/brand";
import { HeroArtwork } from "@/components/site/artwork";

/**
 * The landing screen — "DOMAIN" in the design.
 *
 * Signed-in visitors skip it: being shown "Create new account" when you
 * already have one is a small thing that makes an app feel unfinished.
 */
export default async function LandingPage() {
  if (await getCurrentUser()) redirect("/home");

  return (
    <main className="flare-gradient relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <HeroArtwork />
      </div>

      <div className="relative flex w-full max-w-sm flex-col items-center gap-10">
        <FlareWordmark size="lg" tagline />

        <div className="flex w-full flex-col gap-3">
          <Link
            href="/sign-up"
            className="flare-label rounded-full bg-[image:var(--grad-cta)] px-6 py-3 text-center text-sm text-white shadow-lg transition hover:brightness-110"
          >
            Create new account
          </Link>
          <Link
            href="/sign-in"
            className="flare-label rounded-full border-2 border-white/80 px-6 py-3 text-center text-sm text-white transition hover:bg-white/10"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
