-- The payment ledger: one row per payment towards a job, so income can be
-- counted on the day the money arrived (a debt collected today is today's
-- money), not only on the day the job was done.
--
-- Adds a table and an enum, then copies what is already known: every job with
-- money paid gets one WITH_JOB payment for that amount, on the job's own date.
-- Afterwards the payments of every job add up to its "amountPaid", which is
-- the rule the app keeps from here on. Nothing existing is changed or removed.

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('WITH_JOB', 'COLLECTED', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod",
    "kind" "PaymentKind" NOT NULL,
    "receivedOn" DATE NOT NULL,
    "receivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_jobId_idx" ON "Payment"("jobId");

-- CreateIndex
CREATE INDEX "Payment_receivedOn_idx" ON "Payment"("receivedOn");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: what each job already shows as paid, received on the job's date
-- (read in the shop's timezone; job dates entered in the app are already the
-- shop's calendar date at midnight UTC, which this leaves unchanged).
INSERT INTO "Payment" ("id", "jobId", "amount", "method", "kind", "receivedOn", "receivedById", "createdAt")
SELECT 'bf_' || j."id",
       j."id",
       j."amountPaid",
       j."paymentMethod",
       'WITH_JOB',
       (j."date" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date,
       j."createdById",
       j."createdAt"
FROM "Job" j
WHERE j."amountPaid" <> 0;
