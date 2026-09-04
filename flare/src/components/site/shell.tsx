import Link from "next/link";
import type { ReactNode } from "react";
import { FlareMark } from "./brand";
import { BottomNav, type NavKey } from "./bottom-nav";

/**
 * The frame every signed-in screen sits in: search bar on top, pill navigation
 * at the bottom, legal links in the footer. Taken from the design, where all
 * three appear on every authenticated frame.
 */
export function Shell({
  active,
  children,
  back,
}: {
  active: NavKey;
  children: ReactNode;
  /** Where the design's back arrow goes; omitted on the four root screens. */
  back?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopBar back={back} />
      {/* The navigation floats over the page, so the last thing on a screen
          needs room to clear it — otherwise the final card sits underneath. */}
      <main className="flex-1 pb-24">{children}</main>
      {/* Negative margin pulls the floating pill back over the content it
          sits above, rather than reserving a band of empty page for it. */}
      <div className="-mt-24">
        <BottomNav active={active} />
      </div>
      <SiteFooter />
    </div>
  );
}

function TopBar({ back }: { back?: string }) {
  return (
    <header className="flare-gradient sticky top-0 z-20">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        {back && (
          <Link
            href={back}
            aria-label="Go back"
            className="rounded-full p-1.5 text-[var(--on-gradient)] transition hover:bg-white/15"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 19l-7-7 7-7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        )}

        <Link href="/home" className="flex items-center gap-1.5 text-[var(--on-gradient)]">
          <FlareMark size={22} />
          <span className="text-base font-extrabold tracking-[0.16em]">FLARE</span>
        </Link>

        <p className="hidden flex-1 text-center text-sm font-bold text-[var(--on-gradient)] sm:block">
          Knowledge Management Portal
        </p>

        {/* Search is in the design on every screen. It is a real input rather
            than a mock, but it has nowhere to go yet: Firestore has no
            full-text search, and which service to use is still an open
            question with the client. Disabled, and labelled, instead of
            pretending to work. */}
        <label className="ml-auto flex min-w-0 max-w-56 flex-1 items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 sm:ml-0 sm:max-w-64">
          <span className="sr-only">Search training material</span>
          <input
            type="search"
            disabled
            placeholder="Search — not yet available"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#14103a] outline-none placeholder:text-[#5d5878]"
          />
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="#5d5878" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="#5d5878" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </label>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="flare-gradient">
      <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-6 px-4 py-5 text-[var(--on-gradient)]">
        <nav className="flex flex-col gap-1 text-xs">
          <Link href="/about" className="flare-label hover:underline">
            About us
          </Link>
          <Link href="/about#privacy" className="flare-label hover:underline">
            Privacy
          </Link>
          <Link href="/about#terms" className="flare-label hover:underline">
            Terms of service
          </Link>
        </nav>

        <div className="flex flex-col gap-1 text-xs">
          <span className="flare-label">Other resources</span>
          <span className="text-[var(--on-gradient-muted)]">Bureau of Fire Protection</span>
          <span className="text-[var(--on-gradient-muted)]">bfp.gov.ph</span>
        </div>
      </div>
    </footer>
  );
}
