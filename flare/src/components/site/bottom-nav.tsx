"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The pill navigation from the design: four destinations, and the active one
 * widens to show its label while the rest stay as icons.
 */
export type NavKey = "home" | "feed" | "settings" | "profile";

const ITEMS: { key: NavKey; label: string; href: string; icon: ReactNode }[] = [
  {
    key: "home",
    label: "Home",
    href: "/home",
    icon: (
      <path
        d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z"
        fill="currentColor"
      />
    ),
  },
  {
    key: "feed",
    label: "Feed",
    href: "/feed",
    icon: <path d="M4 9v6h3l6 4V5L7 9zm12.5 3a4.5 4.5 0 00-2-3.7v7.4a4.5 4.5 0 002-3.7z" fill="currentColor" />,
  },
  {
    key: "settings",
    label: "Settings",
    href: "/settings",
    icon: (
      <>
        <circle cx="12" cy="12" r="3.2" fill="currentColor" />
        <path
          d="M12 3l1.6 2.3 2.7-.6.5 2.7 2.4 1.4-1.6 2.2 1.6 2.2-2.4 1.4-.5 2.7-2.7-.6L12 21l-1.6-2.3-2.7.6-.5-2.7-2.4-1.4L6.4 13 4.8 10.8l2.4-1.4.5-2.7 2.7.6z"
          fill="currentColor"
          opacity="0.5"
        />
      </>
    ),
  },
  {
    key: "profile",
    label: "Profile",
    href: "/profile",
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.6" fill="currentColor" />
        <path d="M4.5 20a7.5 7.5 0 0115 0z" fill="currentColor" />
      </>
    ),
  },
];

export function BottomNav({ active }: { active: NavKey }) {
  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-20 flex justify-center px-4 pb-4 pt-2"
    >
      <ul className="flare-glass-strong flex items-center gap-1 rounded-full bg-[var(--surface)]/85 p-1.5 shadow-lg">
        {ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-[image:var(--grad-cta)] font-semibold text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  {item.icon}
                </svg>
                {/* The label rides along only for the active item, as drawn,
                    but stays in the accessibility tree for the others. */}
                <span className={isActive ? "" : "sr-only"}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
