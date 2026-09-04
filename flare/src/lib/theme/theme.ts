// Theme preference handling.
//
// Three states, not two. The Settings screen's Dark Mode toggle is an
// explicit choice, but a user who has never touched it should follow their
// device — so "system" is a real value, distinct from light and dark, and is
// the default.
//
// No "@/" alias and an explicit extension: this module is unit tested with
// `node --test`, which resolves neither.

export const THEME_COOKIE = "flare_theme";

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/**
 * What to stamp on <html>.
 *
 * "system" stamps nothing, leaving the CSS to decide via
 * prefers-color-scheme. Stamping data-theme="light" for a system user would
 * override a dark OS setting, which is the opposite of what they asked for.
 */
export function themeAttribute(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}

/** Narrows an untrusted value — a cookie, a request body — to a Theme. */
export function parseTheme(value: unknown): Theme | null {
  if (typeof value !== "string") return null;
  return (THEMES as readonly string[]).includes(value) ? (value as Theme) : null;
}

/** Falls back to "system" for anything unrecognised. */
export function themeOrDefault(value: unknown): Theme {
  return parseTheme(value) ?? "system";
}

/** A year: the preference should outlive the session it was set in. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
