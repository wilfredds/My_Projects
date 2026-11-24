import { test, expect } from './fixtures';
import { t, login, loginAsOwner, msg, toast, formAlert } from './helpers';
import { OWNER, LOCKME } from './env';

test.describe.configure({ mode: 'serial' });

test('a wrong password is refused with a plain message', async ({ page }) => {
  await login(page, OWNER.username, 'Wrong#Password1');
  await expect(formAlert(page)).toContainText(t.login.errorInvalid);
  await expect(page).toHaveURL(/\/login/);
});

test('the owner signs in and lands on Home', async ({ page }) => {
  await loginAsOwner(page);
  await expect(page.getByRole('link', { name: t.dashboard.recordNewJob })).toBeVisible();
  await expect(page.getByText(t.dashboard.todayIncome, { exact: false })).toBeVisible();
});

test('signed-out visitors are sent to the login page', async ({ page }) => {
  await page.goto('/jobs');
  await expect(page).toHaveURL(/\/login\?next=%2Fjobs/);
});

test('five wrong passwords lock an account until the owner unlocks it', async ({ browser }) => {
  // Its own IP, so these failures don't count against the other tests' logins.
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': '10.9.9.9' } });
  const page = await context.newPage();
  for (let i = 0; i < 5; i++) {
    await login(page, LOCKME.username, 'Wrong#Password1');
    await expect(formAlert(page)).toBeVisible();
  }
  await expect(formAlert(page)).toContainText(msg(t.login.errorLocked));

  // Locked means locked: even the right password is refused.
  await login(page, LOCKME.username, LOCKME.password);
  await expect(formAlert(page)).toContainText(msg(t.login.errorLocked));

  // The owner unlocks it from the Users page.
  const owner = await browser.newPage();
  await loginAsOwner(owner);
  await owner.goto('/users');
  const row = owner.locator('li').filter({ hasText: `@${LOCKME.username}` });
  await row.getByRole('button', { name: t.users.unlock }).click();
  await toast(owner, t.users.unlocked);
  await owner.close();

  await login(page, LOCKME.username, LOCKME.password);
  await expect(page).toHaveURL(/\/dashboard/);
  await context.close();
});

test('the language can be switched to English and back', async ({ page }) => {
  await loginAsOwner(page);
  // On a phone the language choice lives in the menu.
  await page.getByRole('button', { name: t.nav.menu }).click();
  await page.locator('#mobile-nav').getByRole('button', { name: t.common.language }).click();
  await page.getByRole('menuitem', { name: 'English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good day');

  // The menu may still be open after the switch; open it only if it closed.
  if (!(await page.locator('#mobile-nav').isVisible())) {
    await page.getByRole('button', { name: 'Menu' }).click();
  }
  await page.locator('#mobile-nav').getByRole('button', { name: 'Language' }).click();
  await page.getByRole('menuitem', { name: 'Filipino' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Magandang araw');
});

test('log out from the menu', async ({ page }) => {
  await loginAsOwner(page);
  await page.getByRole('button', { name: t.nav.menu }).click();
  await page.locator('#mobile-nav').getByRole('button', { name: t.common.logout }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
