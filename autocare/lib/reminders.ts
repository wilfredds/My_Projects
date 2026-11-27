/**
 * Service reminders ("Babalikan").
 *
 * A job can carry the date — and, if the odometer was read, the km — at which
 * the car is due back. It is printed on the receipt like the change-oil sticker
 * on a windshield, and the Babalikan page lists every car that is due so the
 * shop can call or text the customer from its own phone.
 *
 * Everything here is pure, so the wizard (in the browser) and the server use
 * the same rules, and tests/reminders.test.ts can cover them without a
 * database. Dates are calendar dates written as "YYYY-MM-DD" and handled in
 * UTC, so no timezone can shift them by a day.
 */

/** What the owner picked for "when should this car come back?". */
export const REMINDER_CHOICES = ['auto', '1', '3', '6', '12', 'none'] as const;
export type ReminderChoice = (typeof REMINDER_CHOICES)[number] | 'keep';

/** The quick picks offered as buttons, in months. */
export const REMINDER_MONTHS = [1, 3, 6, 12] as const;

/** How far ahead the Babalikan list looks. */
export const REMINDER_WINDOW_DAYS = 14;

export interface IntervalSource {
  remindAfterMonths: number | null;
  remindAfterKm: number | null;
}

export interface NextVisit {
  /** "YYYY-MM-DD", or null for no reminder. */
  on: string | null;
  km: number | null;
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Is this a real calendar date written as YYYY-MM-DD? */
export function isYmd(value: string): boolean {
  const m = YMD.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

/** A "YYYY-MM-DD" date as a Date at UTC midnight (how @db.Date values come back). */
export function ymdToDate(value: string): Date {
  const m = YMD.exec(value);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${value}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** The calendar date of a Date, read in UTC. */
export function dateToYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Add whole months to a calendar date. A day that does not exist in the target
 * month is clamped to its last day: 30 November + 3 months is 28 February (or
 * the 29th in a leap year), never 2 March.
 */
export function addMonths(ymd: string, months: number): string {
  const start = ymdToDate(ymd);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(start.getUTCDate(), lastDay);
  return dateToYmd(new Date(Date.UTC(year, month, day)));
}

/** A calendar date some whole days later (or earlier, if negative). */
export function addDays(ymd: string, days: number): string {
  return dateToYmd(new Date(ymdToDate(ymd).getTime() + days * 86_400_000));
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((ymdToDate(to).getTime() - ymdToDate(from).getTime()) / 86_400_000);
}

/**
 * The shortest interval among a job's services: whichever falls due first.
 * Months and km are taken separately — "change oil every 3 months or 5,000 km"
 * plus "aircon every 6 months" gives 3 months and 5,000 km.
 */
export function shortestInterval(services: IntervalSource[]): {
  months: number | null;
  km: number | null;
} {
  const months = services
    .map((s) => s.remindAfterMonths)
    .filter((n): n is number => typeof n === 'number' && n > 0);
  const km = services
    .map((s) => s.remindAfterKm)
    .filter((n): n is number => typeof n === 'number' && n > 0);
  return {
    months: months.length ? Math.min(...months) : null,
    km: km.length ? Math.min(...km) : null,
  };
}

/**
 * When the car should come back.
 *
 * - `auto`: from the services done (the catalog says how often each repeats).
 * - `1` / `3` / `6` / `12`: that many months after the job, chosen by hand.
 * - `none`: no reminder.
 * - `keep`: leave what an existing job already has (`kept`).
 *
 * The km is "odometer + the shortest km interval", and only exists when the
 * odometer was read and some service has a km interval.
 */
export function planNextVisit(input: {
  jobDate: string;
  odometerKm: number | null;
  services: IntervalSource[];
  choice: ReminderChoice;
  kept?: NextVisit;
}): NextVisit {
  const { jobDate, odometerKm, services, choice } = input;
  if (choice === 'none') return { on: null, km: null };
  if (choice === 'keep') return input.kept ?? { on: null, km: null };
  if (!isYmd(jobDate)) return { on: null, km: null };

  const interval = shortestInterval(services);
  const km = odometerKm !== null && interval.km !== null ? odometerKm + interval.km : null;

  if (choice === 'auto') {
    // A km-only interval gives no date, so the job does not appear on the
    // Babalikan list; the km is still printed on the receipt.
    const on = interval.months !== null ? addMonths(jobDate, interval.months) : null;
    return { on, km };
  }

  return { on: addMonths(jobDate, Number(choice)), km };
}

/** Today's date in the shop's timezone, as "YYYY-MM-DD". */
export function shopToday(timeZone: string = defaultTimeZone(), now: Date = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return dateToYmd(now);
  }
}

function defaultTimeZone(): string {
  return (typeof process !== 'undefined' && process.env.SHOP_TIMEZONE) || 'Asia/Manila';
}

/** Where a reminder stands relative to today. */
export function reminderState(
  dueOn: string,
  today: string,
): { kind: 'overdue' | 'today' | 'soon'; days: number } {
  const days = daysBetween(today, dueOn);
  if (days < 0) return { kind: 'overdue', days: -days };
  if (days === 0) return { kind: 'today', days: 0 };
  return { kind: 'soon', days };
}

/* ------------------------------------------------------------------ contact */

/**
 * A phone number made safe for a tel:/sms: link: digits, with a leading +
 * kept. Spaces, dashes and brackets ("0917 123-4567") are dropped. Returns
 * null when there is nothing dialable.
 */
export function dialable(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

export function telHref(phone: string | null | undefined): string | null {
  const n = dialable(phone);
  return n ? `tel:${n}` : null;
}

/**
 * An sms: link that opens the phone's own messaging app with the text filled
 * in. `?&body=` is the form both Android and iOS accept.
 */
export function smsHref(phone: string | null | undefined, body: string): string | null {
  const n = dialable(phone);
  return n ? `sms:${n}?&body=${encodeURIComponent(body)}` : null;
}
