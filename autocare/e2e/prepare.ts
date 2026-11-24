/**
 * Get the databases ready for the end-to-end suite. Run before Playwright
 * (see `npm run test:e2e`):
 *
 *   * In the main database, create or reset the accounts the suite signs in
 *     with, so the run does not depend on what state the seeded owners are in.
 *   * Create an EMPTY database, with all migrations applied, for the
 *     first-run setup test — setup only exists while there are no accounts.
 */
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { OWNER, LOCKME, databaseUrls } from './env';

async function main() {
  const { fresh, freshName } = databaseUrls();
  const prisma = new PrismaClient();

  try {
    const now = new Date();
    for (const [account, role] of [
      [OWNER, 'ADMIN'],
      [LOCKME, 'STAFF'],
    ] as const) {
      const passwordHash = await bcrypt.hash(account.password, 10);
      const reset = {
        name: account.name,
        role,
        passwordHash,
        isActive: true,
        locale: 'fil',
        failedLoginAttempts: 0,
        lockedUntil: null,
        mustChangePassword: false,
        policyAcceptedAt: now,
      };
      await prisma.user.upsert({
        where: { username: account.username },
        create: { username: account.username, ...reset },
        update: { ...reset, tokenVersion: { increment: 1 } },
      });
    }
    console.log('e2e: accounts ready');

    await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${freshName}" WITH (FORCE)`);
    await prisma.$executeRawUnsafe(`CREATE DATABASE "${freshName}"`);
  } finally {
    await prisma.$disconnect();
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: fresh },
    stdio: 'ignore',
  });
  console.log(`e2e: empty database ${freshName} ready`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
