/**
 * Integration checks for the three controls added in the hardening pass:
 *
 *   1. Session revocation — a cookie stays cryptographically valid for 30
 *      minutes, so disabling an account or resetting a password has to be able
 *      to invalidate it *before* it expires. That is what `tokenVersion` and
 *      the per-request user re-read in lib/session.ts are for.
 *   2. Soft delete — deleting a job must hide it everywhere without destroying
 *      the money history. These tests assert both halves: hidden from the
 *      normal filter, still present and restorable.
 *   3. The capability map — who may delete, restore and purge.
 *
 * Needs a running database (DATABASE_URL). Run with:
 *   npx tsx tests/access-control.test.ts
 */

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { resolveSessionUser, revokeSession } from '../lib/session.ts';
import { notDeleted, onlyDeleted } from '../lib/jobs.ts';
import { can } from '../lib/rbac.ts';

const prisma = new PrismaClient();

const USERNAME = 'testing-access-control';
const PASSWORD = 'AccessTest#2026';

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

/** A clean, active, version-0 account to hang the session tests off. */
async function resetUser() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  return prisma.user.upsert({
    where: { username: USERNAME },
    create: {
      name: 'Access Control Test',
      username: USERNAME,
      role: 'STAFF',
      passwordHash,
      policyAcceptedAt: new Date(),
    },
    update: {
      passwordHash,
      role: 'STAFF',
      isActive: true,
      tokenVersion: 0,
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      policyAcceptedAt: new Date(),
    },
  });
}

/** A throwaway job, wired to real customer/vehicle rows, for the delete tests. */
async function makeJob(userId: string) {
  const customer = await prisma.customer.upsert({
    where: { id: 'test-ac-customer' },
    create: {
      id: 'test-ac-customer',
      fullName: 'Soft Delete Test Customer',
      phone: '09000000000',
      createdById: userId,
    },
    update: {},
  });

  const vehicle = await prisma.vehicle.upsert({
    where: { id: 'test-ac-vehicle' },
    create: {
      id: 'test-ac-vehicle',
      customerId: customer.id,
      plateNumber: 'TEST 0001',
      make: 'Toyota',
      model: 'Vios',
    },
    update: {},
  });

  return prisma.job.create({
    data: {
      jobNumber: `JOB-TEST-${Date.now()}`,
      customerId: customer.id,
      vehicleId: vehicle.id,
      date: new Date(),
      laborCharge: '100.00',
      expenses: '0.00',
      discount: '0.00',
      subtotal: '100.00',
      total: '100.00',
      amountPaid: '0.00',
      balance: '100.00',
      status: 'UNPAID',
      createdById: userId,
    },
  });
}

async function main() {
  console.log('\nAccess control and recoverable-delete checks\n');

  const user = await resetUser();

  // ------------------------------------------------ session revocation

  await check('a current token resolves to the signed-in user', async () => {
    const resolved = await resolveSessionUser(user.id, 0);
    assert.ok(resolved, 'a valid token must resolve');
    assert.equal(resolved.username, USERNAME);
    assert.equal(resolved.role, 'STAFF');
  });

  await check('logging out revokes that sign-in, and only that one', async () => {
    const loggedOut = `test-sid-${Date.now()}`;
    const otherDevice = `${loggedOut}-phone`;
    assert.ok(await resolveSessionUser(user.id, 0, loggedOut), 'valid before logout');
    await revokeSession(loggedOut, user.id);
    assert.equal(
      await resolveSessionUser(user.id, 0, loggedOut),
      null,
      'a cookie for a logged-out sign-in must be refused, even if it is set again',
    );
    assert.ok(
      await resolveSessionUser(user.id, 0, otherDevice),
      'the same person stays signed in on their other devices',
    );
    await revokeSession(loggedOut, user.id); // logging out twice is harmless
    await prisma.revokedSession.deleteMany({ where: { sid: loggedOut } });
  });

  await check('a token for an account that no longer exists resolves to nobody', async () => {
    const resolved = await resolveSessionUser('does-not-exist', 0);
    assert.equal(resolved, null);
  });

  await check('deactivating an account invalidates its live session immediately', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    assert.equal(await resolveSessionUser(user.id, 0), null, 'a disabled user must be signed out');
    await prisma.user.update({ where: { id: user.id }, data: { isActive: true } });
    assert.ok(await resolveSessionUser(user.id, 0), 're-enabling must restore access');
  });

  await check('locking an account invalidates its live session immediately', async () => {
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() + 15 * 60_000) },
    });
    assert.equal(await resolveSessionUser(user.id, 0), null, 'a locked-out user must be signed out');
    await prisma.user.update({ where: { id: user.id }, data: { lockedUntil: null } });
  });

  await check('an expired lock does not keep the user out', async () => {
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() - 60_000) },
    });
    assert.ok(await resolveSessionUser(user.id, 0), 'a lapsed lock must not block sign-in');
    await prisma.user.update({ where: { id: user.id }, data: { lockedUntil: null } });
  });

  await check('a password reset kills every session already issued', async () => {
    // What the admin reset action does: new hash, version bumped, must-change set.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash('Rotated#2026aa', 12),
        tokenVersion: { increment: 1 },
        mustChangePassword: true,
      },
    });

    assert.equal(
      await resolveSessionUser(user.id, 0),
      null,
      'the session held from before the reset must stop working',
    );

    const fresh = await resolveSessionUser(user.id, 1);
    assert.ok(fresh, 'a token minted after the reset must work');
    assert.equal(fresh.mustChangePassword, true, 'the forced-change flag must reach the session');
  });

  await check('a token from the future is rejected just as firmly as a stale one', async () => {
    // Guards against `>=` creeping in where `!==` belongs.
    assert.equal(await resolveSessionUser(user.id, 99), null);
  });

  await check('role changes take effect on the next request, not the next login', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    const resolved = await resolveSessionUser(user.id, 1);
    assert.equal(resolved?.role, 'ADMIN', 'the re-read must pick up the new role');
    await prisma.user.update({ where: { id: user.id }, data: { role: 'STAFF' } });
  });

  // ------------------------------------------------------- soft delete

  const job = await makeJob(user.id);

  await check('a new job is visible under the normal filter', async () => {
    const found = await prisma.job.findFirst({ where: { id: job.id, ...notDeleted } });
    assert.ok(found, 'a live job must be listed');
  });

  await check('deleting a job hides it but keeps the money history', async () => {
    await prisma.job.update({
      where: { id: job.id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    const visible = await prisma.job.findFirst({ where: { id: job.id, ...notDeleted } });
    assert.equal(visible, null, 'a deleted job must not appear in the normal list');

    const row = await prisma.job.findUnique({ where: { id: job.id } });
    assert.ok(row, 'the row itself must survive — this is a soft delete');
    assert.equal(row.total.toString(), '100', 'the recorded total must be untouched');
    assert.equal(row.deletedById, user.id, 'we must know who deleted it');
  });

  await check('deleted jobs are excluded from the revenue totals', async () => {
    const sum = await prisma.job.aggregate({
      where: { id: job.id, ...notDeleted },
      _sum: { total: true },
    });
    assert.equal(sum._sum.total, null, 'a deleted job must not be counted as income');
  });

  await check('the trash filter finds exactly what the normal filter hides', async () => {
    const inTrash = await prisma.job.findFirst({ where: { id: job.id, ...onlyDeleted } });
    assert.ok(inTrash, 'the deleted job must be listed in Trash');
  });

  await check('restoring a job brings it back whole', async () => {
    await prisma.job.update({
      where: { id: job.id },
      data: { deletedAt: null, deletedById: null },
    });

    const restored = await prisma.job.findFirst({ where: { id: job.id, ...notDeleted } });
    assert.ok(restored, 'a restored job must be visible again');
    assert.equal(restored.total.toString(), '100', 'restoring must not alter the figures');

    const stillInTrash = await prisma.job.findFirst({ where: { id: job.id, ...onlyDeleted } });
    assert.equal(stillInTrash, null, 'a restored job must leave Trash');
  });

  await check('purging removes the job and its line items for good', async () => {
    await prisma.job.delete({ where: { id: job.id } });
    assert.equal(await prisma.job.findUnique({ where: { id: job.id } }), null);
    assert.equal(await prisma.jobService.count({ where: { jobId: job.id } }), 0);
    assert.equal(await prisma.jobPart.count({ where: { jobId: job.id } }), 0);
  });

  // ------------------------------------------------------ capabilities

  await check('only an admin may delete, restore or purge a job', () => {
    assert.equal(can.deleteJobs('ADMIN'), true);
    assert.equal(can.deleteJobs('STAFF'), false, 'staff must not be able to delete jobs');
    assert.equal(can.restoreJobs('ADMIN'), true);
    assert.equal(can.restoreJobs('STAFF'), false);
    assert.equal(can.purgeJobs('ADMIN'), true);
    assert.equal(can.purgeJobs('STAFF'), false);
  });

  await check('a signed-out visitor has no capability at all', () => {
    for (const [name, allows] of Object.entries(can)) {
      assert.equal(allows(undefined), false, `${name} must reject a missing role`);
    }
  });

  await check('staff can still do the everyday work', () => {
    assert.equal(can.manageJobs('STAFF'), true, 'staff must be able to record and edit a job');
    assert.equal(can.manageCustomers('STAFF'), true);
    assert.equal(can.manageUsers('STAFF'), false, 'but not manage accounts');
    assert.equal(can.viewReports('STAFF'), false, 'and not see the money reports');
    assert.equal(can.exportData('STAFF'), false, 'and not export the whole database');
  });

  // ------------------------------------------------------------ cleanup
  await prisma.vehicle.deleteMany({ where: { id: 'test-ac-vehicle' } });
  await prisma.customer.deleteMany({ where: { id: 'test-ac-customer' } });
  await prisma.auditLog.deleteMany({ where: { userId: user.id } });
  await prisma.user.deleteMany({ where: { username: USERNAME } });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
