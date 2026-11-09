// Step-1 premise test. Two questions the whole odometer design rests on:
//
//  C4: does a rules `numIn(d.totalMileageKm, 0, 500000)` bound see the value
//      PRODUCED by FieldValue.increment? If not, increment cannot be used and
//      the design must fall back to runTransaction with an absolute write.
//  C5: is re-committing a batch with the SAME ride id denied? That denial is
//      what makes an ambiguous-timeout retry safe instead of double-counting.
//
//  C7–C9 are the same questions for "Mark replaced", which writes a
//  maintenance log AND resets a component in one batch.
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, collection, writeBatch, increment,
} from 'firebase/firestore';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { aBike, aRide, aLog } from './fixtures.js';

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

// ------------------------------------------------------------------------
// C7–C9: "Mark replaced" — a maintenance log create and a component reset in
// ONE batch. These replay the exact writes FirebaseBikesRepository sends:
// set(maintenance_logs/{clientId}) + a field-scoped update of `components`.

const chain = (installedAtKm) => ({
  id: 'c1', type: 'Chain', brand: 'Shimano', installedAtKm, lifespanKm: 3000,
});

/** The batch the app sends for one replacement. */
function replaceBatch(db, { logId = 'L1', bikeId = 'b1', installedAtKm = 4262.4, log = {} } = {}) {
  const b = writeBatch(db);
  b.set(doc(db, `maintenance_logs/${logId}`), aLog('alice', {
    bikeId, component: 'Chain', mileageAtService: 4262.4, status: 'dueSoon', ...log,
  }));
  b.update(doc(db, `bikes/${bikeId}`), { components: [chain(installedAtKm)] });
  return b;
}

const seedRoadie = (uid = 'alice', km = 4300) =>
  seed((db) => setDoc(doc(db, 'bikes/b1'), aBike(uid, { totalMileageKm: km, components: [chain(1850)] })));

async function storedBike() {
  let data;
  await env.withSecurityRulesDisabled(async (c) => {
    data = (await getDoc(doc(c.firestore(), 'bikes/b1'))).data();
  });
  return data;
}

async function logCount() {
  let n;
  await env.withSecurityRulesDisabled(async (c) => {
    n = (await getDocs(collection(c.firestore(), 'maintenance_logs'))).size;
  });
  return n;
}

describe('C7: log create + component reset commit atomically', () => {
  it('C7a owner commits; the reset lands and the SERVER odometer is kept', async () => {
    // The client's snapshot said 4262.4; another device has since moved the
    // bike to 4300. A field-scoped update must not roll that back.
    await seedRoadie('alice', 4300);
    await assertSucceeds(replaceBatch(alice).commit());

    const bike = await storedBike();
    expect(bike.components[0].installedAtKm).toBe(4262.4);
    expect(bike.totalMileageKm).toBe(4300);
    expect(await logCount()).toBe(1);
  });

  it('C7b a bike owned by someone else: denied, and no log is written', async () => {
    await seedRoadie('bob');
    await assertFails(replaceBatch(alice).commit());
    expect(await logCount()).toBe(0);
  });

  it('C7c a bike that does not exist: denied, and no log is written', async () => {
    await assertFails(replaceBatch(alice, { bikeId: 'ghost' }).commit());
    expect(await logCount()).toBe(0);
  });

  it('C7d an 81-char log label denies the WHOLE batch — the reset does not land', async () => {
    // Why the app clips the label: component `type` is unbounded free text,
    // and an unclipped long one would make that part impossible to replace.
    await seedRoadie();
    await assertFails(replaceBatch(alice, { log: { component: 'x'.repeat(81) } }).commit());
    expect((await storedBike()).components[0].installedAtKm).toBe(1850);
    expect(await logCount()).toBe(0);
  });
});

describe('C8: a retry with the SAME log id cannot record twice', () => {
  it('is denied; the first reset stands and there is exactly one log', async () => {
    await seedRoadie();
    await assertSucceeds(replaceBatch(alice).commit());

    // Same id, built from a newer snapshot. maintenance_logs update is denied,
    // so the whole batch fails instead of adding a second history entry.
    await assertFails(replaceBatch(alice, { installedAtKm: 4300 }).commit());

    expect((await storedBike()).components[0].installedAtKm).toBe(4262.4);
    expect(await logCount()).toBe(1);
  });
});

describe('C9: what does str(v, 80) count?', () => {
  it('80 UTF-16 units of emoji (160 UTF-8 bytes) is ACCEPTED — size() is not bytes', async () => {
    // The app clips labels to 80 UTF-16 code units. That is only safe if the
    // rules do not count UTF-8 bytes; this pins it.
    await seedRoadie();
    await assertSucceeds(replaceBatch(alice, { log: { component: '😀'.repeat(40) } }).commit());
  });
});
