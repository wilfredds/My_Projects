/**
 * The Babalikan list against a real database: which cars are due back, and
 * the rules that take a car off the list by itself.
 *
 * Needs a running database (DATABASE_URL). Run with:
 *   npx tsx tests/reminders-db.test.ts
 *
 * Other rows in the database (seed data, other tests) may be on the list too,
 * so every check looks only at this test's own jobs.
 */

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { findDueReminders, countDueReminders } from '../lib/reminder-queries.ts';
import { ymdToDate } from '../lib/reminders.ts';

const prisma = new PrismaClient();
const P = 'test-rem';

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

async function job(
  vehicle: 'a' | 'b' | 'c',
  date: string,
  nextVisitOn: string | null,
  extra: { createdAt?: Date; reminderDoneAt?: Date; deletedAt?: Date } = {},
) {
  n += 1;
  return prisma.job.create({
    data: {
      id: `${P}-job-${n}`,
      jobNumber: `${P.toUpperCase()}-${n}`,
      customerId: `${P}-customer`,
      vehicleId: `${P}-vehicle-${vehicle}`,
      date: new Date(`${date}T00:00:00Z`),
      subtotal: '850.00',
      total: '850.00',
      balance: '0.00',
      amountPaid: '850.00',
      status: 'PAID',
      createdById: userId,
      nextVisitOn: nextVisitOn ? ymdToDate(nextVisitOn) : null,
      ...extra,
    },
  });
}

async function listed(today: string): Promise<string[]> {
  return (await findDueReminders(prisma, today))
    .map((r) => r.jobId)
    .filter((id) => id.startsWith(P));
}

async function main() {
  console.log('\nBabalikan (service reminders)\n');
  await cleanUp();

  const user = await prisma.user.create({
    data: { name: 'Reminder Test', username: P, passwordHash: 'x', role: 'STAFF' },
  });
  userId = user.id;
  await prisma.customer.create({
    data: { id: `${P}-customer`, fullName: 'Reminder Test Customer', phone: '0917 000 0000', createdById: userId },
  });
  for (const v of ['a', 'b', 'c']) {
    await prisma.vehicle.create({
      data: { id: `${P}-vehicle-${v}`, customerId: `${P}-customer`, plateNumber: `REM ${v.toUpperCase()}` },
    });
  }

  const oil = await job('a', '2026-01-10', '2026-04-10');

  await check('an overdue car is on the list, with what was done and how to reach them', async () => {
    const list = await findDueReminders(prisma, '2026-04-15');
    const mine = list.find((r) => r.jobId === oil.id);
    assert.ok(mine, 'the overdue job should be listed');
    assert.equal(mine.nextVisitOn, '2026-04-10');
    assert.equal(mine.customer.phone, '0917 000 0000');
    assert.equal(mine.vehicle.plateNumber, 'REM A');
  });

  await check('a car due within two weeks is listed; one due later is not yet', async () => {
    const later = await job('b', '2026-02-20', '2026-05-20');
    assert.ok(!(await listed('2026-04-15')).includes(later.id), '35 days away: not yet');
    assert.ok((await listed('2026-05-10')).includes(later.id), '10 days away: listed');
    await prisma.job.delete({ where: { id: later.id } });
  });

  await check('a carwash in between does not cancel the change-oil reminder', async () => {
    const carwash = await job('a', '2026-03-01', null);
    assert.ok((await listed('2026-04-15')).includes(oil.id));
    await prisma.job.delete({ where: { id: carwash.id } });
  });

  // The car comes back for its change oil, which sets a new date.
  const back = await job('a', '2026-04-12', '2026-07-12');

  await check('when the car comes back for the service, the old reminder leaves by itself', async () => {
    const list = await listed('2026-04-15');
    assert.ok(!list.includes(oil.id), 'the old reminder is replaced');
    assert.ok(!list.includes(back.id), 'the new one is not due for months');
  });

  await check('…and returns if that new job is moved to the Trash', async () => {
    await prisma.job.update({ where: { id: back.id }, data: { deletedAt: new Date() } });
    assert.ok((await listed('2026-04-15')).includes(oil.id));
  });

  await check('"Tapos na" takes it off; undoing puts it back', async () => {
    await prisma.job.update({ where: { id: oil.id }, data: { reminderDoneAt: new Date() } });
    assert.ok(!(await listed('2026-04-15')).includes(oil.id));
    await prisma.job.update({ where: { id: oil.id }, data: { reminderDoneAt: null } });
    assert.ok((await listed('2026-04-15')).includes(oil.id));
  });

  await check('a job in the Trash is never listed', async () => {
    const trashed = await job('b', '2026-01-05', '2026-04-05', { deletedAt: new Date() });
    assert.ok(!(await listed('2026-04-15')).includes(trashed.id));
  });

  await check('two jobs on the same day: the later one is the car’s latest', async () => {
    const first = await job('c', '2026-03-01', '2026-04-01', { createdAt: new Date('2026-03-01T01:00:00Z') });
    assert.ok((await listed('2026-04-15')).includes(first.id));
    await job('c', '2026-03-01', '2026-09-01', { createdAt: new Date('2026-03-01T05:00:00Z') });
    assert.ok(!(await listed('2026-04-15')).includes(first.id));
  });

  await check('the count separates cars already due from those coming up', async () => {
    const before = await countDueReminders(prisma, '2026-04-15');
    await job('b', '2026-02-25', '2026-04-25'); // coming up, not yet due
    const after = await countDueReminders(prisma, '2026-04-15');
    assert.equal(after.total, before.total + 1);
    assert.equal(after.due, before.due);
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
