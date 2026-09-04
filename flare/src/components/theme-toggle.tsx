"use client";

import { useEffect, useState } from "react";
import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  type Theme,
} from "@/lib/theme/theme";

/**
 * The Settings screen's Dark Mode control.
 *
 * Unstyled on purpose — this is the mechanism, not the design. The switch in
 * the Figma frames replaces the markup once the file is shared; the state
 * handling below stays.
 *
 * The chosen theme is applied locally first so it is instant, then sent to
 * the server. If that request fails the user still sees what they chose, and
 * the cookie written here means it survives a reload regardless.
 */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  // The DOM and the cookie are external state, so they are synchronised from
  // an effect rather than mutated in the click handler. Running once on mount
  // is harmless: it rewrites the value the server already rendered, which
  // also refreshes the cookie's expiry.
  useEffect(() => {
    // "system" removes the attribute entirely, handing the decision back to
    // prefers-color-scheme rather than pinning today's OS setting in place.
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;

    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
  }, [theme]);

  function choose(next: Theme) {
    if (next === theme) return;
    setTheme(next);

    void fetch("/api/preferences/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {
      // Already applied above and stored in the cookie. Nothing to recover.
    });
  }

  return (
    <fieldset className="flex items-center gap-3 rounded border border-border p-3">
      <legend className="px-1 text-sm text-muted">Appearance</legend>
      {(["system", "light", "dark"] as const).map((option) => (
        <label key={option} className="flex items-center gap-1.5 text-sm capitalize">
          <input
            type="radio"
            name="theme"
            value={option}
            checked={theme === option}
            onChange={() => choose(option)}
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}
