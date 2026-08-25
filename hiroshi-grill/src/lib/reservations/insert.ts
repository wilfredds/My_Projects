import "server-only";

import type { ReservationPayload } from "../reservation";
import { createClient } from "../supabase/server";

/**
 * Writes a booking request.
 *
 * This uses the ordinary anon-key client, NOT `createAdminClient()`, and that
 * is the whole point. The insert is judged by the "public can request" policy,
 * which carries `with check (status = 'pending')` — so the database itself
 * guarantees a request cannot arrive pre-confirmed, no matter what this code
 * does or what a future edit to it does.
 *
 * Switching to the service-role client would make the query "simpler" by
 * skipping all of that, and would move the guarantee from Postgres back into
 * this file, where it is only as good as whoever edits it next.
 *
 * `status` is not sent at all: the column defaults to 'pending', which is the
 * only value the policy accepts.
 */
export async function insertReservation(payload: ReservationPayload): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("reservations").insert({
    name: payload.name,
    contact: payload.contact,
    reserve_date: payload.reserveDate,
    reserve_time: payload.reserveTime,
    party_size: payload.partySize,
    package: payload.package,
    notes: payload.notes ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}
