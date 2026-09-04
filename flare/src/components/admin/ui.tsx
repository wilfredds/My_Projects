import type { ReactNode } from "react";

/**
 * Shared pieces for the admin surface.
 *
 * The admin side is internal tooling for BFP staff, so it is built for
 * density and scanning rather than for the gradients and glass panels of the
 * learner-facing design. It still draws every colour from FLARE's tokens, so
 * the two read as one product and both themes work.
 */

export function PageHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6 overflow-hidden rounded border border-border bg-surface">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** Tables scroll inside their own container so the page never scrolls sideways. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-sm text-muted">{children}</p>;
}

type Tone = "neutral" | "success" | "warning" | "danger";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-border text-muted",
  success: "border-success/40 text-success",
  warning: "border-warning/40 text-warning",
  danger: "border-danger/40 text-danger",
};

/** State as shape and colour, so a status reads without being read. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatTile({ label, value, tone = "neutral" }: { label: string; value: number; tone?: Tone }) {
  const emphasis = tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded border border-border bg-surface px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${emphasis}`}>{value}</div>
    </div>
  );
}
