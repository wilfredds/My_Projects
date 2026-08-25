"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { STATUS_ACTIONS, allowedStatusesFor } from "@/lib/reservations/status";
import type { ReservationStatus, StaffRole } from "@/lib/supabase/types";

import { changeStatusAction, type StatusState } from "./actions";

const initialState: StatusState = { error: null, okAt: null };

/**
 * The buttons on one booking.
 *
 * `allowedStatusesFor` decides which ones to draw, and that is a *presentation*
 * decision — the database decides whether the change actually happens. If the
 * two ever disagree, the button will render and then report that the change was
 * refused, which is exactly the right failure: visibly wrong, not silently
 * permitted.
 */
export function StatusControls({
  id,
  status,
  role,
}: {
  id: string;
  status: ReservationStatus;
  role: StaffRole;
}) {
  const [state, formAction] = useActionState(changeStatusAction, initialState);
  const options = allowedStatusesFor(role, status);

  if (options.length === 0) {
    return <p className="text-xs text-sumi-muted">No actions for your role.</p>;
  }

  return (
    <div>
      <form action={formAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="id" value={id} />

        {options.map((next) => (
          <StatusButton key={next} next={next} />
        ))}
      </form>

      <div aria-live="polite">
        {state.error ? <p className="mt-2 text-xs text-lacquer">{state.error}</p> : null}
      </div>
    </div>
  );
}

function StatusButton({ next }: { next: ReservationStatus }) {
  const { pending } = useFormStatus();
  const destructive = next === "cancelled";

  return (
    <button
      type="submit"
      name="status"
      value={next}
      disabled={pending}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
        destructive
          ? "border border-lacquer/40 text-lacquer hover:bg-lacquer hover:text-paper"
          : "bg-sumi text-paper hover:bg-sumi-soft"
      }`}
    >
      {STATUS_ACTIONS[next]}
    </button>
  );
}
