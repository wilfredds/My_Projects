import type { Metadata } from "next";
import Link from "next/link";

import { requireStaff } from "@/lib/auth/session";
import { unliPackages } from "@/lib/menu";
import { getDashboard } from "@/lib/reservations/dashboard";
import {
  STATUS_LABELS,
  canSeeContacts,
  canSeeSummary,
  formatTime,
  shiftDate,
} from "@/lib/reservations/status";
import { todayInRestaurantTimezone } from "@/lib/reservation";
import type { ReservationStatus, StaffReservation } from "@/lib/supabase/types";

import { signOutAction } from "../actions";
import { StatusControls } from "./status-controls";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const packageNames = new Map(unliPackages.map((p) => [p.id, p.name]));

const statusStyles: Record<ReservationStatus, string> = {
  pending: "bg-gold/20 text-gold-deep border-gold/40",
  confirmed: "bg-sumi text-gold border-sumi",
  seated: "bg-lacquer text-paper border-lacquer",
  cancelled: "bg-paper-edge/60 text-sumi-muted border-paper-edge line-through",
};

export default async function DashboardPage({ searchParams }: PageProps<"/portal/dashboard">) {
  const staff = await requireStaff("/portal/dashboard");
  const { profile } = staff;

  const params = await searchParams;
  const requested = typeof params.date === "string" ? params.date : null;
  const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
    ? requested
    : todayInRestaurantTimezone();

  const { reservations, summary, error } = await getDashboard(date);
  const today = todayInRestaurantTimezone();

  return (
    <main className="mx-auto w-full max-w-6xl grow px-5 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-paper-edge pb-8">
        <div>
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-lacquer">
            Bookings
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-sumi">
            {date === today ? "Today" : formatDate(date)}
          </h1>
          <p className="mt-2 text-sm text-sumi-muted">
            {profile.full_name ?? staff.email} ·{" "}
            <span className="rounded-full bg-sumi px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-gold">
              {profile.role}
            </span>
          </p>
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-full border border-sumi/20 px-5 py-2.5 text-sm font-semibold text-sumi transition-colors hover:border-lacquer hover:text-lacquer"
          >
            Sign out
          </button>
        </form>
      </header>

      <nav aria-label="Choose a day" className="mt-6 flex flex-wrap items-center gap-2 text-sm">
        <DayLink date={shiftDate(date, -1)} label="← Previous" />
        <DayLink date={today} label="Today" current={date === today} />
        <DayLink date={shiftDate(date, 1)} label="Next →" />
      </nav>

      {canSeeSummary(profile.role) ? (
        <section aria-label="Daily summary" className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-paper-edge bg-paper-edge sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Covers" value={summary.covers} hint="guests expected" />
          <SummaryTile label="Bookings" value={summary.bookings} hint="cancellations excluded" />
          <SummaryTile label="Pending" value={summary.pending} hint="waiting on a reply" />
          <SummaryTile label="Seated" value={summary.seated} hint="eating now" />
        </section>
      ) : null}

      {error ? (
        <p className="mt-8 rounded-lg border border-lacquer bg-lacquer/10 px-4 py-3 text-sm text-sumi">
          {error}
        </p>
      ) : null}

      {!error && reservations.length === 0 ? (
        <p className="mt-12 rounded-2xl border border-dashed border-paper-edge px-6 py-14 text-center text-sm text-sumi-muted">
          No bookings for {formatDate(date)} yet.
        </p>
      ) : null}

      {reservations.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {reservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              role={profile.role}
            />
          ))}
        </ul>
      ) : null}

      <p className="mt-10 text-xs leading-relaxed text-sumi-muted">
        Which buttons you can see is decided by this page. Which changes actually save is decided
        by Row Level Security in Postgres — so a hidden button is a convenience, not a permission.
        {canSeeContacts(profile.role)
          ? " You can see full contact numbers because your role may."
          : " Contact numbers are masked before they leave the database, so this page never receives them."}
      </p>
    </main>
  );
}

function ReservationCard({
  reservation,
  role,
}: {
  reservation: StaffReservation;
  role: "crew" | "host" | "owner";
}) {
  const pkg = reservation.package ? packageNames.get(reservation.package) : null;

  return (
    <li className="rounded-2xl border border-paper-edge bg-white/50 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-xl font-semibold text-sumi">{reservation.name}</h2>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${statusStyles[reservation.status]}`}
            >
              {STATUS_LABELS[reservation.status]}
            </span>
          </div>

          <dl className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-sumi-muted">
            <div className="flex gap-1.5">
              <dt className="sr-only">Time</dt>
              <dd className="font-medium text-sumi">{formatTime(reservation.reserve_time)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Party</dt>
              <dd className="font-medium text-sumi">{reservation.party_size}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Contact</dt>
              <dd className="font-medium text-sumi">
                {reservation.contact_visible ? (
                  <a
                    href={`tel:${reservation.contact.replace(/[^\d+]/g, "")}`}
                    className="text-lacquer underline underline-offset-4"
                  >
                    {reservation.contact}
                  </a>
                ) : (
                  <span title="Masked for your role">{reservation.contact}</span>
                )}
              </dd>
            </div>
            {pkg ? (
              <div className="flex gap-1.5">
                <dt>Set</dt>
                <dd className="font-medium text-sumi">{pkg}</dd>
              </div>
            ) : null}
          </dl>

          {reservation.notes ? (
            <p className="mt-3 max-w-prose rounded-lg bg-paper-warm/70 px-3 py-2 text-sm text-sumi-soft">
              {reservation.notes}
            </p>
          ) : null}
        </div>

        <div className="shrink-0">
          <StatusControls id={reservation.id} status={reservation.status} role={role} />
        </div>
      </div>
    </li>
  );
}

function SummaryTile({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="bg-paper-warm px-5 py-6">
      <p className="text-[0.68rem] uppercase tracking-[0.18em] text-sumi-muted">{label}</p>
      <p className="mt-1.5 font-display text-4xl font-semibold text-lacquer">{value}</p>
      <p className="mt-0.5 text-xs text-sumi-muted">{hint}</p>
    </div>
  );
}

function DayLink({ date, label, current }: { date: string; label: string; current?: boolean }) {
  return (
    <Link
      href={`/portal/dashboard?date=${date}`}
      className={`rounded-full border px-4 py-1.5 font-medium transition-colors ${
        current
          ? "border-lacquer bg-lacquer text-paper"
          : "border-paper-edge text-sumi-muted hover:border-lacquer hover:text-lacquer"
      }`}
    >
      {label}
    </Link>
  );
}

function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, m! - 1, d!)));
}
