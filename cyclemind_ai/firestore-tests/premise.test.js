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
  doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, where, writeBatch, increment,
  disableNetwork, enableNetwork, getDocFromCache,
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

// ------------------------------------------------------------------------
// C10: deleting a ride whose bike has since been deleted.
//
// FirebaseRidesRepository.deleteRide used to fall back to a ride-only delete
// on `not-found`. That branch could never run. An update to a missing bike is
// evaluated against a null `resource`, ownsStored() errors, and the whole
// batch is rejected with PERMISSION-DENIED. The ride became undeletable.
//
// permission-denied also covers real refusals (C6), so the fallback must not
// fire on the error code alone: it first confirms the bike is gone.

/** The Dart fallback, replayed step for step. Returns which path ran. */
async function deleteRideLikeTheApp(db, uid, rideId, bikeId, delta) {
  const b = writeBatch(db);
  b.delete(doc(db, `rides/${rideId}`));
  b.update(doc(db, `bikes/${bikeId}`), { totalMileageKm: increment(-delta) });
  try {
    await b.commit();
    return 'batch';
  } catch (e) {
    if (e.code !== 'permission-denied') return 'failed';
    const mine = await getDocs(query(collection(db, 'bikes'), where('userId', '==', uid)));
    if (mine.docs.some((d) => d.id === bikeId)) return 'refused';
    await deleteDoc(doc(db, `rides/${rideId}`));
    return 'ride-only';
  }
}

async function exists(path) {
  let found;
  await env.withSecurityRulesDisabled(async (c) => {
    found = (await getDoc(doc(c.firestore(), path))).exists();
  });
  return found;
}

describe('C10: deleting a ride whose bike was deleted', () => {
  it('C10a the ride+decrement batch fails with permission-denied, NOT not-found', async () => {
    await seed((db) => setDoc(doc(db, 'rides/r1'),
      aRide('alice', { bikeId: 'gone', odometerDeltaKm: 42 })));
    const b = writeBatch(alice);
    b.delete(doc(alice, 'rides/r1'));
    b.update(doc(alice, 'bikes/gone'), { totalMileageKm: increment(-42) });

    const err = await b.commit().then(() => null, (e) => e);
    expect(err?.code).toBe('permission-denied');
    expect(await exists('rides/r1')).toBe(true); // atomic: nothing applied
  });

  it('C10b a direct get() cannot tell "deleted" from "not yours": both are denied', async () => {
    await seed((db) => setDoc(doc(db, 'bikes/bobs'), aBike('bob')));
    await assertFails(getDoc(doc(alice, 'bikes/gone')));
    await assertFails(getDoc(doc(alice, 'bikes/bobs')));
  });

  it("C10c once the owner's own bikes query confirms the bike is gone, the ride is deleted alone", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'bikes/other'), aBike('alice', { totalMileageKm: 4200 }));
      await setDoc(doc(db, 'rides/r1'), aRide('alice', { bikeId: 'gone', odometerDeltaKm: 42 }));
    });

    expect(await deleteRideLikeTheApp(alice, 'alice', 'r1', 'gone', 42)).toBe('ride-only');
    expect(await exists('rides/r1')).toBe(false);
    await env.withSecurityRulesDisabled(async (c) => {
      const other = await getDoc(doc(c.firestore(), 'bikes/other'));
      expect(other.data().totalMileageKm).toBe(4200); // no other odometer touched
    });
  });

  it('C10d if the bike still EXISTS, a denied batch is not downgraded: the ride survives', async () => {
    // Over-subtraction (C6) is denied for a bike that exists. Deleting the
    // ride alone there would leave its km on that odometer for good.
    await seed(async (db) => {
      await setDoc(doc(db, 'bikes/b1'), aBike('alice', { totalMileageKm: 10 }));
      await setDoc(doc(db, 'rides/r1'), aRide('alice', { bikeId: 'b1', odometerDeltaKm: 42 }));
    });

    expect(await deleteRideLikeTheApp(alice, 'alice', 'r1', 'b1', 42)).toBe('refused');
    expect(await exists('rides/r1')).toBe(true);
  });

  it('C10e the normal case is still one atomic batch that credits the km back', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'bikes/b1'), aBike('alice', { totalMileageKm: 142 }));
      await setDoc(doc(db, 'rides/r1'), aRide('alice', { bikeId: 'b1', odometerDeltaKm: 42 }));
    });

    expect(await deleteRideLikeTheApp(alice, 'alice', 'r1', 'b1', 42)).toBe('batch');
    expect(await exists('rides/r1')).toBe(false);
    await env.withSecurityRulesDisabled(async (c) => {
      const bike = await getDoc(doc(c.firestore(), 'bikes/b1'));
      expect(bike.data().totalMileageKm).toBe(100);
    });
  });
});

// ------------------------------------------------------------------------
// C11: offline writes. The three facts the "saved offline" design rests on.
//
// The app awaited every commit. A commit's promise settles only when the
// SERVER answers, so offline every save spun forever. The fix waits a few
// seconds, then reports the write as queued. That is only honest if (a) the
// write is already applied locally, (b) it is delivered on reconnect, and
// (c) a later rejection is observable, because Firestore rolls it back
// silently.
//
// Ids are unique to C11: `alice`'s local cache outlives clearFirestore().

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cached = (path) => getDocFromCache(doc(alice, path)).then((s) => s.exists(), () => false);

describe('C11: offline writes', () => {
  it('C11a offline, a commit stays PENDING, yet the write is already in the local cache', async () => {
    await seed((db) => setDoc(doc(db, 'bikes/off-b1'), aBike('alice', { totalMileageKm: 100 })));
    await disableNetwork(alice);
    try {
      const b = writeBatch(alice);
      b.set(doc(alice, 'rides/off-r1'), aRide('alice', { bikeId: 'off-b1', odometerDeltaKm: 42 }));
      b.update(doc(alice, 'bikes/off-b1'), { totalMileageKm: increment(42) });
      const commit = b.commit();

      const outcome = await Promise.race([
        commit.then(() => 'acknowledged'),
        sleep(1500).then(() => 'still pending'),
      ]);
      expect(outcome).toBe('still pending');
      expect(await cached('rides/off-r1')).toBe(true);
    } finally {
      await enableNetwork(alice);
    }
  }, 20000);

  it('C11b after reconnecting, the pending commit is delivered', async () => {
    await seed((db) => setDoc(doc(db, 'bikes/off-b2'), aBike('alice', { totalMileageKm: 100 })));
    await disableNetwork(alice);
    let commit;
    try {
      const b = writeBatch(alice);
      b.set(doc(alice, 'rides/off-r2'), aRide('alice', { bikeId: 'off-b2', odometerDeltaKm: 42 }));
      b.update(doc(alice, 'bikes/off-b2'), { totalMileageKm: increment(42) });
      commit = b.commit();
    } finally {
      await enableNetwork(alice);
    }
    await commit; // resolves once the server acknowledges

    await env.withSecurityRulesDisabled(async (c) => {
      const bike = await getDoc(doc(c.firestore(), 'bikes/off-b2'));
      expect(bike.data().totalMileageKm).toBe(142);
    });
  }, 20000);

  it('C11c a queued write the rules reject fails AFTER reconnect, and is rolled back locally', async () => {
    await disableNetwork(alice);
    let write;
    try {
      // bikeShapeOk caps name at 80. The client accepts it offline.
      write = setDoc(doc(alice, 'bikes/off-bad'), aBike('alice', { name: 'x'.repeat(81) }));
      expect(await cached('bikes/off-bad')).toBe(true);
    } finally {
      await enableNetwork(alice);
    }

    const err = await write.then(() => null, (e) => e);
    expect(err?.code).toBe('permission-denied');
    // Silently gone from the device: nothing tells the rider unless the app does.
    expect(await cached('bikes/off-bad')).toBe(false);
  }, 20000);
});
