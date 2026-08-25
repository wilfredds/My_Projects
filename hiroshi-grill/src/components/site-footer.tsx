import Link from "next/link";

import { restaurant } from "@/lib/restaurant";

export function SiteFooter() {
  return (
    <footer className="border-t border-paper/15 bg-sumi py-12 text-paper">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-2xl font-semibold text-gold">{restaurant.name}</p>
          <p className="mt-1.5 text-sm text-paper/60">
            {restaurant.cuisine} · {restaurant.address.city}, {restaurant.address.province}
          </p>
        </div>

        <div className="flex flex-col gap-2 text-sm sm:items-end">
          {/* Staff entrance. Nothing behind this link is readable without a
              login — the database itself refuses, not just this page. */}
          <Link href="/portal" className="text-paper/60 transition-colors hover:text-gold">
            Staff portal
          </Link>
          <p className="text-paper/40">
            © {new Date().getFullYear()} {restaurant.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
