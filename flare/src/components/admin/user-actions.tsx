"use client";

import { useState, useTransition } from "react";
import { updateUserRole, updateUserStatus } from "@/app/admin/users/actions";
import type { UserRole, UserStatus } from "@/lib/types";

/**
 * The buttons on a row in the accounts table.
 *
 * A refused action is shown in place rather than thrown away: the refusals
 * that matter — "you cannot suspend your own account", "this is the only
 * administrator" — are things the administrator needs to read and act on,
 * not silent no-ops.
 */
export function UserRowActions({
  uid,
  status,
  role,
}: {
  uid: string;
  status: UserStatus;
  role: UserRole;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "That did not work.");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        {status === "pending" && (
          <>
            <Button busy={pending} variant="primary" onClick={() => run(() => updateUserStatus(uid, "active"))}>
              Approve
            </Button>
            <Button busy={pending} onClick={() => run(() => updateUserStatus(uid, "suspended"))}>
              Reject
            </Button>
          </>
        )}

        {status === "active" && (
          <>
            <Button busy={pending} onClick={() => run(() => updateUserRole(uid, role === "admin" ? "learner" : "admin"))}>
              {role === "admin" ? "Remove admin" : "Make admin"}
            </Button>
            <Button busy={pending} onClick={() => run(() => updateUserStatus(uid, "suspended"))}>
              Suspend
            </Button>
          </>
        )}

        {status === "suspended" && (
          <Button busy={pending} variant="primary" onClick={() => run(() => updateUserStatus(uid, "active"))}>
            Reinstate
          </Button>
        )}
      </div>

      {error && <p className="max-w-xs text-right text-xs text-danger">{error}</p>}
    </div>
  );
}

function Button({
  children,
  onClick,
  busy,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  variant?: "default" | "primary";
}) {
  const style =
    variant === "primary"
      ? "bg-accent text-accent-foreground border-accent"
      : "bg-surface text-foreground border-border hover:border-muted";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`rounded border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${style}`}
    >
      {children}
    </button>
  );
}
