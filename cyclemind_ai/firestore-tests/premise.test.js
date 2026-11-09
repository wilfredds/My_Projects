// Step-1 premise test. Two questions the whole odometer design rests on:
//
//  C4: does a rules `numIn(d.totalMileageKm, 0, 500000)` bound see the value
//      PRODUCED by FieldValue.increment? If not, increment cannot be used and
//      the design must fall back to runTransaction with an absolute write.
//  C5: is re-committing a batch with the SAME ride id denied? That denial is
//      what makes an ambiguous-timeout retry safe instead of double-counting.
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, writeBatch, increment } from 'firebase/firestore';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { aBike, aRide } from './fixtures.js';

let env, alice;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cyclemind',
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1', port: 8080,
    },
  });
  alice = env.authenticatedContext('alice').firestore();
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const seed = (fn) => env.withSecurityRulesDisabled(async (c) => { await fn(c.firestore()); });

describe('C4: do rules see the POST-increment value?', () => {
  it('an increment that stays in range is ALLOWED', async () => {
    await seed((db) => setDoc(doc(db, 'bikes/b1'), aBike('alice', { totalMileageKm: 4200 })));
    const b = writeBatch(alice);
    b.update(doc(alice, 'bikes/b1'), { totalMileageKm: increment(42) });
    await assertSucceeds(b.commit());
  });

  it('an increment that BREACHES the 500000 ceiling is DENIED', async () => {
    await seed((db) => setDoc(doc(db, 'bikes/b1'), aBike('alice', { totalMileageKm: 499000 })));
    const b = writeBatch(alice);
    b.update(doc(alice, 'bikes/b1'), { totalMileageKm: increment(5000) }); // -> 504000
    await assertFails(b.commit());
  });

  it('a decrement BELOW zero is DENIED', async () => {
    await seed((db) => setDoc(doc(db, 'bikes/b1'), aBike('alice', { totalMileageKm: 10 })));
    const b = writeBatch(alice);
    b.update(doc(alice, 'bikes/b1'), { totalMileageKm: increment(-50) }); // -> -40
    await assertFails(b.commit());
  });
});

describe('C4b: ride-create + bike-increment in ONE batch', () => {
  it('owner can commit both atomically', async () => {
    await seed((db) => setDoc(doc(db, 'bikes/b1'), aBike('alice', { totalMileageKm: 100 })));
    const b = writeBatch(alice);
    b.set(doc(alice, 'rides/r1'), aRide('alice', { bikeId: 'b1', distance: 42 }));
    b.update(doc(alice, 'bikes/b1'), { totalMileageKm: increment(42) });
    await assertSucceeds(b.commit());
  });

  it('is denied when the bike belongs to someone else', async () => {
    await seed((db) => setDoc(doc(db, 'bikes/b1'), aBike('bob')));
    const b = writeBatch(alice);
    b.set(doc(alice, 'rides/r2'), aRide('alice', { bikeId: 'b1', distance: 42 }));
    b.update(doc(alice, 'bikes/b1'), { totalMileageKm: increment(42) });
    await assertFails(b.commit());
  });

  it('is denied when the bike does not exist', async () => {
    const b = writeBatch(alice);
    b.set(doc(alice, 'rides/r3'), aRide('alice', { bikeId: 'ghost', distance: 42 }));
    b.update(doc(alice, 'bikes/ghost'), { totalMileageKm: increment(42) });
    await assertFails(b.commit());
  });
});

describe('C5: retry with the SAME ride id cannot double-count', () => {
  it('re-committing the identical batch is denied, and mileage moved exactly once', async () => {
    await seed((db) => setDoc(doc(db, 'bikes/b1'), aBike('alice', { totalMileageKm: 100 })));

    const first = writeBatch(alice);
    first.set(doc(alice, 'rides/r1'), aRide('alice', { bikeId: 'b1', distance: 42 }));
    first.update(doc(alice, 'bikes/b1'), { totalMileageKm: increment(42) });
    await assertSucceeds(first.commit());

    const retry = writeBatch(alice);
    retry.set(doc(alice, 'rides/r1'), aRide('alice', { bikeId: 'b1', distance: 42 }));
    retry.update(doc(alice, 'bikes/b1'), { totalMileageKm: increment(42) });
    await assertFails(retry.commit());

    await env.withSecurityRulesDisabled(async (c) => {
      const snap = await getDoc(doc(c.firestore(), 'bikes/b1'));
      expect(snap.data().totalMileageKm).toBe(142); // NOT 184
    });
  });
});

describe('C6: an over-subtracting delete fails WITHOUT losing the ride', () => {
  it('denial is atomic — the ride survives', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'bikes/b1'), aBike('alice', { totalMileageKm: 10 }));
      await setDoc(doc(db, 'rides/r1'), aRide('alice', { bikeId: 'b1', distance: 42 }));
    });
    const b = writeBatch(alice);
    b.delete(doc(alice, 'rides/r1'));
    b.update(doc(alice, 'bikes/b1'), { totalMileageKm: increment(-999999) });
    await assertFails(b.commit());

    await env.withSecurityRulesDisabled(async (c) => {
      const snap = await getDoc(doc(c.firestore(), 'rides/r1'));
      expect(snap.exists()).toBe(true); // nothing partially applied
    });
  });
});
