/**
 * Branding a shop can choose for its own install of AutoCare.
 *
 * Each shop that installs the app picks one accent colour. The choices are a
 * short curated list rather than a free colour picker, for two reasons:
 *   1. every accent is measured against WCAG AA in all the places the theme
 *      uses it (`node scripts/check-contrast.mjs` checks each one), so no shop
 *      can pick a colour that makes its own buttons unreadable;
 *   2. green, red and amber are already taken — they mean paid, unpaid and
 *      partly paid. An accent in one of those would make "press this" look
 *      like "this is owed", so none is offered.
 *
 * The colour values themselves live in app/globals.css under
 * `:root[data-accent='…']`; the swatches here only draw the Settings picker.
 */

export const ACCENTS = ['kahel', 'asul', 'lila', 'itim'] as const;
export type Accent = (typeof ACCENTS)[number];

export const DEFAULT_ACCENT: Accent = 'kahel';

/** Picker swatches: the button colour, and the colour of the ₱ in the meter. */
export const ACCENT_SWATCH: Record<Accent, { fill: string; meter: string }> = {
  kahel: { fill: '#C2410C', meter: '#FB923C' },
  asul: { fill: '#1D4ED8', meter: '#60A5FA' },
  lila: { fill: '#6D28D9', meter: '#B79CFF' },
  itim: { fill: '#1E1D1A', meter: '#EDBE4A' },
};

export function isAccent(value: unknown): value is Accent {
  return typeof value === 'string' && (ACCENTS as readonly string[]).includes(value);
}

export function toAccent(value: unknown): Accent {
  return isAccent(value) ? value : DEFAULT_ACCENT;
}

/**
 * Two letters for the monogram shown when a shop has no logo:
 * "HI-OCTEN CAR CARE SERVICES" → "HO", "Mang Ben's Talyer" → "MB".
 */
export function monogram(name: string): string {
  const words = name
    .split(/[\s\-–—_.,/&]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  const letters = words.slice(0, 2).map((w) => w[0]!.toUpperCase());
  return letters.join('') || 'A';
}
