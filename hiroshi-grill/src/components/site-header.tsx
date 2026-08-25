import Link from "next/link";

import { restaurant } from "@/lib/restaurant";

const navLinks = [
  { href: "#unli", label: "Unli Sets" },
  { href: "#menu", label: "Rice & Ramen" },
  { href: "#rules", label: "House Rules" },
  { href: "#visit", label: "Visit" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-paper-edge/70 bg-paper/90 backdrop-blur-sm">
      {/* Skip link: the first thing a keyboard or screen-reader user hits, so
          they can jump past the nav instead of tabbing through it every time. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-sumi focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
      >
        Skip to content
      </a>

      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-display text-xl font-semibold tracking-tight text-lacquer">
            {restaurant.shortName}
          </span>
          <span className="hidden text-[0.7rem] uppercase tracking-[0.22em] text-sumi-muted sm:inline">
            Master Grill
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-sumi-muted transition-colors hover:text-lacquer"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="#reserve"
          className="rounded-full bg-lacquer px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-lacquer-deep sm:px-5"
        >
          Reserve
        </a>
      </div>
    </header>
  );
}
