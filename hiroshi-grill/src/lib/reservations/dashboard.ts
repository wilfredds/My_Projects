import "server-only";

import { createClient } from "../supabase/server";
import type { StaffReservation } from "../supabase/types";
import { summarise, type DaySummary } from "./status";

export type DashboardData = {
  reservations: StaffReservation[];
  summary: DaySummary;
  error: string | null;
};

/**
 * Today's bookings for the staff dashboard.
 *
 * Two things about this query are load-bearing.
 *
 * It reads `staff_reservations`, not `reservations`. The view is where phone
 * numbers get masked for crew, in SQL — so a crew session never receives the
 * digits, not even in a payload the UI chooses not to render. Selecting from
 * the base table here would put every guest's number into the HTML of a page
 * that merely declines to display it, which is not the same thing at all.
 *
 * And it uses the ordinary anon-key client carrying the caller's session, so
 * Row Level Security answers it. There is no `role` parameter anywhere in this
 * function, and that is the point: we do not ask the database for "what crew
 * may see", we ask for the reservations and the database returns what THIS
 * caller may see. A bug in our role handling cannot widen that.
 */
export async function getDashboard(date: string): Promise<DashboardData> {
  const empty: DashboardData = {
    reservations: [],
    summary: summarise([]),
    error: null,
  };

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("staff_reservations")
      .select("*")
      .eq("reserve_date", date)
      .order("reserve_time", { ascending: true });

    if (error) {
      console.error("[dashboard] could not load reservations:", error.message);
      return { ...empty, error: "Could not load today's bookings. Please refresh." };
    }

    const reservations = data ?? [];
    return { reservations, summary: summarise(reservations), error: null };
  } catch (error) {
    console.error("[dashboard] could not load reservations:", error);
    return { ...empty, error: "Could not load today's bookings. Please refresh." };
  }
}
