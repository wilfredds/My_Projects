"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/session";
import { statusChangeSchema } from "@/lib/reservations/status";
import { createClient } from "@/lib/supabase/server";

/**
 * Change a booking's status.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FUNCTION DELIBERATELY DOES NOT DO
 * ---------------------------------------------------------------------------
 * It does not check whether the caller's role is allowed to make this change.
 *
 * That looks like an omission and is the opposite. A server action is a public
 * HTTP endpoint — anyone who can reach the portal can invoke it with any
 * arguments, whether or not the UI ever drew the button. So an `if (role ===
 * 'crew') reject` here would be a second implementation of a rule that already
 * exists in `supabase/schema.sql`, and two implementations of one rule drift
 * apart. When they do, the one in the database wins and the one here is a lie.
 *
 * Instead we issue the UPDATE and let Postgres answer. If crew tries to cancel:
 *
 *   · the "crew can advance status" policy's `with check` omits 'cancelled',
 *     so the write is refused outright, and
 *   · the trigger stops them touching any column but the status anyway.
 *
 * The `.select()` on the end is what makes the refusal visible: an update
 * blocked by a policy's `using` clause is not an error, it simply matches zero
 * rows. No rows back means "you were not allowed to do that".
 *
 * We still call requireStaff() first — not to decide the permission, but so a
 * logged-out request gets a redirect instead of a confusing empty result.
 */

export type StatusState = { error: string | null; okAt: number | null };

export async function changeStatusAction(
  _previous: StatusState,
  formData: FormData,
): Promise<StatusState> {
  await requireStaff();

  const parsed = statusChangeSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: "That request did not make sense. Please refresh.", okAt: null };
  }

  const { id, status } = parsed.data;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("reservations")
      .update({ status })
      .eq("id", id)
      .select("id");

    if (error) {
      /* 42501 is Postgres for insufficient_privilege — a `with check` said no.
         Everything else is a real fault worth logging as one. */
      const refused = error.code === "42501";
      if (!refused) console.error("[dashboard] status change failed:", error.message);

      return {
        error: refused
          ? "Your role cannot make that change. Ask the host."
          : "That change did not save. Please try again.",
        okAt: null,
      };
    }

    if (!data || data.length === 0) {
      /* Zero rows: either the booking is gone, or a `using` clause hid it from
         this caller. We cannot tell which, and saying so precisely would leak
         whether the row exists — so one message covers both. */
      return { error: "Your role cannot make that change. Ask the host.", okAt: null };
    }

    /* Redraw the day's list so everyone's next load reflects the change. */
    revalidatePath("/portal/dashboard");
    return { error: null, okAt: Date.now() };
  } catch (error) {
    console.error("[dashboard] status change threw:", error);
    return { error: "That change did not save. Please try again.", okAt: null };
  }
}
