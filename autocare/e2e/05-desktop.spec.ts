/**
 * The same app on a computer screen: side navigation, the wide layouts, and
 * the Log out button in the header. Also the logout guarantee: once logged
 * out, the session is over, even if the browser still has a cookie.
 */
import { test, expect } from './fixtures';
import { t, loginAsOwner } from './helpers';

test.use({ viewport: { width: 1366, height: 900 } });

test('main pages work at desktop width', async ({ page }) => {
  await loginAsOwner(page);
  const nav = page.getByRole('navigation', { name: t.nav.menu });
  for (const [label, path] of [
    [t.nav.jobs, '/jobs'],
    [t.nav.reminders, '/reminders'],
    [t.nav.customers, '/customers'],
    [t.nav.vehicles, '/vehicles'],
    [t.nav.services, '/services'],
    [t.nav.reports, '/reports'],
    [t.nav.trash, '/trash'],
    [t.nav.users, '/users'],
    [t.nav.settings, '/settings'],
    [t.nav.audit, '/audit'],
    [t.nav.dashboard, '/dashboard'],
  ] as const) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('log out from the header ends the session for good', async ({ page, context }) => {
  await loginAsOwner(page);
  const cookieBefore = (await context.cookies()).find((c) => c.name.includes('session-token'));
  expect(cookieBefore).toBeTruthy();

  await page.getByRole('banner').getByRole('button', { name: t.common.logout }).click();
  await expect(page).toHaveURL(/\/login/);

  // Even if the old cookie comes back (as a request still in flight can make
  // happen), the sign-in it belongs to has been revoked.
  await context.addCookies([cookieBefore!]);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  const after = (await context.cookies()).find((c) => c.name.includes('session-token'));
  expect(after?.value ?? '').toBe('');
});
