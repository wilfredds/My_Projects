/**
 * First-run setup (lib/setup.ts) against a real, EMPTY database.
 *
 * Setup only works when there are no accounts at all, so this test cannot use
 * the shared test database (which is seeded). It creates a throwaway database,
 * applies the migrations to it, runs the checks, and drops it again.
 *
 * What it proves:
 *   * setup is closed without a SETUP_CODE, and refuses a wrong code;
 *   * the right code creates the owner (ADMIN), the shop row, the starter
 *     services and an audit entry — together;
 *   * two people submitting at the same instant cannot both become owner;
 *   * once an account exists, setup is over for good.
 *
 * Needs a running database (DATABASE_URL) whose user may CREATE DATABASE.
 *   npx tsx tests/setup.test.ts
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  performSetup,
  setupState,
  setupCodeMatches,
  configuredSetupCode,
  STARTER_SERVICES,
} from '../lib/setup.ts';
import { setupSchema } from '../lib/validation.ts';

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const dbName = `autocare_setup_test_${process.pid}`;
const testUrl = baseUrl.replace(/\/([^/?]+)(\?|$)/, `/${dbName}$2`);
const admin = new PrismaClient();

const CODE = 'talyer-2026-setup';
const env = { ...process.env, SETUP_CODE: CODE };
const noCode = { ...process.env, SETUP_CODE: '' };

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

function input(overrides: Partial<Record<string, unknown>> = {}) {
  return setupSchema.parse({
    code: CODE,
    shopName: "Mang Ben's Talyer",
    address: 'Gen. Trias, Cavite',
    phone: '09171234567',
    ownerName: 'Benjamin Cruz',
    username: 'Ben',
    password: 'Talyer#2026ok',
    starterServices: true,
    ...overrides,
  });
}

async function main() {
  console.log(`setup: creating throwaway database ${dbName}`);
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);

  const db = new PrismaClient({ datasources: { db: { url: testUrl } } });
  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'ignore',
    });

    await check('the setup code needs at least 8 characters', () => {
      assert.equal(configuredSetupCode({ SETUP_CODE: 'short' }), null);
      assert.equal(configuredSetupCode({ SETUP_CODE: '  ' }), null);
      assert.equal(configuredSetupCode({ SETUP_CODE: CODE }), CODE);
    });

    await check('the code comparison accepts only the exact code', () => {
      assert.equal(setupCodeMatches(CODE, CODE), true);
      assert.equal(setupCodeMatches(` ${CODE} `, CODE), true, 'surrounding spaces are forgiven');
      assert.equal(setupCodeMatches('talyer-2026-setuP', CODE), false);
      assert.equal(setupCodeMatches('', CODE), false);
    });

    await check('an empty install without a SETUP_CODE is locked', async () => {
      assert.equal(await setupState(db, noCode), 'needs-code');
      const result = await performSetup(db, input(), noCode);
      assert.deepEqual(result, { ok: false, reason: 'closed' });
      assert.equal(await db.user.count(), 0);
    });

    await check('an empty install with a SETUP_CODE is open', async () => {
      assert.equal(await setupState(db, env), 'open');
    });

    await check('a wrong code is refused and creates nothing', async () => {
      const result = await performSetup(db, input({ code: 'not-the-code' }), env);
      assert.deepEqual(result, { ok: false, reason: 'bad-code' });
      assert.equal(await db.user.count(), 0);
      assert.equal(await db.shopSetting.count(), 0);
    });

    await check('two submissions at the same instant make exactly one owner', async () => {
      const results = await Promise.all([
        performSetup(db, input(), env),
        performSetup(db, input({ username: 'intruder', ownerName: 'Someone Else' }), env),
      ]);
      const ok = results.filter((r) => r.ok);
      const refused = results.filter((r) => !r.ok);
      assert.equal(ok.length, 1, `expected one success, got ${JSON.stringify(results)}`);
      assert.deepEqual(refused[0], { ok: false, reason: 'already-done' });
      assert.equal(await db.user.count(), 1);
    });

    await check('the owner is an ADMIN with the password they chose', async () => {
      const owner = await db.user.findFirstOrThrow();
      assert.equal(owner.role, 'ADMIN');
      assert.ok(['ben', 'intruder'].includes(owner.username), 'username is stored lower-case');
      assert.equal(owner.mustChangePassword, false);
      assert.equal(owner.policyAcceptedAt, null, 'the usage policy is still shown on first login');
      assert.ok(await bcrypt.compare('Talyer#2026ok', owner.passwordHash));
      assert.ok(!owner.passwordHash.includes('Talyer'), 'never stored in plain text');
    });

    await check('the shop row, starter services and audit entry were written', async () => {
      const shop = await db.shopSetting.findUniqueOrThrow({ where: { id: 'shop' } });
      assert.equal(shop.accent, 'kahel');
      assert.equal(await db.service.count(), STARTER_SERVICES.length);
      const entry = await db.auditLog.findFirst({ where: { action: 'SHOP_SETUP' } });
      assert.ok(entry, 'SHOP_SETUP audit entry');
    });

    await check('once an account exists, setup is over for good', async () => {
      assert.equal(await setupState(db, env), 'done');
      const again = await performSetup(db, input({ username: 'second' }), env);
      assert.deepEqual(again, { ok: false, reason: 'already-done' });
      assert.equal(await db.user.count(), 1);
    });

    await check('the setup form rejects a weak password before anything runs', () => {
      const parsed = setupSchema.safeParse({
        code: CODE,
        shopName: 'X',
        address: 'Y',
        phone: '1',
        ownerName: 'Z',
        username: 'zed',
        password: 'password',
        starterServices: false,
      });
      assert.equal(parsed.success, false);
    });
  } finally {
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
    await admin.$disconnect();
  }

  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}"`).catch(() => {});
  process.exit(1);
});
