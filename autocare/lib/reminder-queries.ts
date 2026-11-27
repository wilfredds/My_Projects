import { Prisma, type PrismaClient } from '@prisma/client';
import { REMINDER_WINDOW_DAYS, addDays, dateToYmd } from './reminders';

/**
 * The Babalikan list: cars that are due back, or will be within
 * REMINDER_WINDOW_DAYS.
 *
 * A job is on the list when it has a next-visit date, nobody has marked the
 * reminder done, it is not in the Trash, and the same car has no newer live
 * job that carries a next visit of its own. That last rule is what takes a car
 * off the list by itself when it comes back for the service: the new change
 * oil sets a new date, which replaces the old reminder. A visit that sets no
 * date — a carwash — leaves the reminder standing, so a carwash never cancels
 * a change-oil reminder (and while the car is in, the shop can mention it).
 * The rule compares each job with the other jobs of the same car, which a
 * Prisma relation filter cannot express, so it is one plain SQL query —
 * parameterised, never string-built.
 */
export interface DueReminder {
  jobId: string;
  jobNumber: string;
  jobDate: string;
  nextVisitOn: string;
  nextVisitKm: number | null;
  odometerKm: number | null;
  customer: { id: string; fullName: string; phone: string | null };
  vehicle: {
    id: string;
    plateNumber: string;
    make: string | null;
    model: string | null;
    year: number | null;
    color: string | null;
  };
  services: string[];
}

/**
 * The one definition of "on the list", shared by the list and the count so
 * they can never disagree. `until` is passed as text and cast in SQL, so no
 * session timezone can move the day.
 */
function openReminderWhere(until: string): Prisma.Sql {
  return Prisma.sql`
    j."deletedAt" IS NULL
      AND j."reminderDoneAt" IS NULL
      AND j."nextVisitOn" IS NOT NULL
      AND j."nextVisitOn" <= ${until}::date
      AND NOT EXISTS (
        SELECT 1 FROM "Job" k
        WHERE k."vehicleId" = j."vehicleId"
          AND k."deletedAt" IS NULL
          AND k."id" <> j."id"
          AND k."nextVisitOn" IS NOT NULL
          AND (k."date" > j."date" OR (k."date" = j."date" AND k."createdAt" > j."createdAt"))
      )`;
}

export async function findDueReminders(
  db: PrismaClient,
  today: string,
  { windowDays = REMINDER_WINDOW_DAYS, limit = 200 } = {},
): Promise<DueReminder[]> {
  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT j."id"
    FROM "Job" j
    WHERE ${openReminderWhere(addDays(today, windowDays))}
    ORDER BY j."nextVisitOn" ASC, j."id" ASC
    LIMIT ${limit}
  `);
  if (rows.length === 0) return [];

  const jobs = await db.job.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    orderBy: [{ nextVisitOn: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      jobNumber: true,
      date: true,
      nextVisitOn: true,
      nextVisitKm: true,
      odometerKm: true,
      customer: { select: { id: true, fullName: true, phone: true } },
      vehicle: {
        select: { id: true, plateNumber: true, make: true, model: true, year: true, color: true },
      },
      services: { select: { serviceName: true }, orderBy: { serviceName: 'asc' } },
    },
  });

  return jobs.map((job) => ({
    jobId: job.id,
    jobNumber: job.jobNumber,
    jobDate: job.date.toISOString(),
    nextVisitOn: dateToYmd(job.nextVisitOn!),
    nextVisitKm: job.nextVisitKm,
    odometerKm: job.odometerKm,
    customer: job.customer,
    vehicle: job.vehicle,
    services: job.services.map((s) => s.serviceName),
  }));
}

/** How many cars are on the Babalikan list, and how many of them are already due. */
export async function countDueReminders(
  db: PrismaClient,
  today: string,
): Promise<{ total: number; due: number }> {
  const [row] = await db.$queryRaw<{ total: bigint; due: bigint }[]>(Prisma.sql`
    SELECT count(*) AS total,
           count(*) FILTER (WHERE j."nextVisitOn" <= ${today}::date) AS due
    FROM "Job" j
    WHERE ${openReminderWhere(addDays(today, REMINDER_WINDOW_DAYS))}
  `);
  return { total: Number(row?.total ?? 0), due: Number(row?.due ?? 0) };
}
