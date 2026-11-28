/**
 * The payment ledger against a real database: what is written when a job is
 * recorded, edited or paid later, that two people cannot over-collect the
 * same job, and that income counts money on the day it arrived.
 *
 * Needs a running database (DATABASE_URL). Run with:
 *   npx tsx tests/payments-db.test.ts
 *
 * Other rows in the database may have payments too, so every income check is
 * a before/after difference over this test's own dates.
 */

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  incomeBetween,
  receivePayment,
  recordPaymentForNewJob,
  syncPaymentsAfterEdit,
} from '../lib/payments.ts';
import { dateToYmd, ymdToDate } from '../lib/reminders.ts';
import { decimalToNumber } from '../lib/utils.ts';

const prisma = new PrismaClient();
const P = 'test-pay';
// Dates far from today, so nothing else in the database lands on them.
const JOB_DAY = '2031-03-10';
const LATER = '2031-03-14';
const MOVED = '2031-03-11';

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function cleanUp() {
  await prisma.job.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.vehicle.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.customer.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.user.deleteMany({ where: { username: P } });
}

let userId = '';
let n = 0;

/** A ₱1,000.00 job (one service) with nothing paid yet. */
async function owedJob(day = JOB_DAY) {
  n += 1;
  return prisma.job.create({
    data: {
      id: `${P}-job-${n}`,
      jobNumber: `${P.toUpperCase()}-${n}`,
      customerId: `${P}-customer`,
      vehicleId: `${P}-vehicle`,
      date: ymdToDate(day),
      subtotal: '1000.00',
      total: '1000.00',
      amountPaid: '0.00',
      balance: '1000.00',
      status: 'UNPAID',
      createdById: userId,
      services: { create: { serviceName: 'Tune-up', price: '1000.00' } },
    },
  });
}

async function ledger(jobId: string) {
  const rows = await prisma.payment.findMany({ where: { jobId }, orderBy: { createdAt: 'asc' } });
  return rows.map((r) => ({
    amount: decimalToNumber(r.amount),
    kind: r.kind,
    on: dateToYmd(r.receivedOn),
    method: r.method,
  }));
}

async function addsUp(jobId: string) {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  const sum = (await ledger(jobId)).reduce((s, p) => s + Math.round(p.amount * 100), 0);
  assert.equal(sum, Math.round(decimalToNumber(job.amountPaid) * 100), 'payments must add up to amountPaid');
}

async function main() {
  console.log('\nPayment ledger\n');
  await cleanUp();

  const user = await prisma.user.create({
    data: { name: 'Payment Test', username: P, passwordHash: 'x', role: 'STAFF' },
  });
  userId = user.id;
  await prisma.customer.create({
    data: { id: `${P}-customer`, fullName: 'Payment Test Customer', createdById: userId },
  });
  await prisma.vehicle.create({
    data: { id: `${P}-vehicle`, customerId: `${P}-customer`, plateNumber: 'PAY 1' },
  });

  await check('money paid with a new job is one payment, on the job’s date', async () => {
    const job = await owedJob();
    await prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id: job.id }, data: { amountPaid: '400.00', balance: '600.00', status: 'PARTIAL' } });
      await recordPaymentForNewJob(tx, { jobId: job.id, amountPaid: 400, method: 'CASH', jobDate: job.date, userId });
    });
    assert.deepEqual(await ledger(job.id), [{ amount: 400, kind: 'WITH_JOB', on: JOB_DAY, method: 'CASH' }]);
    await addsUp(job.id);
  });

  await check('nothing paid, nothing written', async () => {
    const job = await owedJob();
    await prisma.$transaction((tx) =>
      recordPaymentForNewJob(tx, { jobId: job.id, amountPaid: 0, method: null, jobDate: job.date, userId }),
    );
    assert.deepEqual(await ledger(job.id), []);
  });

  await check('an edit that changes the amount paid adds the difference, dated that day', async () => {
    const job = await owedJob();
    await prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id: job.id }, data: { amountPaid: '300.00' } });
      await recordPaymentForNewJob(tx, { jobId: job.id, amountPaid: 300, method: 'CASH', jobDate: job.date, userId });
    });
    // Raised to 1,000 on a later day…
    await prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id: job.id }, data: { amountPaid: '1000.00' } });
      await syncPaymentsAfterEdit(tx, {
        jobId: job.id,
        before: { amountPaid: 300, date: job.date, method: 'CASH' },
        after: { amountPaid: 1000, date: job.date, method: 'CASH' },
        userId,
        today: LATER,
      });
    });
    // …then corrected down to 900.
    await prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id: job.id }, data: { amountPaid: '900.00' } });
      await syncPaymentsAfterEdit(tx, {
        jobId: job.id,
        before: { amountPaid: 1000, date: job.date, method: 'CASH' },
        after: { amountPaid: 900, date: job.date, method: 'CASH' },
        userId,
        today: LATER,
      });
    });
    assert.deepEqual(
      (await ledger(job.id)).map((p) => [p.kind, p.amount, p.on]),
      [
        ['WITH_JOB', 300, JOB_DAY],
        ['ADJUSTMENT', 700, LATER],
        ['ADJUSTMENT', -100, LATER],
      ],
    );
    await addsUp(job.id);
  });

  await check('moving the job’s date moves the money that came with it', async () => {
    const job = await owedJob();
    await prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id: job.id }, data: { amountPaid: '1000.00' } });
      await recordPaymentForNewJob(tx, { jobId: job.id, amountPaid: 1000, method: 'CASH', jobDate: job.date, userId });
    });
    await prisma.$transaction(async (tx) => {
      await tx.job.update({ where: { id: job.id }, data: { date: ymdToDate(MOVED), paymentMethod: 'GCASH' } });
      await syncPaymentsAfterEdit(tx, {
        jobId: job.id,
        before: { amountPaid: 1000, date: job.date, method: 'CASH' },
        after: { amountPaid: 1000, date: ymdToDate(MOVED), method: 'GCASH' },
        userId,
      });
    });
    assert.deepEqual(await ledger(job.id), [{ amount: 1000, kind: 'WITH_JOB', on: MOVED, method: 'GCASH' }]);
  });

  await check('a later payment: recorded, the job recomputed, and never more than is owed', async () => {
    const job = await owedJob();
    const part = await receivePayment(prisma, { jobId: job.id, amount: 250, method: 'GCASH', userId, today: LATER });
    assert.ok(part.ok);
    let row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(decimalToNumber(row.amountPaid), 250);
    assert.equal(decimalToNumber(row.balance), 750);
    assert.equal(row.status, 'PARTIAL');
    assert.equal(row.paymentMethod, 'GCASH');

    const tooMuch = await receivePayment(prisma, { jobId: job.id, amount: 750.01, method: 'CASH', userId, today: LATER });
    assert.deepEqual(tooMuch, { ok: false, reason: 'tooMuch' });
    const zero = await receivePayment(prisma, { jobId: job.id, amount: 0, method: 'CASH', userId, today: LATER });
    assert.deepEqual(zero, { ok: false, reason: 'invalidAmount' });

    const rest = await receivePayment(prisma, { jobId: job.id, amount: 750, method: 'CASH', userId, today: LATER });
    assert.ok(rest.ok);
    row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(decimalToNumber(row.balance), 0);
    assert.equal(row.status, 'PAID');
    assert.deepEqual(
      (await ledger(job.id)).map((p) => [p.kind, p.amount, p.on]),
      [
        ['COLLECTED', 250, LATER],
        ['COLLECTED', 750, LATER],
      ],
    );
    await addsUp(job.id);
  });

  await check('two people taking the full balance at once: exactly one succeeds', async () => {
    const job = await owedJob();
    const results = await Promise.all([
      receivePayment(prisma, { jobId: job.id, amount: 1000, method: 'CASH', userId, today: LATER }),
      receivePayment(prisma, { jobId: job.id, amount: 1000, method: 'CASH', userId, today: LATER }),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(results.filter((r) => !r.ok && r.reason === 'tooMuch').length, 1);
    const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(decimalToNumber(row.amountPaid), 1000);
    await addsUp(job.id);
  });

  await check('a job in the Trash cannot be paid', async () => {
    const job = await owedJob();
    await prisma.job.update({ where: { id: job.id }, data: { deletedAt: new Date() } });
    const result = await receivePayment(prisma, { jobId: job.id, amount: 100, method: 'CASH', userId, today: LATER });
    assert.deepEqual(result, { ok: false, reason: 'notFound' });
  });

  await check('income counts money on the day it arrived, and not a trashed job’s', async () => {
    const before = await incomeBetween(prisma, '2031-04-01', '2031-04-30');
    const job = await owedJob('2031-03-20');
    await receivePayment(prisma, { jobId: job.id, amount: 600, method: 'CASH', userId, today: '2031-04-05' });
    // The job is March's; the money is April's.
    assert.equal(await incomeBetween(prisma, '2031-04-01', '2031-04-30'), before + 600);
    assert.equal(await incomeBetween(prisma, '2031-04-05', '2031-04-05') >= 600, true);
    await prisma.job.update({ where: { id: job.id }, data: { deletedAt: new Date() } });
    assert.equal(await incomeBetween(prisma, '2031-04-01', '2031-04-30'), before);
  });

  await cleanUp();
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
    await cleanUp().catch(() => {});
  })
  .finally(() => prisma.$disconnect());
