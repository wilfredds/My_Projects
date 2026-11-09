import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge, told about this app's custom font sizes.
 *
 * Out of the box it only knows Tailwind's built-in size names. Faced with
 * `text-money` it guesses "a colour", so `cn('text-money', 'text-success')`
 * dropped the size and kept the colour — every coloured money figure on the
 * dashboard rendered at body size. Registering the sizes here puts them in the
 * font-size group, where they belong and no longer collide with colours.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['money', 'total', 'meter'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Prisma Decimal (or anything with toString) -> plain number, safe to send to a client component. */
export function decimalToNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

/** Format a date for display in the given locale. */
export function formatDate(date: Date | string, locale = 'en-PH'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Format a date and time for display. */
export function formatDateTime(date: Date | string, locale = 'en-PH'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

/** `2026-08-05` in the server's local timezone, for date inputs. */
export function toDateInputValue(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

/** Start of day / end of day helpers for date-range filters. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Escape a value for a CSV cell. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV document from rows of primitives. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return lines.join('\r\n');
}
