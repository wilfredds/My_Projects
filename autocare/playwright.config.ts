import { defineConfig } from '@playwright/test';
import { PORT, FRESH_PORT, SETUP_CODE, databaseUrls } from './e2e/env';

/**
 * End-to-end suite: a real browser using every function of the app the way an
 * owner would. Needs a production build (`npm run build`) and PostgreSQL.
 *
 *   npm run test:e2e
 *
 * Two servers run: the normal app on the main database, and a second copy on
 * an empty database for the first-run setup test. Tests share one database,
 * so they run one at a time, in order.
 */
const { fresh } = databaseUrls();

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // The owner's phone is the main device.
    viewport: { width: 390, height: 844 },
    trace: 'off',
    acceptDownloads: true,
  },
  webServer: [
    {
      command: `npx next start -p ${PORT}`,
      url: `http://127.0.0.1:${PORT}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { SETUP_CODE },
    },
    {
      command: `npx next start -p ${FRESH_PORT}`,
      url: `http://127.0.0.1:${FRESH_PORT}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { SETUP_CODE, DATABASE_URL: fresh },
    },
  ],
});
