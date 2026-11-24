/**
 * The owner's whole working day, in order: a new customer and their car, a
 * job recorded through the wizard, paid later, printed, copied, found again,
 * deleted, brought back from the Trash, and finally removed for good.
 *
 * Every money figure on screen is checked against what the database stored.
 */
import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import { t, db, RUN, loginAsOwner, toast, peso } from './helpers';

test.describe.configure({ mode: 'serial' });

const customerName = `Juan Dela Prueba ${RUN}`;
const plate = `E2E ${RUN.slice(-4)}`;
let customerId = '';
let jobId = '';
let expectedTotal = 0;

test.beforeEach(async ({ page }) => {
  await loginAsOwner(page);
});

test('add a customer, find them, and give them a vehicle', async ({ page }) => {
  await page.goto('/customers');
  await page.getByRole('button', { name: t.customers.add }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#cf-name').fill(customerName);
  await dialog.locator('#cf-phone').fill('0917 555 0101');
  await dialog.locator('#cf-address').fill('Tanza, Cavite');
  await dialog.getByRole('button', { name: t.common.save }).click();
  await toast(page, t.customers.created);

  // Search by part of the name.
  await page.locator('#customer-search').fill(RUN);
  await page.getByRole('button', { name: t.common.search }).click();
  await page.getByRole('link', { name: new RegExp(customerName) }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(customerName);
  customerId = page.url().split('/').pop()!;

  // Their car.
  await page.getByRole('button', { name: t.vehicles.add }).click();
  const vehicle = page.getByRole('dialog');
  await vehicle.locator('#vf-plate').fill(plate);
  await vehicle.locator('#vf-make').fill('Toyota');
  await vehicle.locator('#vf-model').fill('Vios');
  await vehicle.locator('#vf-year').fill('2019');
  await vehicle.locator('#vf-color').fill('Puti');
  await vehicle.getByRole('button', { name: t.common.save }).click();
  await toast(page, t.vehicles.created);
  await expect(page.locator('.plate', { hasText: plate })).toBeVisible();
});

test('edit the customer and the vehicle', async ({ page }) => {
  await page.goto(`/customers/${customerId}`);
  // The first "Edit" on the page is the customer's own.
  await page.getByRole('button', { name: t.common.edit }).first().click();
  await page.getByRole('dialog').locator('#cf-phone').fill('0917 555 0202');
  await page.getByRole('dialog').getByRole('button', { name: t.common.save }).click();
  await toast(page, t.customers.updated);
  await expect(page.getByText('0917 555 0202')).toBeVisible();

  await page.locator('li').filter({ hasText: plate }).getByRole('button', { name: t.common.edit }).click();
  await page.getByRole('dialog').locator('#vf-color').fill('Pilak');
  await page.getByRole('dialog').getByRole('button', { name: t.common.save }).click();
  await toast(page, t.vehicles.updated);
  await expect(page.getByText('Toyota Vios, 2019, Pilak')).toBeVisible();
});

test('record a job through the wizard; the total matches what is stored', async ({ page }) => {
  const [carwash, oilChange] = await Promise.all([
    db.service.findUniqueOrThrow({ where: { name: 'Carwash' } }),
    db.service.findUniqueOrThrow({ where: { name: 'Oil Change' } }),
  ]);
  const services = Number(carwash.defaultPrice) + Number(oilChange.defaultPrice);
  const parts = 2 * 320;
  expectedTotal = services + parts + 250 - 100;
  const meter = page.locator('.total-bar output');

  // From the customer's page, the wizard already knows who — and, since they
  // have one car, which car.
  await page.goto(`/customers/${customerId}`);
  await page.getByRole('link', { name: t.nav.newJob }).click();
  await expect(page.getByRole('heading', { name: t.wizard.stepVehicle })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(plate) })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: t.common.next }).click();

  await page.getByRole('button', { name: /^Carwash/ }).click();
  await page.getByRole('button', { name: /^Oil Change/ }).click();
  await expect(meter).toHaveText(peso(services));
  await page.getByRole('button', { name: t.common.next }).click();

  await page.getByRole('button', { name: t.wizard.partsAdd }).click();
  await page.locator('input[id$="-name"]').fill('Oil Filter');
  await page.getByRole('button', { name: `${t.wizard.partsQty} +1` }).click();
  await page.locator('input[id$="-price"]').fill('320');
  await expect(meter).toHaveText(peso(services + parts));
  await page.getByRole('button', { name: t.common.next }).click();

  await page.locator('#labor').fill('250');
  await page.locator('#discount').fill('100');
  await expect(meter).toHaveText(peso(expectedTotal));
  await page.getByRole('button', { name: t.common.next }).click();

  await page.locator('#amount-paid').fill('500');
  await page.getByRole('button', { name: /^Cash/ }).click();
  await page.getByRole('button', { name: t.common.next }).click();

  await expect(page.getByRole('heading', { name: t.wizard.stepReview })).toBeVisible();
  await expect(meter).toHaveText(peso(expectedTotal));
  await page.getByRole('button', { name: t.wizard.saveJob }).click();
  await expect(page.getByRole('dialog')).toContainText(t.wizard.savedTitle);
  await page.getByRole('dialog').getByRole('link', { name: t.wizard.viewJob }).click();
  await expect(page).toHaveURL(/\/jobs\/c/);
  jobId = page.url().split('/').pop()!;

  // The screen and the database agree.
  await expect(page.locator('.meter-digits').first()).toHaveText(peso(expectedTotal));
  await expect(page.locator('.meter')).toContainText(t.job.status_PARTIAL);
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  expect(Number(job.total)).toBe(expectedTotal);
  expect(Number(job.amountPaid)).toBe(500);
  expect(Number(job.balance)).toBe(expectedTotal - 500);
  expect(job.status).toBe('PARTIAL');
  expect(job.paymentMethod).toBe('CASH');
});

test('edit the job: the customer pays the rest', async ({ page }) => {
  await page.goto(`/jobs/${jobId}`);
  await page.getByRole('link', { name: t.common.edit }).click();
  await page.getByRole('button', { name: t.wizard.paymentFull }).click();
  await page.getByRole('button', { name: t.common.save }).click();
  await toast(page, t.jobs.updated);
  await expect(page).toHaveURL(new RegExp(`/jobs/${jobId}$`));
  await expect(page.locator('.meter')).toContainText(t.job.status_PAID);

  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  expect(job.status).toBe('PAID');
  expect(Number(job.balance)).toBe(0);
  expect(Number(job.total)).toBe(expectedTotal);
});

test('print view and PDF receipt', async ({ page }) => {
  await page.goto(`/jobs/${jobId}`);
  await page.getByRole('link', { name: t.common.print }).click();
  await expect(page).toHaveURL(new RegExp(`/jobs/${jobId}/print$`));
  await expect(page.locator('.receipt-sheet')).toContainText(customerName);
  await expect(page.locator('.receipt-sheet .grand-total')).toHaveText(peso(expectedTotal));
  await expect(page.locator('.receipt-sheet')).toContainText(t.receipt.notOfficial);

  // Downloaded the way the owner does it: by tapping the button.
  await page.goto(`/jobs/${jobId}`);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: t.common.downloadPdf }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^JOB-\d{4}-\d{4}\.pdf$/);
  const bytes = readFileSync(await download.path());
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
});

test('copy to a new job starts with the same customer, car and work', async ({ page }) => {
  await page.goto(`/jobs/${jobId}`);
  await page.getByRole('link', { name: t.job.duplicate }).click();
  await expect(page.getByRole('heading', { name: t.wizard.stepServices })).toBeVisible();
  // Payment is deliberately not copied; everything else is.
  await expect(page.locator('.total-bar output')).toHaveText(peso(expectedTotal));
});

test('find the job again by plate', async ({ page }) => {
  await page.goto('/jobs');
  await page.locator('#job-search').fill(plate);
  await page.getByRole('button', { name: t.common.search }).click();
  await expect(page.locator('p[aria-live="polite"]')).toHaveText('1 trabaho ang nakita');
  await expect(page.locator(`a[href="/jobs/${jobId}"]`)).toBeVisible();

  // The "still owed" list loads and does not include a paid job.
  await page.goto('/jobs?status=OWED');
  await expect(page.locator(`a[href="/jobs/${jobId}"]`)).toHaveCount(0);
});

test('delete goes to the Trash, and the job can be brought back', async ({ page }) => {
  await page.goto(`/jobs/${jobId}`);
  await page.getByRole('button', { name: t.common.delete }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: t.jobs.deleteConfirm }).click();
  await expect(page).toHaveURL(/\/jobs$/);
  expect((await db.job.findUniqueOrThrow({ where: { id: jobId } })).deletedAt).not.toBeNull();

  await page.goto('/trash');
  await page.locator('li').filter({ hasText: plate }).getByRole('button', { name: t.trash.restore }).click();
  await toast(page, t.trash.restored);
  expect((await db.job.findUniqueOrThrow({ where: { id: jobId } })).deletedAt).toBeNull();
});

test('remove for good from the Trash', async ({ page }) => {
  await page.goto(`/jobs/${jobId}`);
  await page.getByRole('button', { name: t.common.delete }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: t.jobs.deleteConfirm }).click();
  await expect(page).toHaveURL(/\/jobs$/);

  await page.goto('/trash');
  await page.locator('li').filter({ hasText: plate }).getByRole('button', { name: t.trash.purge }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: t.trash.purgeConfirm }).click();
  await toast(page, t.trash.purged);
  expect(await db.job.findUnique({ where: { id: jobId } })).toBeNull();
});

test('with no jobs left, the vehicle and then the customer can be deleted', async ({ page }) => {
  await page.goto(`/customers/${customerId}`);
  await page.locator('li').filter({ hasText: plate }).getByRole('button', { name: t.common.edit }).click();
  await page.getByRole('dialog').getByRole('button', { name: t.vehicles.deleteButton }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: t.jobs.deleteConfirm }).click();
  await toast(page, t.vehicles.deleted);
  await expect(page.locator('.plate', { hasText: plate })).toHaveCount(0);

  await page.getByRole('button', { name: t.common.delete }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: t.jobs.deleteConfirm }).click();
  await expect(page).toHaveURL(/\/customers$/);
  expect(await db.customer.findUnique({ where: { id: customerId } })).toBeNull();
});
