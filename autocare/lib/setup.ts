import { createHash, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { SHOP_SETTINGS_ID } from './settings';
import type { SetupInput } from './validation';

/**
 * First-run setup for a shop that has just installed AutoCare.
 *
 * A fresh install has no accounts. Rather than shipping with default
 * passwords (which anyone who has read the code would know), the installer
 * sets a one-time SETUP_CODE in the hosting environment and gives it to the
 * owner. The /setup page then asks for that code, the shop's details and the
 * owner's own username and password, and creates the first ADMIN.
 *
 * It is open only while BOTH hold:
 *   * SETUP_CODE is set (at least 8 characters), and
 *   * the database has no users at all.
 * The moment the first account exists, setup is gone for good — the page
 * returns 404 and the action refuses — so it cannot be used to add a second
 * owner later. The "no users" check is made inside a transaction holding a
 * Postgres advisory lock, so two people submitting at the same instant cannot
 * both become the owner.
 */

/** Arbitrary constant naming the advisory lock that serialises setup. */
const SETUP_LOCK_KEY = 724_001;
const BCRYPT_COST = 12;
const MIN_CODE_LENGTH = 8;

/**
 * Services a talyer or car-care shop usually offers. Prices are editable, and
 * so is how often each one should be repeated — the interval is what the
 * Babalikan (reminders) list works from.
 */
export const STARTER_SERVICES: {
  name: string;
  defaultPrice: string;
  remindAfterMonths?: number;
  remindAfterKm?: number;
}[] = [
  { name: 'Change Oil', defaultPrice: '850.00', remindAfterMonths: 3, remindAfterKm: 5000 },
  { name: 'Engine Tune-up', defaultPrice: '1800.00', remindAfterMonths: 6, remindAfterKm: 10000 },
  { name: 'Brake Service', defaultPrice: '1200.00', remindAfterMonths: 6, remindAfterKm: 10000 },
  { name: 'Underchassis Repair', defaultPrice: '1500.00' },
  { name: 'Wheel Alignment', defaultPrice: '800.00', remindAfterMonths: 6, remindAfterKm: 10000 },
  { name: 'Tire Change', defaultPrice: '400.00' },
  { name: 'Vulcanizing', defaultPrice: '150.00' },
  { name: 'Battery Replacement', defaultPrice: '500.00' },
  { name: 'Aircon Cleaning', defaultPrice: '1500.00', remindAfterMonths: 6 },
  { name: 'Carwash', defaultPrice: '250.00' },
];

/** Only SETUP_CODE is read; tests pass a plain object. */
type SetupEnv = Record<string, string | undefined>;

/** The configured setup code, or null when setup is switched off. */
export function configuredSetupCode(env: SetupEnv = process.env): string | null {
  const code = env.SETUP_CODE?.trim();
  return code && code.length >= MIN_CODE_LENGTH ? code : null;
}

/** Constant-time comparison, so response timing says nothing about the code. */
export function setupCodeMatches(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given.trim()).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export type SetupState = 'open' | 'needs-code' | 'done';

/**
 * 'done'       — accounts exist; setup is over.
 * 'needs-code' — no accounts yet, but no SETUP_CODE is configured.
 * 'open'       — no accounts and a code is configured: the form may be shown.
 */
export async function setupState(
  db: Pick<PrismaClient, 'user'>,
  env: SetupEnv = process.env,
): Promise<SetupState> {
  const users = await db.user.count();
  if (users > 0) return 'done';
  return configuredSetupCode(env) ? 'open' : 'needs-code';
}

export type SetupResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'closed' | 'bad-code' | 'already-done' };

/**
 * Create the shop's settings, its owner account and (optionally) the starter
 * service catalog — all or nothing. `input` must already be validated by
 * `setupSchema`.
 */
export async function performSetup(
  db: PrismaClient,
  input: SetupInput,
  env: SetupEnv = process.env,
): Promise<SetupResult> {
  const expected = configuredSetupCode(env);
  if (!expected) return { ok: false, reason: 'closed' };
  if (!setupCodeMatches(input.code, expected)) return { ok: false, reason: 'bad-code' };

  // Hash outside the transaction: it is slow on purpose, and the lock should
  // be held for as short a time as possible.
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  return db.$transaction(async (tx) => {
    // Everyone attempting setup queues here, one at a time.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETUP_LOCK_KEY})`;

    if ((await tx.user.count()) > 0) return { ok: false, reason: 'already-done' } as const;

    const shop = {
      name: input.shopName,
      address: input.address,
      phone: input.phone,
    };
    await tx.shopSetting.upsert({
      where: { id: SHOP_SETTINGS_ID },
      create: { id: SHOP_SETTINGS_ID, ...shop },
      update: shop,
    });

    const owner = await tx.user.create({
      data: {
        name: input.ownerName,
        username: input.username,
        passwordHash,
        role: 'ADMIN',
        // They chose this password themselves just now, so no forced change.
        // The usage policy is still shown on first sign-in, as for everyone.
        mustChangePassword: false,
      },
      select: { id: true },
    });

    if (input.starterServices) {
      await tx.service.createMany({ data: STARTER_SERVICES, skipDuplicates: true });
    }

    await tx.auditLog.create({
      data: {
        userId: owner.id,
        action: 'SHOP_SETUP',
        entity: 'ShopSetting',
        entityId: SHOP_SETTINGS_ID,
        metadata: { shopName: input.shopName, starterServices: input.starterServices },
      },
    });

    return { ok: true, userId: owner.id } as const;
  });
}
