-- Service reminders ("Babalikan"): the odometer reading on a job, when the car
-- is due back, and how often each catalog service should be repeated.
-- Only adds columns and indexes; nothing existing is changed or removed.

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "nextVisitKm" INTEGER,
ADD COLUMN     "nextVisitOn" DATE,
ADD COLUMN     "odometerKm" INTEGER,
ADD COLUMN     "reminderDoneAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "remindAfterKm" INTEGER,
ADD COLUMN     "remindAfterMonths" INTEGER;

-- CreateIndex
CREATE INDEX "Job_nextVisitOn_idx" ON "Job"("nextVisitOn");

-- CreateIndex
CREATE INDEX "Job_vehicleId_date_idx" ON "Job"("vehicleId", "date");

-- Starting intervals for the common services, so reminders work on day one.
-- These fill the columns created above (all NULL until now); the owner can
-- change or clear them on the Services page.
UPDATE "Service" SET "remindAfterMonths" = 3, "remindAfterKm" = 5000
  WHERE lower("name") IN ('change oil', 'oil change', 'palit langis');
UPDATE "Service" SET "remindAfterMonths" = 6, "remindAfterKm" = 10000
  WHERE lower("name") IN ('engine tune-up', 'tune-up', 'tune up', 'wheel alignment', 'brake service');
UPDATE "Service" SET "remindAfterMonths" = 6
  WHERE lower("name") IN ('aircon cleaning', 'aircon service');
