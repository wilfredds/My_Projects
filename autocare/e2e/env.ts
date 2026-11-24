/**
 * Shared settings for the end-to-end suite, used by both the Playwright config
 * and the prepare script, so the two always agree.
 */
import { loadEnvConfig } from '@next/env';

// Read .env the same way `next start` does, so DATABASE_URL is the same one.
loadEnvConfig(process.cwd());

export const PORT = 3200;
export const FRESH_PORT = 3201;
export const SETUP_CODE = 'e2e-setup-code-2026';

/** Accounts the suite signs in with. Created (or reset) by e2e/prepare.ts. */
export const OWNER = { username: 'e2e-owner', password: 'E2e#Owner2026', name: 'E2E Owner' };
export const LOCKME = { username: 'e2e-lockme', password: 'E2e#Lock2026', name: 'E2E Lockout' };

/** The main database, and an empty one for the first-run setup test. */
export function databaseUrls(): { main: string; fresh: string; freshName: string } {
  const main = process.env.DATABASE_URL;
  if (!main) throw new Error('DATABASE_URL is not set');
  const name = main.match(/\/([^/?]+)(\?|$)/)?.[1] ?? 'autocare';
  const freshName = `${name}_e2e_fresh`;
  return { main, fresh: main.replace(/\/([^/?]+)(\?|$)/, `/${freshName}$2`), freshName };
}
