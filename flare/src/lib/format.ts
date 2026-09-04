/**
 * Display formatting.
 *
 * Everyone reading FLARE's admin surface is in one timezone, and the server
 * rendering it may not be. Pinning to Asia/Manila keeps an audit timestamp or
 * a registration date from being silently a day off — which for a compliance
 * record is a real problem, not a cosmetic one.
 */

const MANILA = "Asia/Manila";

export function formatManilaDateTime(value: string | null | undefined): string {
  const date = parse(value);
  if (!date) return "—";

  return date.toLocaleString("en-PH", {
    timeZone: MANILA,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatManilaDate(value: string | null | undefined): string {
  const date = parse(value);
  if (!date) return "—";

  return date.toLocaleDateString("en-PH", {
    timeZone: MANILA,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
