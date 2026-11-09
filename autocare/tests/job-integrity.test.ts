/**
 * Proves the central promise of the app: the total is never taken from the
 * client. Run with: npx tsx tests/job-integrity.test.ts
 */

import assert from 'node:assert/strict';
import { jobSchema } from '../lib/validation.ts';
import { computeJobTotals, toDecimalString } from '../lib/calc.ts';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log('\nJob total integrity\n');

check('the schema discards any total the client tries to send', () => {
  const hostile = {
    customerId: 'c1',
    vehicleId: 'v1',
    laborCharge: '100',
    services: [{ serviceName: 'Carwash', price: '250' }],
    parts: [],
    // A tampered client posting its own figures:
    subtotal: '1',
    total: '1',
    balance: '-9999',
    amountPaid: '0',
    status: 'PAID',
  };

  const parsed = jobSchema.parse(hostile);
  const keys = Object.keys(parsed);

  for (const forbidden of ['subtotal', 'total', 'balance', 'status']) {
    assert.ok(
      !keys.includes(forbidden),
      `"${forbidden}" must never survive validation, but it did`,
    );
  }
});

check('the server recomputes the honest figures from the line items', () => {
  const parsed = jobSchema.parse({
    customerId: 'c1',
    vehicleId: 'v1',
    laborCharge: '100',
    expenses: '0',
    discount: '0',
    amountPaid: '0',
    services: [{ serviceName: 'Carwash', price: '250' }],
    parts: [{ partName: 'Filter', quantity: 2, unitPrice: '75' }],
    total: '1', // ignored
  });

  const totals = computeJobTotals({
    laborCharge: parsed.laborCharge,
    expenses: parsed.expenses,
    discount: parsed.discount,
    amountPaid: parsed.amountPaid,
    parts: parsed.parts,
    services: parsed.services,
  });

  // 100 labour + 250 service + (2 x 75) parts
  assert.equal(totals.subtotal, 500);
  assert.equal(totals.total, 500);
  assert.equal(totals.balance, 500);
  assert.equal(totals.status, 'UNPAID');
  assert.equal(toDecimalString(totals.total), '500.00');
});

check('a discount larger than the amount due is rejected', () => {
  const result = jobSchema.safeParse({
    customerId: 'c1',
    vehicleId: 'v1',
    laborCharge: '100',
    discount: '5000',
    services: [],
    parts: [],
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(
      result.error.issues.some((i) => i.message === 'errors.discountTooHigh'),
      'should flag errors.discountTooHigh',
    );
  }
});

check('a job with no customer or vehicle is rejected', () => {
  const result = jobSchema.safeParse({ customerId: '', vehicleId: '', services: [], parts: [] });
  assert.equal(result.success, false);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message);
    assert.ok(messages.includes('wizard.missingCustomer'));
    assert.ok(messages.includes('wizard.missingVehicle'));
  }
});

check('a part quantity below 1 is rejected', () => {
  const result = jobSchema.safeParse({
    customerId: 'c1',
    vehicleId: 'v1',
    parts: [{ partName: 'Filter', quantity: 0, unitPrice: '75' }],
    services: [],
  });
  assert.equal(result.success, false);
});

check('money fields tolerate what people actually type', () => {
  const parsed = jobSchema.parse({
    customerId: 'c1',
    vehicleId: 'v1',
    laborCharge: '₱1,250.50',
    expenses: '',
    services: [],
    parts: [],
  });
  assert.equal(parsed.laborCharge, 1250.5);
  assert.equal(parsed.expenses, 0);
});

/**
 * Each issue as "code @ path". The count is asserted first, on its own: a
 * failing deepEqual between thousands of issues and the two expected builds a
 * diff that alone can exhaust memory, so the failure message must stay cheap.
 */
function assertIssues(issues: { code: string; path: (string | number)[] }[], expected: string[]) {
  assert.equal(issues.length, expected.length, `expected ${expected.length} issue(s), got ${issues.length}`);
  assert.deepEqual(
    issues.map((i) => `${i.code} @ ${i.path.join('.')}`),
    expected,
  );
}

check('an oversized line-item list is refused before a single item is parsed', () => {
  // GHSA-mrhx-c7xc-m3w5. Plain Zod 3 checks .max(100) and then parses every
  // item anyway, keeping an issue for each one that fails — measured at ~10 s
  // and ~1.5 GB of heap for one 1 MB request. One issue per list, not 5,000.
  const result = jobSchema.safeParse({
    customerId: 'c1',
    vehicleId: 'v1',
    parts: Array.from({ length: 1_000 }, () => ({})),
    services: Array.from({ length: 1_000 }, () => ({})),
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assertIssues(result.error.issues, ['too_big @ parts', 'too_big @ services']);
  }
});

check('an oversized list stops the parse, so nothing reads its raw items', () => {
  // The discount rule sums quantity x unitPrice over the parts. Were the cap
  // only to flag the list, that sum would run over raw, unparsed items — and
  // a null item would throw instead of being rejected.
  const parse = () =>
    jobSchema.safeParse({
      customerId: 'c1',
      vehicleId: 'v1',
      discount: '1',
      parts: Array.from({ length: 101 }, () => null),
      services: [],
    });
  assert.doesNotThrow(parse);
  const result = parse();
  assert.equal(result.success, false);
  if (!result.success) {
    assertIssues(result.error.issues, ['too_big @ parts']);
  }
});

check('a job at the line-item cap is still checked item by item', () => {
  const part = { partName: 'Filter', quantity: '1', unitPrice: '75' };
  const full = jobSchema.parse({
    customerId: 'c1',
    vehicleId: 'v1',
    parts: Array.from({ length: 100 }, () => part),
    services: [],
  });
  assert.equal(full.parts.length, 100);

  // At the cap nothing is short-circuited: every bad item is still reported,
  // so the form can point at the exact field — partName, quantity, unitPrice.
  const result = jobSchema.safeParse({
    customerId: 'c1',
    vehicleId: 'v1',
    parts: Array.from({ length: 100 }, () => ({})),
    services: [],
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues.length, 300);
    assert.ok(result.error.issues.every((i) => i.path[0] === 'parts' && typeof i.path[1] === 'number'));
  }
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
