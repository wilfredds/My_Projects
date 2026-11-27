import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  addMonths,
  daysBetween,
  dialable,
  isYmd,
  planNextVisit,
  reminderState,
  shopToday,
  shortestInterval,
  smsHref,
  telHref,
} from '../lib/reminders';
import { jobSchema, serviceSchema } from '../lib/validation';

const oil = { remindAfterMonths: 3, remindAfterKm: 5000 };
const aircon = { remindAfterMonths: 6, remindAfterKm: null };
const carwash = { remindAfterMonths: null, remindAfterKm: null };

test('months are added on the calendar, clamped to the end of a short month', () => {
  assert.equal(addMonths('2026-11-24', 3), '2027-02-24');
  assert.equal(addMonths('2026-11-30', 3), '2027-02-28');
  assert.equal(addMonths('2027-11-30', 3), '2028-02-29'); // leap year
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-12-15', 12), '2027-12-15');
  assert.equal(addDays('2026-12-25', 14), '2027-01-08');
  assert.equal(daysBetween('2026-11-24', '2026-11-20'), -4);
});

test('only real calendar dates are accepted', () => {
  assert.equal(isYmd('2026-02-28'), true);
  assert.equal(isYmd('2026-02-30'), false);
  assert.equal(isYmd('24/11/2026'), false);
  assert.equal(isYmd(''), false);
});

test('the shortest interval wins, months and km taken separately', () => {
  assert.deepEqual(shortestInterval([aircon, oil, carwash]), { months: 3, km: 5000 });
  assert.deepEqual(shortestInterval([carwash]), { months: null, km: null });
  assert.deepEqual(shortestInterval([]), { months: null, km: null });
});

test('auto: the next visit follows the services done', () => {
  assert.deepEqual(
    planNextVisit({ jobDate: '2026-11-24', odometerKm: 45210, services: [oil, aircon], choice: 'auto' }),
    { on: '2027-02-24', km: 50210 },
  );
  // No odometer reading: a date, but no km.
  assert.deepEqual(
    planNextVisit({ jobDate: '2026-11-24', odometerKm: null, services: [oil], choice: 'auto' }),
    { on: '2027-02-24', km: null },
  );
  // A carwash alone does not ask the car back.
  assert.deepEqual(
    planNextVisit({ jobDate: '2026-11-24', odometerKm: 45210, services: [carwash], choice: 'auto' }),
    { on: null, km: null },
  );
});

test('a hand-picked month, "none" and "keep"', () => {
  assert.deepEqual(
    planNextVisit({ jobDate: '2026-11-24', odometerKm: 45210, services: [oil], choice: '6' }),
    { on: '2027-05-24', km: 50210 },
  );
  assert.deepEqual(
    planNextVisit({ jobDate: '2026-11-24', odometerKm: 45210, services: [oil], choice: 'none' }),
    { on: null, km: null },
  );
  assert.deepEqual(
    planNextVisit({
      jobDate: '2026-11-24',
      odometerKm: 1,
      services: [oil],
      choice: 'keep',
      kept: { on: '2027-01-01', km: 9 },
    }),
    { on: '2027-01-01', km: 9 },
  );
});

test("today is the shop's date, not the server's", () => {
  // 20:00 UTC on 23 Nov is already 24 Nov in Manila.
  assert.equal(shopToday('Asia/Manila', new Date('2026-11-23T20:00:00Z')), '2026-11-24');
  assert.equal(shopToday('UTC', new Date('2026-11-23T20:00:00Z')), '2026-11-23');
});

test('where a reminder stands', () => {
  assert.deepEqual(reminderState('2026-11-20', '2026-11-24'), { kind: 'overdue', days: 4 });
  assert.deepEqual(reminderState('2026-11-24', '2026-11-24'), { kind: 'today', days: 0 });
  assert.deepEqual(reminderState('2026-11-27', '2026-11-24'), { kind: 'soon', days: 3 });
});

test('call and text links: dialable numbers only, message encoded', () => {
  assert.equal(dialable('0917 123-4567'), '09171234567');
  assert.equal(dialable('+63 917 123 4567'), '+639171234567');
  assert.equal(dialable('n/a'), null);
  assert.equal(dialable(null), null);
  assert.equal(telHref('0917 123 4567'), 'tel:09171234567');
  assert.equal(
    smsHref('0917 123 4567', 'Hi & salamat po!'),
    'sms:09171234567?&body=Hi%20%26%20salamat%20po!',
  );
  assert.equal(smsHref('', 'x'), null);
});

test('the server refuses a next visit before the job, or a km the car has passed', () => {
  const base = { customerId: 'c', vehicleId: 'v', date: '2026-11-24' };
  assert.equal(jobSchema.safeParse({ ...base, nextVisitOn: '2027-02-24', odometerKm: '45,210', nextVisitKm: 50210 }).success, true);
  assert.equal(jobSchema.safeParse({ ...base, nextVisitOn: '2026-11-24' }).success, false);
  assert.equal(jobSchema.safeParse({ ...base, nextVisitOn: '2026-02-30' }).success, false);
  assert.equal(jobSchema.safeParse({ ...base, nextVisitOn: '2040-01-01' }).success, false);
  assert.equal(jobSchema.safeParse({ ...base, odometerKm: 50000, nextVisitKm: 40000 }).success, false);
  const parsed = jobSchema.parse({ ...base, odometerKm: '45 210 km', nextVisitOn: '' });
  assert.equal(parsed.odometerKm, 45210);
  assert.equal(parsed.nextVisitOn, null);
});

test('a service can carry how often it repeats, or nothing', () => {
  const parsed = serviceSchema.parse({ name: 'Change Oil', defaultPrice: '850', remindAfterMonths: '3', remindAfterKm: '5,000' });
  assert.equal(parsed.remindAfterMonths, 3);
  assert.equal(parsed.remindAfterKm, 5000);
  const blank = serviceSchema.parse({ name: 'Carwash', defaultPrice: '250', remindAfterMonths: '', remindAfterKm: '' });
  assert.equal(blank.remindAfterMonths, null);
  assert.equal(serviceSchema.safeParse({ name: 'x', defaultPrice: '1', remindAfterMonths: '0' }).success, false);
});
