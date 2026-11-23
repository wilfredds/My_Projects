/**
 * The owner's back office: the service list, staff accounts (and what a new
 * staff member goes through on their first day), the shop's settings and
 * branding, reports and exports, and the activity log.
 */
import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import { t, db, RUN, login, loginAsOwner, toast, formAlert } from './helpers';

test.describe.configure({ mode: 'serial' });

const serviceName = `Wax ${RUN}`;
const staff = {
  name: `Pedro Staff ${RUN}`,
  username: `pedro${RUN.toLowerCase()}`,
  first: 'Temp#Pass2026',
  own: 'Pedro#Sariling2026',
  reset: 'Reset#Pass2026',
};

/** A real 2×2 PNG, to upload as a logo. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEJMCFzMAQwAADh9AT+GmEmLAAAAABJRU5ErkJggg==',
  'base64',
);

test('services: add, re-price, switch off and on, delete', async ({ page }) => {
  await loginAsOwner(page);
  await page.goto('/services');
  await page.getByRole('button', { name: t.services.add }).click();
  await page.getByRole('dialog').locator('#sf-name').fill(serviceName);
  await page.getByRole('dialog').locator('#sf-price').fill('450');
  await page.getByRole('dialog').getByRole('button', { name: t.common.save }).click();
  await toast(page, t.services.created);

  const row = page.locator('li').filter({ hasText: serviceName });
  await expect(row).toContainText('₱450.00');

  await row.getByRole('button', { name: t.common.edit }).click();
  await page.getByRole('dialog').locator('#sf-price').fill('500');
  await page.getByRole('dialog').getByRole('button', { name: t.common.save }).click();
  await toast(page, t.services.updated);
  await expect(row).toContainText('₱500.00');

  await row.getByRole('button', { name: t.services.toggleOff }).click();
  await expect(row).toContainText(t.services.inactive);
  await row.getByRole('button', { name: t.services.toggleOn }).click();
  await expect(row).toContainText(t.services.active);

  await row.getByRole('button', { name: t.common.delete }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: t.jobs.deleteConfirm }).click();
  await toast(page, t.services.deleted);
  await expect(page.locator('li').filter({ hasText: serviceName })).toHaveCount(0);
});

test("a new staff account, and that person's first day", async ({ page, browser }) => {
  await loginAsOwner(page);
  await page.goto('/users');
  await page.getByRole('button', { name: t.users.add }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#nu-name').fill(staff.name);
  await dialog.locator('#nu-username').fill(staff.username);
  await dialog.locator('#nu-password').fill(staff.first);
  await dialog.locator('#nu-confirm').fill(staff.first);
  await dialog.getByRole('button', { name: t.common.save }).click();
  await toast(page, t.users.created);

  // The staff member's own phone.
  const phone = await browser.newPage();
  await login(phone, staff.username, staff.first);
  // First: the rules of use.
  await expect(phone).toHaveURL(/\/policy/);
  await phone.getByText(t.policy.acknowledge).click();
  await phone.getByRole('button', { name: t.policy.acknowledgeButton }).click();
  // Then: a password only they know, because the owner chose the first one.
  await expect(phone).toHaveURL(/\/account/);
  await phone.locator('#current-password').fill(staff.first);
  await phone.locator('#own-password').fill(staff.own);
  await phone.locator('#own-confirm').fill(staff.own);
  await phone.getByRole('button', { name: t.account.changePassword }).click();
  await toast(phone, t.account.passwordChanged);

  // Staff can do the day's work but not the owner's pages.
  await phone.goto('/dashboard');
  await expect(phone.getByRole('link', { name: t.dashboard.recordNewJob })).toBeVisible();
  await phone.getByRole('button', { name: t.nav.menu }).click();
  await expect(phone.locator('#mobile-nav').getByRole('link', { name: t.nav.jobs })).toBeVisible();
  await expect(phone.locator('#mobile-nav').getByRole('link', { name: t.nav.reports })).toHaveCount(0);
  await expect(phone.locator('#mobile-nav').getByRole('link', { name: t.nav.users })).toHaveCount(0);
  await phone.goto('/reports');
  await expect(phone).toHaveURL(/\/dashboard\?denied=1/);
  // …and no Delete on a job.
  const anyJob = await db.job.findFirst({ where: { deletedAt: null }, select: { id: true } });
  if (anyJob) {
    await phone.goto(`/jobs/${anyJob.id}`);
    await expect(phone.getByRole('link', { name: t.common.print })).toBeVisible();
    await expect(phone.getByRole('button', { name: t.common.delete })).toHaveCount(0);
  }
  await phone.close();
});

test('the owner resets a password and turns an account off and on', async ({ page, browser }) => {
  await loginAsOwner(page);
  await page.goto('/users');
  const row = page.locator('li').filter({ hasText: `@${staff.username}` });

  await row.getByRole('button', { name: t.users.resetPassword }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[id$="-password"]').fill(staff.reset);
  await dialog.locator('input[id$="-confirm"]').fill(staff.reset);
  await dialog.getByRole('button', { name: t.common.save }).click();
  await toast(page, t.users.passwordReset);

  await row.getByRole('button', { name: t.users.deactivate }).click();
  await toast(page, t.users.deactivated);

  // A turned-off account cannot sign in — and is told no more than that.
  const phone = await browser.newPage();
  await login(phone, staff.username, staff.reset);
  await expect(formAlert(phone)).toContainText(t.login.errorInvalid);

  await row.getByRole('button', { name: t.users.activate }).click();
  await toast(page, t.users.activated);
  await login(phone, staff.username, staff.reset);
  // A reset password must be changed again before anything else.
  await expect(phone).toHaveURL(/\/account/);
  await phone.close();
});

test('settings: shop details with TIN, brand colour and logo', async ({ page }) => {
  await loginAsOwner(page);
  const before = await db.shopSetting.findUnique({ where: { id: 'shop' } });
  try {
    await page.goto('/settings');

    // Details, with a TIN that then shows on the receipt.
    await page.locator('#st-tin').fill('123-456-789-000');
    await page.getByRole('button', { name: t.common.save, exact: true }).click();
    await toast(page, t.settings.saved);
    const job = await db.job.findFirst({ where: { deletedAt: null }, select: { id: true } });
    if (job) {
      await page.goto(`/jobs/${job.id}/print`);
      await expect(page.locator('.receipt-sheet')).toContainText('123-456-789-000');
      await page.goto('/settings');
    }

    // The colour changes the whole app at once, and stays after a reload.
    await page.getByRole('button', { name: t.settings.accent_asul }).click();
    await toast(page, t.settings.accentSaved);
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'asul');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'asul');

    // A logo: picked, shrunk in the browser, checked on the server, shown.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await toast(page, t.settings.logoSaved);
    await expect(page.locator('header img[src^="data:image/png"]').first()).toBeVisible();
    const saved = await db.shopSetting.findUniqueOrThrow({ where: { id: 'shop' } });
    expect(saved.logo).toMatch(/^data:image\/png;base64,/);

    await page.getByRole('button', { name: t.settings.logoRemove }).click();
    await toast(page, t.settings.logoRemoved);
    await expect(page.locator('header img')).toHaveCount(0);
  } finally {
    // Put the shop back the way it was.
    if (before) {
      await db.shopSetting.update({
        where: { id: 'shop' },
        data: { tin: before.tin, accent: before.accent, logo: before.logo },
      });
    }
  }
});

test('reports, and the CSV and JSON exports', async ({ page }) => {
  await loginAsOwner(page);
  await page.goto('/reports');
  await page.getByRole('button', { name: t.reports.presetYear }).click();
  await expect(page).toHaveURL(/\/reports\?from=\d{4}-01-01&to=/);
  await expect(page.getByText(t.reports.totalIncome)).toBeVisible();

  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: t.reports.exportCsv }).click(),
  ]);
  const csvText = readFileSync(await csv.path(), 'utf8');
  expect(csvText.split('\n')[0]).toMatch(/job/i);

  const [json] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: t.reports.exportJson }).click(),
  ]);
  const data = JSON.parse(readFileSync(await json.path(), 'utf8'));
  expect(typeof data).toBe('object');
});

test('the activity log records what happened, and filters', async ({ page }) => {
  await loginAsOwner(page);
  await page.goto('/audit');
  // Entries are list rows; the same words also appear among the (folded) filters.
  await expect(page.getByRole('listitem').filter({ hasText: t.audit.action_CREATE_USER }).first()).toBeVisible();
  await page.getByText(t.audit.filterAction).click();
  await page.getByRole('link', { name: t.audit.action_LOGIN, exact: true }).click();
  await expect(page).toHaveURL(/\/audit\?action=LOGIN$/);
  await expect(page.locator('li').filter({ hasText: t.audit.action_CREATE_USER })).toHaveCount(0);
});
