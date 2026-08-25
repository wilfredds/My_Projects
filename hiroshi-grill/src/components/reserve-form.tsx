"use client";

import { useId, useState, useSyncExternalStore } from "react";

import { unliPackages } from "@/lib/menu";
import { TURNSTILE_FIELD } from "@/lib/turnstile";
import { TurnstileWidget } from "./turnstile-widget";
import {
  latestBookableDate,
  todayInRestaurantTimezone,
  validateReservation,
  type ReservationErrors,
  type ReservationField,
  type ReservationFormValues,
} from "@/lib/reservation";

const emptyForm: ReservationFormValues = {
  name: "",
  contact: "",
  reserveDate: "",
  reserveTime: "18:00",
  partySize: "2",
  package: "",
  notes: "",
  website: "",
};

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "failed"; message: string };

/**
 * A Turnstile token is single use. If a submit fails for any reason, the token
 * that came with it is spent — so the widget has to be reset or the guest's
 * next attempt is refused with "timeout-or-duplicate", which looks to them like
 * the form is simply broken.
 */
function resetTurnstile() {
  const turnstile = (window as unknown as { turnstile?: { reset: () => void } }).turnstile;
  turnstile?.reset();
}

/** No-op subscribe: the booking window never changes while the tab is open. */
const noopSubscribe = () => () => {};

/**
 * The earliest and latest date the picker will accept.
 *
 * This deliberately renders as *nothing* on the server and the real dates in
 * the browser. The page is statically generated, so a date computed during
 * render would be baked into the HTML at build time and be wrong by tomorrow
 * morning — the picker would happily offer yesterday.
 *
 * `useSyncExternalStore` is the supported way to say "server and client render
 * different things here, on purpose": it takes a separate server snapshot, so
 * React never reports a hydration mismatch. The snapshot is returned as one
 * string because React compares snapshots with Object.is, and a fresh object
 * every render would loop forever.
 */
function useBookingWindow() {
  const snapshot = useSyncExternalStore(
    noopSubscribe,
    () => `${todayInRestaurantTimezone()}|${latestBookableDate()}`,
    () => "|",
  );
  const [min, max] = snapshot.split("|");
  return { min, max };
}

export function ReserveForm({ turnstileSiteKey }: { turnstileSiteKey?: string }) {
  const formId = useId();
  const [form, setForm] = useState<ReservationFormValues>(emptyForm);
  const [errors, setErrors] = useState<ReservationErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const bookingWindow = useBookingWindow();

  function update(field: ReservationField, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear a field's error as soon as the guest starts fixing it.
    setErrors((prev) => (field in prev ? { ...prev, [field]: undefined } : prev));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    /* Cloudflare's script writes a hidden input into this form. We submit as
       JSON rather than a native form POST, so it has to be read out by hand
       instead of arriving in the FormData. */
    const widgetToken =
      (event.currentTarget.elements.namedItem(TURNSTILE_FIELD) as HTMLInputElement | null)
        ?.value ?? "";

    /* This check is for the guest's benefit — instant, friendly feedback. It is
       NOT what keeps bad data out of the database: anyone can skip it entirely
       by POSTing to the API directly. The server re-runs this exact same schema
       on the payload it receives, and that run is the one that counts. */
    const result = validateReservation(form);
    if (!result.ok) {
      setErrors(result.errors);
      setStatus({ kind: "idle" });
      return;
    }

    setErrors({});
    setStatus({ kind: "sending" });

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, [TURNSTILE_FIELD]: widgetToken }),
      });

      if (response.ok) {
        setForm(emptyForm);
        setStatus({ kind: "sent" });
        return;
      }

      /* The server re-ran the same schema and disagreed with us. That should be
         impossible after the check above — but it is exactly what happens if
         the guest leaves the tab open past midnight and their chosen date
         quietly becomes yesterday. Show the server's verdict; it is the one
         that decides. */
      if (response.status === 400) {
        const payload = (await response.json()) as {
          errors?: ReservationErrors & { captcha?: string };
        };
        const { captcha, ...fieldErrors } = payload.errors ?? {};
        setErrors(fieldErrors);
        setStatus(captcha ? { kind: "failed", message: captcha } : { kind: "idle" });
        resetTurnstile();
        return;
      }

      resetTurnstile();

      if (response.status === 429) {
        setStatus({
          kind: "failed",
          message:
            "That is a lot of requests in a short time. Please wait a few minutes, or give us a call.",
        });
        return;
      }

      setStatus({
        kind: "failed",
        message: "We could not save that request. Please try again, or give us a call.",
      });
    } catch {
      resetTurnstile();
      /* fetch itself failed — no network, or the request never landed. */
      setStatus({
        kind: "failed",
        message: "We could not reach the restaurant. Please check your connection, or call us.",
      });
    }
  }

  const field = (name: ReservationField) => ({
    id: `${formId}-${name}`,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${formId}-${name}-error` : undefined,
  });

  const inputClass =
    "w-full rounded-lg border border-paper-edge bg-white/70 px-3.5 py-2.5 text-sumi placeholder:text-sumi-muted/60 focus:border-lacquer focus:outline-none aria-[invalid]:border-lacquer";

  return (
    <section id="reserve" className="scroll-mt-20 border-b border-paper-edge/70 py-20 sm:py-24">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="flex items-center gap-3 text-[0.68rem] font-medium uppercase tracking-[0.24em] text-lacquer">
            Reservations
            <span aria-hidden className="h-px w-10 bg-gold" />
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-sumi sm:text-5xl">
            Request a table.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-sumi-muted">
            Send us the details and our host will confirm by text. A request is not yet a
            confirmed booking — wait for our reply before heading over.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-sumi-soft">
            {[
              "We hold requested tables for 15 minutes past your time.",
              "Parties over 30 need a call so we can plan the room.",
              "Walk-ins are always welcome when there is space.",
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
                <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-gold" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-paper-edge bg-paper-warm/70 p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" error={errors.name} errorId={`${formId}-name-error`} htmlFor={`${formId}-name`}>
              <input
                {...field("name")}
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className={inputClass}
                placeholder="Juan dela Cruz"
              />
            </Field>

            <Field
              label="Mobile number"
              error={errors.contact}
              errorId={`${formId}-contact-error`}
              htmlFor={`${formId}-contact`}
            >
              <input
                {...field("contact")}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.contact}
                onChange={(e) => update("contact", e.target.value)}
                className={inputClass}
                placeholder="0917 123 4567"
              />
            </Field>

            <Field label="Date" error={errors.reserveDate} errorId={`${formId}-reserveDate-error`} htmlFor={`${formId}-reserveDate`}>
              <input
                {...field("reserveDate")}
                type="date"
                min={bookingWindow.min || undefined}
                max={bookingWindow.max || undefined}
                value={form.reserveDate}
                onChange={(e) => update("reserveDate", e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Time" error={errors.reserveTime} errorId={`${formId}-reserveTime-error`} htmlFor={`${formId}-reserveTime`}>
              <input
                {...field("reserveTime")}
                type="time"
                value={form.reserveTime}
                onChange={(e) => update("reserveTime", e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field
              label="Party size"
              error={errors.partySize}
              errorId={`${formId}-partySize-error`}
              htmlFor={`${formId}-partySize`}
            >
              <input
                {...field("partySize")}
                type="number"
                min={1}
                max={30}
                value={form.partySize}
                onChange={(e) => update("partySize", e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Set" hint="optional" htmlFor={`${formId}-package`}>
              <select
                {...field("package")}
                value={form.package}
                onChange={(e) => update("package", e.target.value)}
                className={inputClass}
              >
                <option value="">No preference</option>
                {unliPackages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-5">
            <Field
              label="Notes"
              hint="optional"
              error={errors.notes}
              errorId={`${formId}-notes-error`}
              htmlFor={`${formId}-notes`}
            >
              <textarea
                {...field("notes")}
                rows={3}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                className={`${inputClass} resize-y`}
                placeholder="Birthday celebration, need a high chair, allergic to shellfish…"
              />
            </Field>
          </div>

          {/*
            Honeypot. Hidden from sighted users by position, and from assistive
            tech by aria-hidden + tabIndex -1, so no real guest can fill it in.
            Automated form-fillers fill everything they can parse, so anything
            arriving in here marks the request as a bot.

            It is deliberately named "website" — a plausible-looking name a bot
            will want to complete. Never hide it with `display:none`; the better
            bots skip those.
          */}
          <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
            <label htmlFor={`${formId}-website`}>Website</label>
            <input
              id={`${formId}-website`}
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
            />
          </div>

          <TurnstileWidget siteKey={turnstileSiteKey} />

          <button
            type="submit"
            disabled={status.kind === "sending"}
            className="mt-7 w-full rounded-full bg-lacquer px-6 py-3 text-sm font-semibold text-paper transition-colors hover:bg-lacquer-deep disabled:opacity-60"
          >
            {status.kind === "sending" ? "Sending…" : "Send request"}
          </button>

          {/* Status is announced politely so a screen reader hears the outcome
              without the focus being yanked away from the button. */}
          <div aria-live="polite" className="mt-4 empty:mt-0">
            {status.kind === "sent" ? (
              <p className="rounded-lg border border-lacquer/30 bg-lacquer/5 px-4 py-3 text-sm text-sumi-soft">
                Request received. Our host will text you to confirm — please wait for that reply
                before heading over.
              </p>
            ) : null}
            {status.kind === "failed" ? (
              <p className="rounded-lg border border-lacquer bg-lacquer/10 px-4 py-3 text-sm text-sumi">
                {status.message}
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  errorId,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  errorId?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-sumi">
        {label}
        {hint ? <span className="text-xs font-normal text-sumi-muted">({hint})</span> : null}
      </label>
      {children}
      {error && errorId ? (
        <p id={errorId} className="mt-1.5 text-sm text-lacquer">
          {error}
        </p>
      ) : null}
    </div>
  );
}
