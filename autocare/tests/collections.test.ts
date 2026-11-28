import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysWaiting, groupOwed, type OwedRow } from '../lib/collections';
import { byMonth, monthStart } from '../lib/payments';

const row = (over: Partial<OwedRow>): OwedRow => ({
  jobId: 'j',
  jobNumber: 'JOB-2026-0001',
  date: '2026-11-01',
  plate: 'ABC 1234',
  total: 1000,
  amountPaid: 0,
  balance: 1000,
  customerId: 'c1',
  fullName: 'Mario',
  phone: '0917',
  ...over,
});

test('owed jobs are grouped per customer, totals in centavos', () => {
  const groups = groupOwed([
    row({ jobId: 'a', jobNumber: 'JOB-2', date: '2026-11-10', balance: 0.1 }),
    row({ jobId: 'b', jobNumber: 'JOB-1', date: '2026-11-03', balance: 0.2 }),
  ]);
  assert.equal(groups.length, 1);
  // 0.1 + 0.2 is 0.30000000000000004 in floats; not here.
  assert.equal(groups[0]!.totalOwed, 0.3);
  assert.equal(groups[0]!.oldest, '2026-11-03');
  assert.deepEqual(groups[0]!.jobs.map((j) => j.jobId), ['b', 'a']);
});

test('the customer waiting longest comes first, then the larger debt', () => {
  const groups = groupOwed([
    row({ jobId: 'new', customerId: 'recent', fullName: 'Recent', date: '2026-11-20', balance: 9000 }),
    row({ jobId: 'old', customerId: 'old', fullName: 'Old', date: '2026-10-01', balance: 100 }),
    row({ jobId: 'same1', customerId: 'small', fullName: 'Small', date: '2026-11-20', balance: 50 }),
  ]);
  assert.deepEqual(groups.map((g) => g.fullName), ['Old', 'Recent', 'Small']);
});

test('a job with nothing left to pay is not a debt', () => {
  assert.deepEqual(groupOwed([row({ balance: 0 }), row({ jobId: 'x', balance: -5 })]), []);
});

test('days waiting count from the oldest job, never negative', () => {
  assert.equal(daysWaiting('2026-11-01', '2026-11-28'), 27);
  assert.equal(daysWaiting('2026-11-28', '2026-11-28'), 0);
  assert.equal(daysWaiting('2026-11-30', '2026-11-28'), 0);
});

test('income per day folds into months; month starts go back across years', () => {
  const months = byMonth(
    new Map([
      ['2026-10-31', 0.1],
      ['2026-11-01', 0.2],
      ['2026-11-28', 0.1],
    ]),
  );
  assert.deepEqual([...months], [['2026-10', 0.1], ['2026-11', 0.3]]);
  assert.equal(monthStart('2026-11-28'), '2026-11-01');
  assert.equal(monthStart('2026-02-15', 11), '2025-03-01');
});
