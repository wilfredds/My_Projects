/**
 * A brand-new install for another shop: no accounts, no default passwords.
 * Runs against the second server, which uses an empty database.
 */
import { test, expect } from './fixtures';
import { t, RUN, formAlert } from './helpers';
import { FRESH_PORT, SETUP_CODE } from './env';

test.describe.configure({ mode: 'serial' });
test.use({ baseURL: `http://127.0.0.1:${FRESH_PORT}` });

const shop = `Talyer ni Mang Ben ${RUN}`;
const owner = { name: 'Benjamin Cruz', username: 'ben', password: 'Talyer#2026ok' };

test('a fresh install says so on the login page, and nobody can log in', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText(t.login.setupTitle)).toBeVisible();
  await page.fill('input[name="username"]', 'raul');
  await page.fill('input[name="password"]', 'HiOcten#2026raul');
  await page.getByRole('button', { name: t.login.submit, exact: true }).click();
  await expect(formAlert(page)).toContainText(t.login.errorInvalid);
});

test('the shop is set up with the code, and the owner signs in', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: t.login.setupButton }).click();
  await expect(page).toHaveURL(/\/setup$/);

  await page.locator('#setup-code').fill('wrong-code-1234');
  await page.locator('#setup-shop').fill(shop);
  await page.locator('#setup-address').fill('Gen. Trias, Cavite');
  await page.locator('#setup-phone').fill('0917 123 4567');
  await page.locator('#setup-owner').fill(owner.name);
  await page.locator('#setup-username').fill(owner.username);
  await page.locator('#setup-password').fill(owner.password);
  await page.locator('#setup-confirm').fill(owner.password);
  await page.getByRole('button', { name: t.setup.submit }).click();
  await expect(page.getByRole('alert').filter({ hasText: t.setup.errorCode })).toBeVisible();

  await page.locator('#setup-code').fill(SETUP_CODE);
  await page.getByRole('button', { name: t.setup.submit }).click();
  await expect(page.getByText(t.setup.doneTitle)).toBeVisible();
  await page.getByRole('link', { name: t.setup.goToLogin }).click();

  // The login page is now the new shop's own.
  await expect(page.getByText(t.login.setupTitle)).toHaveCount(0);
  await expect(page.getByText(shop.toUpperCase(), { exact: false }).or(page.getByText(shop)).first()).toBeVisible();
  await page.fill('input[name="username"]', owner.username);
  await page.fill('input[name="password"]', owner.password);
  await page.getByRole('button', { name: t.login.submit, exact: true }).click();

  // Like everyone, the owner reads the rules once.
  await expect(page).toHaveURL(/\/policy/);
  await page.getByText(t.policy.acknowledge).click();
  await page.getByRole('button', { name: t.policy.acknowledgeButton }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // The starter services are there.
  await page.goto('/services');
  await expect(page.getByText('Vulcanizing')).toBeVisible();
  await expect(page.getByText('Wheel Alignment')).toBeVisible();
});

test('once set up, the setup page is gone for good', async ({ page }) => {
  const response = await page.goto('/setup');
  expect(response?.status()).toBe(404);
});
