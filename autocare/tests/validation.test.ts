/**
 * Input schemas that need no database.
 *
 * `lib/validation.ts` is the only place Zod is used. These pin what a form
 * submission is allowed to contain where a Zod upgrade could quietly change
 * it — today, the shop email, whose regex Zod 4 rewrote.
 *
 * Run with:  npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { shopSettingsSchema } from '../lib/validation.ts';

const shop = { name: 'Test Car Care', address: 'Cavite', phone: '0917 000 0000' };

test('the shop email accepts ordinary addresses, trimmed, and may be left blank', () => {
  // [typed, stored]
  const accepted: [string, string | undefined][] = [
    ['owner@example.com', 'owner@example.com'],
    ['Owner.Name@Example.COM', 'Owner.Name@Example.COM'],
    ["o'brien@example.com", "o'brien@example.com"],
    ['first_last-1+receipts@mail.example.co', 'first_last-1+receipts@mail.example.co'],
    ['  owner@example.com  ', 'owner@example.com'],
    ['', undefined],
  ];
  for (const [email, stored] of accepted) {
    const result = shopSettingsSchema.safeParse({ ...shop, email });
    assert.equal(result.success, true, `"${email}" should be accepted`);
    if (result.success) assert.equal(result.data.email, stored, `"${email}"`);
  }
});

test('the shop email refuses malformed addresses', () => {
  const refused = [
    'owner',
    'owner@example',
    'owner@example.c',
    '.owner@example.com',
    'owner.@example.com',
    'own..er@example.com',
    "owner'@example.com",
    'owner@-example.com',
    'owner@example..com',
    'owner@example.com.',
    'owner@123.45',
    'owner@@example.com',
    'own er@example.com',
    '"owner"@example.com',
    'josé@example.com',
    'owner@exämple.com',
  ];
  for (const email of refused) {
    assert.equal(shopSettingsSchema.safeParse({ ...shop, email }).success, false, `"${email}" should be refused`);
  }
});
