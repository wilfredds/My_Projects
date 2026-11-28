/**
 * Singilin and "Tumanggap ng bayad", the way a shop collects utang: a job left
 * unpaid, the customer on the Singilin list with a text already written, a
 * part payment, then the rest — and the money showing in today's income.
 */
import { test, expect } from './fixtures';
import { t, db, RUN, loginAsOwner, toast, peso } from './helpers';

test.describe.configure({ mode: 'serial' });

const name = `Nestor Utang ${RUN}`;
const plate = `UTG ${RUN.slice(-4)}`;
const phone = '0917 222 3344';

let customerId = '';
let jobId = '';
let jobNumber = '';
let total = 0;

/** The big figure in the "Pera ngayong araw" meter, as a number. */
async function todayIncome(page: import('@playwright/test').Page): Promise<number> {
  await page.goto('/dashboard');
  const text = await page.locator('.meter-digits').first().innerText();
  return Number(text.replace(/[^\d.]/g, ''));
}

test.beforeAll(async () => {
  const owner = await db.user.findFirstOrThrow({ where: { role: 'ADMIN', isActive: true } });
  const customer = await db.customer.create({
    data: {
      fullName: name,
      phone,
      createdById: owner.id,
      vehicles: { create: { plateNumber: plate, make: 'Isuzu', model: 'Crosswind' } },
    },
  });
  customerId = customer.id;
});

test.afterAll(async () => {
  await db.job.deleteMany({ where: { customerId } });
  await db.customer.deleteMany({ where: { id: customerId } });
});

test('a job left unpaid puts the customer on the Singilin list', async ({ page }) => {
  const carwash = await db.service.findUniqueOrThrow({ where: { name: 'Carwash' } });
  total = Number(carwash.defaultPrice);

  await loginAsOwner(page);
  await page.goto(`/customers/${customerId}`);
  await page.getByRole('link', { name: t.nav.newJob }).click();
  await page.getByRole('button', { name: t.common.next }).click();
  await page.getByRole('button', { name: /^Carwash/ }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: t.common.next }).click();
  await page.getByRole('button', { name: t.wizard.saveJob }).click();
  await page.getByRole('dialog').getByRole('link', { name: t.wizard.viewJob }).click();
  await expect(page).toHaveURL(/\/jobs\/c/);
  jobId = page.url().split('/').pop()!;
  jobNumber = (await db.job.findUniqueOrThrow({ where: { id: jobId } })).jobNumber;

  // Nothing paid, so no payment was written.
  expect(await db.payment.count({ where: { jobId } })).toBe(0);

  // The dashboard's "unpaid" row leads to Singilin.
  await page.goto('/dashboard');
  await page.getByRole('link', { name: new RegExp(`^${t.dashboard.unpaidTotal}`) }).click();
  await expect(page).toHaveURL(/\/collect$/);
  const card = page.locator('li').filter({ hasText: name }).first();
  await expect(card).toContainText(peso(total));
  await expect(card).toContainText(t.collect.sinceToday);

  // Text: the phone's own app, the amount and the plate already written.
  const sms = await card.getByRole('link', { name: `I-text si ${name}` }).getAttribute('href');
  expect(sms).toMatch(/^sms:09172223344\?&body=/);
  const body = decodeURIComponent(sms!.split('body=')[1]!);
  expect(body).toContain(peso(total));
  expect(body).toContain(plate);
});

test('a part payment, never more than is owed, then the rest', async ({ page }) => {
  await loginAsOwner(page);
  const before = await todayIncome(page);

  await page.goto('/collect');
  const receive = page.getByRole('button', { name: `Tumanggap ng bayad sa ${jobNumber} ni ${name}` });
  const dialog = page.getByRole('dialog');

  // Part of it, by GCash.
  await receive.click();
  await dialog.locator('#rp-amount').fill('100');
  await dialog.getByRole('button', { name: /GCash/ }).click();
  await dialog.getByRole('button', { name: t.payments.save }).click();
  await toast(page, `Natanggap na ang bayad. Kulang pa: ${peso(total - 100)}`);
  await expect(page.locator('li').filter({ hasText: name }).first()).toContainText(peso(total - 100));

  // More than is left is refused, and nothing is saved.
  await receive.click();
  await dialog.locator('#rp-amount').fill(String(total));
  await dialog.getByRole('button', { name: t.payments.save }).click();
  await expect(dialog).toContainText(t.errors.amountPaidTooHigh);
  await dialog.getByRole('button', { name: t.common.cancel }).click();
  expect(await db.payment.count({ where: { jobId } })).toBe(1);

  // The rest, with the one-tap "all of it".
  await receive.click();
  await dialog.getByRole('button', { name: /^Bayad na lahat/ }).click();
  await expect(dialog.locator('#rp-amount')).toHaveValue((total - 100).toFixed(2));
  await dialog.getByRole('button', { name: t.payments.save }).click();
  await toast(page, t.payments.receivedFull);
  await expect(page.locator('li').filter({ hasText: name })).toHaveCount(0);

  // The money is today's money, though the job is not new.
  expect(await todayIncome(page)).toBeCloseTo(before + total, 2);

  // The job is paid, and shows how it was paid.
  await page.goto(`/jobs/${jobId}`);
  await expect(page.locator('.meter')).toContainText(t.job.status_PAID);
  await expect(page.getByRole('button', { name: /^Tumanggap ng bayad/ })).toHaveCount(0);
  const history = page.locator('section[aria-labelledby="payments-title"] li');
  await expect(history).toHaveCount(2);
  await expect(history.first()).toContainText(t.payments.kind_COLLECTED);
  await expect(history.first()).toContainText('GCash');

  // The ledger and the job agree.
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  const payments = await db.payment.findMany({ where: { jobId } });
  expect(payments.map((p) => p.kind)).toEqual(['COLLECTED', 'COLLECTED']);
  expect(payments.reduce((s, p) => s + Number(p.amount), 0)).toBeCloseTo(Number(job.amountPaid), 2);
  expect(Number(job.balance)).toBe(0);
});
