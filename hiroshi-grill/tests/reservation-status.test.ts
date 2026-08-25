import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  ALL_STATUSES,
  allowedStatusesFor,
  canSeeContacts,
  canSeeSummary,
  formatTime,
  shiftDate,
  statusChangeSchema,
  summarise,
} from "../src/lib/reservations/status.ts";
import type { ReservationStatus, StaffRole } from "../src/lib/supabase/types.ts";

/**
 * These tests pin the DASHBOARD's idea of what each role may do to what the RLS
 * policies actually do.
 *
 * The policies themselves are tested separately, in `supabase/verify-rls.sql`
 * against a real Postgres. What this file guards against is the two drifting:
 * change the SQL without changing `status.ts` and the dashboard starts drawing
 * a button that the database will refuse. Nothing breaks security when that
 * happens — the database still says no — but staff get an error where they
 * expected an action, which is its own kind of bug.
 */

const roles: StaffRole[] = ["crew", "host", "owner"];

describe("crew mirrors the 'crew can advance status' policy", () => {
  // The policy, restated:
  //   using      (status in ('pending','confirmed','seated'))
  //   with check (status in ('confirmed','seated'))

  test("can confirm a pending booking", () => {
    assert.ok(allowedStatusesFor("crew", "pending").includes("confirmed"));
  });

  test("can seat a confirmed booking", () => {
    assert.ok(allowedStatusesFor("crew", "confirmed").includes("seated"));
  });

  test("is never offered cancel, from any status", () => {
    for (const status of ALL_STATUSES) {
      assert.ok(
        !allowedStatusesFor("crew", status).includes("cancelled"),
        `crew should never be offered cancel from ${status}`,
      );
    }
  });

  test("is never offered reopen, because 'pending' is not in the with check", () => {
    for (const status of ALL_STATUSES) {
      assert.ok(
        !allowedStatusesFor("crew", status).includes("pending"),
        `crew should never be offered reopen from ${status}`,
      );
    }
  });

  test("gets no actions at all on a cancelled booking", () => {
    // The `using` clause excludes cancelled rows, so crew cannot even see one
    // as updatable — they must not be offered a way to resurrect it.
    assert.deepEqual(allowedStatusesFor("crew", "cancelled"), []);
  });
});

describe("host and owner mirror the 'host owner manage' policy", () => {
  for (const role of ["host", "owner"] as StaffRole[]) {
    test(`${role} can cancel from any live status`, () => {
      for (const status of ["pending", "confirmed", "seated"] as ReservationStatus[]) {
        assert.ok(
          allowedStatusesFor(role, status).includes("cancelled"),
          `${role} should be able to cancel a ${status} booking`,
        );
      }
    });

    test(`${role} can reopen a cancelled booking`, () => {
      assert.ok(allowedStatusesFor(role, "cancelled").includes("pending"));
    });
  }
});

describe("every role", () => {
  for (const role of roles) {
    test(`${role} is never offered the status a booking is already in`, () => {
      for (const status of ALL_STATUSES) {
        assert.ok(
          !allowedStatusesFor(role, status).includes(status),
          `${role} should not be offered ${status} when already ${status}`,
        );
      }
    });

    test(`${role} is only ever offered real statuses`, () => {
      for (const status of ALL_STATUSES) {
        for (const offered of allowedStatusesFor(role, status)) {
          assert.ok(ALL_STATUSES.includes(offered), `${offered} is not a real status`);
        }
      }
    });
  }
});

describe("who sees what", () => {
  test("crew does not see contacts; host and owner do", () => {
    assert.equal(canSeeContacts("crew"), false);
    assert.equal(canSeeContacts("host"), true);
    assert.equal(canSeeContacts("owner"), true);
  });

  test("only the owner sees the summary tiles", () => {
    assert.equal(canSeeSummary("crew"), false);
    assert.equal(canSeeSummary("host"), false);
    assert.equal(canSeeSummary("owner"), true);
  });
});

describe("the daily summary", () => {
  const day = [
    { status: "pending" as const, party_size: 4 },
    { status: "confirmed" as const, party_size: 2 },
    { status: "seated" as const, party_size: 6 },
    { status: "cancelled" as const, party_size: 10 },
  ];

  test("counts covers across live bookings only", () => {
    // The cancelled party of 10 must not be counted, or the kitchen preps for
    // ten people who are not coming.
    assert.equal(summarise(day).covers, 12);
  });

  test("excludes cancellations from the booking count", () => {
    assert.equal(summarise(day).bookings, 3);
  });

  test("counts pending and seated", () => {
    assert.equal(summarise(day).pending, 1);
    assert.equal(summarise(day).seated, 1);
  });

  test("handles an empty day without dividing by zero or similar", () => {
    assert.deepEqual(summarise([]), { covers: 0, pending: 0, seated: 0, bookings: 0 });
  });
});

describe("formatting", () => {
  test("renders Postgres times as a human would read them", () => {
    assert.equal(formatTime("18:30:00"), "6:30 PM");
    assert.equal(formatTime("09:00:00"), "9:00 AM");
    assert.equal(formatTime("00:15:00"), "12:15 AM", "midnight is 12 AM, not 0 AM");
    assert.equal(formatTime("12:00:00"), "12:00 PM", "noon is 12 PM, not 0 PM");
    assert.equal(formatTime("23:45"), "11:45 PM");
  });

  test("shifts dates across month and year boundaries", () => {
    assert.equal(shiftDate("2026-08-13", 1), "2026-08-14");
    assert.equal(shiftDate("2026-08-13", -1), "2026-08-12");
    assert.equal(shiftDate("2026-08-31", 1), "2026-09-01");
    assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
    assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
  });

  test("shifts across a leap day", () => {
    assert.equal(shiftDate("2028-02-28", 1), "2028-02-29");
    assert.equal(shiftDate("2028-02-29", 1), "2028-03-01");
    assert.equal(shiftDate("2027-02-28", 1), "2027-03-01");
  });
});

describe("the status-change payload", () => {
  const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

  test("accepts a real booking id and status", () => {
    assert.equal(statusChangeSchema.safeParse({ id, status: "confirmed" }).success, true);
  });

  test("accepts an id whose uuid version nibble is not 4", () => {
    // Regression. Zod's z.uuid() enforces the RFC version bits and refuses
    // this, which silently broke every button on any row not seeded by
    // gen_random_uuid(). z.guid() checks the shape without the version.
    const seeded = "aaaaaaaa-0000-0000-0000-000000000001";
    assert.equal(
      statusChangeSchema.safeParse({ id: seeded, status: "confirmed" }).success,
      true,
      "a well-formed id from our own database must not be refused",
    );
  });

  test("refuses a status that is not one of ours", () => {
    for (const status of ["comped", "", "PENDING", "'; drop table reservations; --"]) {
      assert.equal(
        statusChangeSchema.safeParse({ id, status }).success,
        false,
        `${status} should be refused`,
      );
    }
  });

  test("refuses an id that is not an id", () => {
    for (const bad of ["", "1", "../../etc/passwd", null, undefined, 42]) {
      assert.equal(statusChangeSchema.safeParse({ id: bad, status: "seated" }).success, false);
    }
  });
});
