/**
 * Babalikan — service reminders, the way a shop uses them: the odometer is
 * read when the car comes in, a change oil sets the next visit by itself, the
 * receipt says when to come back, and when the date comes the car is on the
 * Babalikan list with Call and Text buttons.
 */
import { test, expect } from './fixtures';
import { t, db, RUN, loginAsOwner, toast } from './helpers';
import { addDays, addMonths, dateToYmd, shopToday, ymdToDate } from '../lib/reminders';
import { formatDate } from '../lib/utils';
import { intlTagFor } from '../i18n/locales';

test.describe.configure({ mode: 'serial' });

const name = `Rosa Balikan ${RUN}`;
const plate = `BLK ${RUN.slice(-4)}`;
const phone = '0918 765 4321';
const fmt = (ymd: string) => formatDate(`${ymd}T00:00:00`, intlTagFor('fil'));

let customerId = '';
let jobId = '';
let today = '';

test.beforeAll(async () => {
  const owner = await db.user.findFirstOrThrow({ where: { role: 'ADMIN', isActive: true } });
  const customer = await db.customer.create({
    data: {
      fullName: name,
      phone,
      createdById: owner.id,
      vehicles: { create: { plateNumber: plate, make: 'Honda', model: 'City' } },
    },
  });
  customerId = customer.id;
});

test.afterAll(async () => {
  await db.job.deleteMany({ where: { customerId } });
  await db.customer.deleteMany({ where: { id: customerId } });
});

test('a change oil with the odometer read sets the next visit by itself', async ({ page }) => {
  const oil = await db.service.findUniqueOrThrow({ where: { name: 'Oil Change' } });
  expect(oil.remindAfterMonths).toBe(3);
  expect(oil.remindAfterKm).toBe(5000);

  await loginAsOwner(page);
  await page.goto(`/customers/${customerId}`);
  await page.getByRole('link', { name: t.nav.newJob }).click();
  await expect(page.getByRole('button', { name: new RegExp(plate) })).toHaveAttribute('aria-pressed', 'true');

  // The wizard's job date is today on this device.
  today = await page.evaluate(() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  });

  await page.locator('#odometer').fill('45,210');
  await page.getByRole('button', { name: t.common.next }).click();
  await page.getByRole('button', { name: /^Oil Change/ }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: t.common.next }).click();

  // On the review screen: three months on, or 5,000 km — no typing needed.
  const due = addMonths(today, 3);
  const card = page.locator('section[aria-labelledby="next-visit-title"]');
  await expect(card.getByTestId('next-visit-summary')).toHaveText(fmt(due));
  await expect(card).toContainText('50,210 km');
  await expect(card.getByRole('button', { name: t.wizard.reminderAuto })).toHaveAttribute('aria-pressed', 'true');

  // The owner can change it with one tap, and back.
  await card.getByRole('button', { name: '6 buwan' }).click();
  await expect(card.getByTestId('next-visit-summary')).toHaveText(fmt(addMonths(today, 6)));
  await card.getByRole('button', { name: t.wizard.reminderAuto }).click();
  await expect(card.getByTestId('next-visit-summary')).toHaveText(fmt(due));

  await page.getByRole('button', { name: t.wizard.saveJob }).click();
  await page.getByRole('dialog').getByRole('link', { name: t.wizard.viewJob }).click();
  await expect(page).toHaveURL(/\/jobs\/c/);
  jobId = page.url().split('/').pop()!;

  // The receipt carries the reading and the next visit, like a sticker.
  const receipt = page.locator('.receipt-sheet');
  await expect(receipt).toContainText('45,210 km');
  await expect(receipt.locator('.next-visit')).toContainText(t.receipt.nextVisit);
  await expect(receipt.locator('.next-visit')).toContainText(fmt(due));
  await expect(receipt.locator('.next-visit')).toContainText('50,210 km');

  // And the database agrees with the screen.
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId } });
  expect(job.odometerKm).toBe(45210);
  expect(job.nextVisitKm).toBe(50210);
  expect(dateToYmd(job.nextVisitOn!)).toBe(due);
});

test('not due yet: the car is not on the list', async ({ page }) => {
  await loginAsOwner(page);
  await page.goto('/reminders');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.reminders.title);
  await expect(page.locator('li').filter({ hasText: plate })).toHaveCount(0);
});

test('when the date comes: Call, Text, and Done with undo', async ({ page }) => {
  // Three months pass.
  const shopDay = shopToday();
  await db.job.update({
    where: { id: jobId },
    data: {
      date: ymdToDate(addMonths(shopDay, -3)),
      nextVisitOn: ymdToDate(addDays(shopDay, -2)),
    },
  });

  await loginAsOwner(page);
  // The dashboard says someone is due, and leads to the list.
  await page.getByRole('link', { name: new RegExp(t.dashboard.reminders) }).click();
  await expect(page).toHaveURL(/\/reminders$/);

  const card = page.locator('li').filter({ hasText: plate });
  await expect(card).toContainText(name);
  await expect(card).toContainText('Lampas na ng 2 araw');
  await expect(card).toContainText('Oil Change');

  // The phone's own dialler and messaging app, with the message written.
  await expect(card.getByRole('link', { name: `Tawagan si ${name}` })).toHaveAttribute('href', 'tel:09187654321');
  const sms = await card.getByRole('link', { name: `I-text si ${name}` }).getAttribute('href');
  expect(sms).toMatch(/^sms:09187654321\?&body=/);
  const body = decodeURIComponent(sms!.split('body=')[1]!);
  expect(body).toContain(name);
  expect(body).toContain(plate);

  // Done takes it off the list — and a mis-tap can be undone.
  await card.getByRole('button', { name: `Tapos na kay ${name}` }).click();
  await toast(page, t.reminders.closed);
  await expect(page.locator('li').filter({ hasText: plate })).toHaveCount(0);
  await page.locator('[data-sonner-toast]').getByRole('button', { name: t.reminders.undo }).click();
  await toast(page, t.reminders.reopened);
  await expect(page.locator('li').filter({ hasText: plate })).toHaveCount(1);
  expect((await db.job.findUniqueOrThrow({ where: { id: jobId } })).reminderDoneAt).toBeNull();
});

test('the service catalog says how often each service comes back', async ({ page }) => {
  await loginAsOwner(page);
  await page.goto('/services');
  const row = page.locator('li').filter({ hasText: 'Oil Change' });
  await expect(row).toContainText('3 buwan o 5,000 km');
  await row.getByRole('button', { name: t.common.edit }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '3 buwan' })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('#sf-km')).toHaveValue('5000');
});
