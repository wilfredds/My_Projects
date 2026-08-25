import { z } from "zod";

import type { ReservationStatus, StaffReservation, StaffRole } from "../supabase/types.ts";

/**
 * What each role may do to a booking — the UI's copy of the rules.
 *
 * READ THIS BEFORE TRUSTING IT.
 *
 * Nothing in this file enforces anything. It decides which buttons to draw. The
 * actual permission lives in the RLS policies in `supabase/schema.sql`, where
 * Postgres refuses the write regardless of what any button did or did not
 * render. A crew member who forges a "cancel" request with dev tools open gets
 * a refusal from the database, not from here.
 *
 * So this is a *mirror* of the policy, and mirrors drift. The tests in
 * `tests/reservation-status.test.ts` pin this to what the policies actually do,
 * so that if someone changes the SQL and not this file, the disagreement shows
 * up as a red test rather than as a button that throws an error when clicked.
 */

export const ALL_STATUSES: ReservationStatus[] = ["pending", "confirmed", "seated", "cancelled"];

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  seated: "Seated",
  cancelled: "Cancelled",
};

/** The verb on the button, which reads better than the noun. */
export const STATUS_ACTIONS: Record<ReservationStatus, string> = {
  pending: "Reopen",
  confirmed: "Confirm",
  seated: "Seat",
  cancelled: "Cancel",
};

/**
 * The statuses `role` may move a booking currently at `current` into.
 *
 * Crew mirrors the "crew can advance status" policy exactly:
 *   using      — the row must not already be cancelled
 *   with check — the new status must be 'confirmed' or 'seated'
 *
 * which together mean crew move bookings forward, cannot cancel one, and cannot
 * reopen one that a host has cancelled.
 */
export function allowedStatusesFor(
  role: StaffRole,
  current: ReservationStatus,
): ReservationStatus[] {
  if (role === "crew") {
    if (current === "cancelled") return [];
    return (["confirmed", "seated"] as ReservationStatus[]).filter((s) => s !== current);
  }

  /* Host and owner: anything, including cancelling and reopening. */
  return ALL_STATUSES.filter((s) => s !== current);
}

export function canSeeContacts(role: StaffRole): boolean {
  return role === "host" || role === "owner";
}

export function canSeeSummary(role: StaffRole): boolean {
  return role === "owner";
}

export type DaySummary = {
  /** Guests expected — party sizes of bookings that are on, not cancelled. */
  covers: number;
  /** Requests still waiting on a host. */
  pending: number;
  /** Tables currently eating. */
  seated: number;
  /** Bookings on the books, cancellations excluded. */
  bookings: number;
};

/**
 * The owner's tiles, computed from rows the caller already has.
 *
 * Worth being honest about what this is and is not. Hiding these tiles from
 * crew is cosmetic: every staff role can already read the reservations, so a
 * crew member could add the numbers up by hand. The tiles are an owner
 * convenience, not a permission boundary.
 *
 * The real column-level protection in this dashboard is the contact masking,
 * and that one is genuine — it happens in SQL, so a crew session never receives
 * the digits at all.
 */
export function summarise(reservations: Pick<StaffReservation, "status" | "party_size">[]): DaySummary {
  const live = reservations.filter((r) => r.status !== "cancelled");

  return {
    covers: live.reduce((total, r) => total + r.party_size, 0),
    pending: reservations.filter((r) => r.status === "pending").length,
    seated: reservations.filter((r) => r.status === "seated").length,
    bookings: live.length,
  };
}

/** "18:30:00" from Postgres, "6:30 PM" for a human. */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = Number(hours);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

/** Adds days to a `YYYY-MM-DD` string without tripping over timezones. */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  /* Date.UTC keeps this arithmetic in UTC, so a machine in Manila and a server
     in UTC agree on what "tomorrow" is. Using `new Date(y, m-1, d)` would use
     the server's local timezone and could shift the answer by a day. */
  const shifted = new Date(Date.UTC(y!, m! - 1, d! + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * What the dashboard's status-change action accepts.
 *
 * `z.guid()` rather than `z.uuid()`, and the difference is not cosmetic. Zod 4's
 * `z.uuid()` enforces the RFC 9562 version and variant bits, so it rejects a
 * perfectly well-formed identifier whose version nibble is not 1–8. Postgres
 * `gen_random_uuid()` emits v4 and passes — but the id here comes from our own
 * database, and any row seeded by a fixture, an import or an older migration
 * with a non-v4 uuid gets refused with "that request did not make sense", which
 * is a maddening thing to debug. Every button on that row simply stops working.
 *
 * This endpoint's job is to reject nonsense, not to police uuid versions.
 */
export const statusChangeSchema = z.object({
  id: z.guid("That booking id is not valid."),
  status: z.enum(["pending", "confirmed", "seated", "cancelled"]),
});
