import { z } from "zod";

import { unliPackages } from "./menu.ts";

/**
 * ONE schema, used in two places, for two different reasons.
 *
 *   - The browser imports it to show friendly errors as the guest types.
 *     That is **UX**. It can be bypassed by anyone with dev tools open.
 *   - The API route (milestone 3) imports the exact same schema and re-parses
 *     the request body on the server. That is **security**. It is the only one
 *     of the two that actually protects the database.
 *
 * Sharing the definition means the two can never drift apart, which is the
 * usual way "validated" forms end up accepting garbage.
 */

/** How far ahead the restaurant takes bookings. */
export const MAX_DAYS_AHEAD = 90;

/** The dining room's timezone. Never trust the visitor's clock for this. */
export const RESTAURANT_TIMEZONE = "Asia/Manila";

/**
 * Today's date in the restaurant's timezone, as `YYYY-MM-DD`.
 *
 * Using `new Date()` directly would give us the *server's* idea of today —
 * which on Vercel is UTC. At 9pm in Manila, UTC is still on the previous day,
 * so a naive check would reject tonight's booking as "in the past".
 */
export function todayInRestaurantTimezone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RESTAURANT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The last date we accept a booking for, as `YYYY-MM-DD`. */
export function latestBookableDate(now: Date = new Date()): string {
  const horizon = new Date(now.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000);
  return todayInRestaurantTimezone(horizon);
}

const packageIds = unliPackages.map((p) => p.id);

export const reservationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please give us a name for the booking.")
    .max(80, "That name is longer than we can store."),

  /* Kept deliberately loose. Filipino guests write numbers as 0917 123 4567,
     +63 917 123 4567 or (046) 123-4567 — a stricter regex would reject real
     customers, and the goal here is to block junk, not to police formatting. */
  contact: z
    .string()
    .trim()
    .min(7, "Please give a number we can reach you on.")
    .max(32, "That number looks too long.")
    .regex(/^[0-9+()\s-]+$/, "Use digits, spaces, +, - or ( ) only."),

  reserveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.")
    .refine((value) => value >= todayInRestaurantTimezone(), {
      message: "That date has already passed.",
    })
    .refine((value) => value <= latestBookableDate(), {
      message: `We only take bookings up to ${MAX_DAYS_AHEAD} days ahead.`,
    }),

  reserveTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time."),

  partySize: z.coerce
    .number()
    .int("Whole people only, please.")
    .min(1, "At least one guest.")
    .max(30, "For parties over 30, please call us so we can plan the room."),

  /* An empty select posts "" — treat that as "no preference" rather than an
     error, but reject anything that is neither empty nor a real package id.
     This is the pattern that stops someone hand-crafting a request with
     `package: "<script>…"` and getting it stored. */
  package: z
    .union([z.literal(""), z.enum(packageIds as [string, ...string[]])])
    .optional()
    .transform((value) => (value ? value : null)),

  notes: z.string().trim().max(500, "Please keep notes under 500 characters.").optional(),

  /**
   * Honeypot. A real guest never sees this field, so a real guest never fills
   * it in. Bots fill every input they find.
   *
   * `.trim()` before `.max(0)` so that whitespace counts as empty. The API
   * route decides what to do about a filled honeypot — it accepts the request
   * with a cheerful 201 and silently drops it, so the bot learns nothing — and
   * it makes that call by trimming too. These two had to agree on what "empty"
   * means, and they did not: the schema rejected "   " with a 400 while the
   * route waved it through as a real guest. A test caught the disagreement.
   */
  website: z.string().trim().max(0).optional(),
});

/** What the schema hands back once it has parsed and coerced everything. */
export type ReservationPayload = z.output<typeof reservationSchema>;

/**
 * What the *form* holds. Every HTML input gives you a string — even
 * `<input type="number">` — so the form state is all strings and the schema's
 * `z.coerce.number()` does the converting. Modelling it honestly here keeps the
 * "is partySize a string or a number?" confusion out of the component.
 */
export type ReservationFormValues = {
  name: string;
  contact: string;
  reserveDate: string;
  reserveTime: string;
  partySize: string;
  package: string;
  notes: string;
  website: string;
};

export type ReservationField = keyof ReservationFormValues;

/** Field-keyed error messages, e.g. `{ name: "Please give us a name…" }`. */
export type ReservationErrors = Partial<Record<ReservationField, string>>;

/**
 * Runs the schema and flattens Zod's error tree into one message per field,
 * which is all a form needs to render.
 */
export function validateReservation(
  input: unknown,
): { ok: true; data: ReservationPayload } | { ok: false; errors: ReservationErrors } {
  const result = reservationSchema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  const errors: ReservationErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field as ReservationField] = issue.message;
    }
  }
  return { ok: false, errors };
}
