import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, orderBy, getDocs,
} from 'firebase/firestore';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';

import { ALLOWED, aUser, aBike, aRide, aLog, aReport } from './fixtures.js';

let env;
let alice;
let bob;
let anon;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cyclemind',
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
  alice = env.authenticatedContext('alice').firestore();
  bob = env.authenticatedContext('bob').firestore();
  anon = env.unauthenticatedContext().firestore();
});

afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

/** Seed through the Admin escape hatch — never through the rules under test. */
async function seed(fn) {
  await env.withSecurityRulesDisabled(async (ctx) => { await fn(ctx.firestore()); });
}

// ---------------------------------------------------------------- drift guard

describe('G1 drift guard: fixtures match the rules allowlists', () => {
  const cases = [
    ['users', aUser()],
    ['bikes', aBike()],
    ['rides', aRide()],
    ['maintenance_logs', aLog()],
    ['ai_reports', aReport()],
  ];
  it.each(cases)('%s fixture emits exactly the allowlisted keys', (name, fixture) => {
    expect(Object.keys(fixture).sort()).toEqual([...ALLOWED[name]].sort());
  });
});

// -------------------------------------------------------------- happy paths

describe('happy path: writes the app actually makes', () => {
  it('users: create with null avatarUrl/weightKg and empty goals', async () => {
    await assertSucceeds(setDoc(doc(alice, 'users/alice'), aUser()));
  });

  it('users: get own non-existent doc (the authStateChanges path)', async () => {
    await assertSucceeds(getDoc(doc(alice, 'users/alice')));
  });

  it('users: merge-update changing level and goals', async () => {
    await seed((db) => setDoc(doc(db, 'users/alice'), aUser()));
    await assertSucceeds(setDoc(
      doc(alice, 'users/alice'),
      aUser({ profile: { ...aUser().profile, level: 'advanced' }, goals: ['loseWeight', 'prepareRace'] }),
      { merge: true },
    ));
  });

  it('users: merge-update against a missing doc behaves as create', async () => {
    await assertSucceeds(setDoc(doc(alice, 'users/alice'), aUser(), { merge: true }));
  });

  it('bikes: create with null imageUrl and empty components', async () => {
    await assertSucceeds(setDoc(doc(alice, 'bikes/b1'), aBike()));
  });

  it('bikes: merge-update adding a component (the BikeDetailScreen path)', async () => {
    await seed((db) => setDoc(doc(db, 'bikes/b1'), aBike()));
    await assertSucceeds(setDoc(doc(alice, 'bikes/b1'), aBike('alice', {
      components: [{ id: 'c1', type: 'Chain', brand: 'Shimano', installedAtKm: 2000, lifespanKm: 3000 }],
    }), { merge: true }));
  });

  it('bikes: field-scoped update of components (setComponents / replaceComponent)', async () => {
    // The write path the app actually uses. It omits totalMileageKm, so the
    // stored odometer carries through and bikeShapeOk sees a complete doc.
    await seed((db) => setDoc(doc(db, 'bikes/b1'), aBike()));
    await assertSucceeds(updateDoc(doc(alice, 'bikes/b1'), {
      components: [{ id: 'c1', type: 'Chain', brand: 'KMC', installedAtKm: 4200, lifespanKm: 3000 }],
    }));
  });

  it('bikes: delete own', async () => {
    await seed((db) => setDoc(doc(db, 'bikes/b1'), aBike()));
    await assertSucceeds(deleteDoc(doc(alice, 'bikes/b1')));
  });

  it('rides: create with all three sensors null (real AddRideScreen output)', async () => {
    await assertSucceeds(setDoc(doc(alice, 'rides/r1'), aRide()));
  });

  it('rides: create with cadence set, others null', async () => {
    await assertSucceeds(setDoc(doc(alice, 'rides/r2'), aRide('alice', { cadence: 84, bikeId: 'b1' })));
  });

  it('rides: degenerate but legal — zero duration/speed, empty title', async () => {
    await assertSucceeds(setDoc(doc(alice, 'rides/r3'),
      aRide('alice', { durationSec: 0, avgSpeed: 0, elevation: 0, distance: 0, calories: 0, title: '' })));
  });

  it('maintenance_logs: create', async () => {
    await assertSucceeds(setDoc(doc(alice, 'maintenance_logs/l1'), aLog()));
  });

  it('ai_reports: create, and score boundaries 0 and 100', async () => {
    await assertSucceeds(setDoc(doc(alice, 'ai_reports/p1'), aReport()));
    await assertSucceeds(setDoc(doc(alice, 'ai_reports/p2'), aReport('alice', { healthScore: 0 })));
    await assertSucceeds(setDoc(doc(alice, 'ai_reports/p3'), aReport('alice', { healthScore: 100 })));
  });
});

describe('happy path: the four queries the app issues', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'bikes/b1'), aBike());
      await setDoc(doc(db, 'rides/r1'), aRide());
      await setDoc(doc(db, 'maintenance_logs/l1'), aLog());
      await setDoc(doc(db, 'ai_reports/p1'), aReport());
    });
  });

  it('bikes where userId==uid', async () => {
    await assertSucceeds(getDocs(query(collection(alice, 'bikes'), where('userId', '==', 'alice'))));
  });

  it('rides where userId==uid orderBy startedAt desc', async () => {
    await assertSucceeds(getDocs(query(collection(alice, 'rides'),
      where('userId', '==', 'alice'), orderBy('startedAt', 'desc'))));
  });

  it('ai_reports where userId==uid where type==bikeHealth orderBy createdAt desc', async () => {
    await assertSucceeds(getDocs(query(collection(alice, 'ai_reports'),
      where('userId', '==', 'alice'), where('type', '==', 'bikeHealth'), orderBy('createdAt', 'desc'))));
  });

  it('maintenance_logs: the FIXED query (userId + bikeId) succeeds', async () => {
    await assertSucceeds(getDocs(query(collection(alice, 'maintenance_logs'),
      where('userId', '==', 'alice'), where('bikeId', '==', 'bike-1'), orderBy('serviceDate', 'desc'))));
  });

  it('maintenance_logs: the OLD query (bikeId only) FAILS — regression lock', async () => {
    await assertFails(getDocs(query(collection(alice, 'maintenance_logs'),
      where('bikeId', '==', 'bike-1'), orderBy('serviceDate', 'desc'))));
  });
});

// ------------------------------------------------------------------ attacks

describe('attack: ownership', () => {
  beforeEach(async () => { await seed((db) => setDoc(doc(db, 'bikes/b1'), aBike())); });

  it('alice cannot reassign her bike userId to bob', async () => {
    await assertFails(setDoc(doc(alice, 'bikes/b1'), aBike('bob'), { merge: true }));
  });

  it('alice cannot reassign to a third uid', async () => {
    await assertFails(setDoc(doc(alice, 'bikes/b1'), aBike('mallory'), { merge: true }));
  });

  it('alice cannot create a bike owned by bob', async () => {
    await assertFails(setDoc(doc(alice, 'bikes/b2'), aBike('bob')));
  });

  it('bob cannot edit alice bike even leaving userId intact', async () => {
    await assertFails(setDoc(doc(bob, 'bikes/b1'), aBike('alice', { name: 'Stolen' }), { merge: true }));
  });

  it('users doc cannot gain a userId field', async () => {
    await assertFails(setDoc(doc(alice, 'users/alice'), { ...aUser(), userId: 'alice' }));
  });

  it('alice cannot write bob users doc', async () => {
    await assertFails(setDoc(doc(alice, 'users/bob'), aUser()));
  });

  it('users email is pinned on update', async () => {
    await seed((db) => setDoc(doc(db, 'users/alice'), aUser()));
    await assertFails(setDoc(doc(alice, 'users/alice'),
      aUser({ email: 'ceo@company.com' }), { merge: true }));
  });
});

describe('attack: field injection', () => {
  it('bikes create with isAdmin', async () => {
    await assertFails(setDoc(doc(alice, 'bikes/b9'), { ...aBike(), isAdmin: true }));
  });

  it('bikes MERGE-update with an injected field', async () => {
    await seed((db) => setDoc(doc(db, 'bikes/b1'), aBike()));
    await assertFails(setDoc(doc(alice, 'bikes/b1'),
      { ...aBike(), verified: true }, { merge: true }));
  });

  it('users create with top-level role', async () => {
    await assertFails(setDoc(doc(alice, 'users/alice'), { ...aUser(), role: 'admin' }));
  });

  it('users merge-update with a NESTED injected profile key', async () => {
    await seed((db) => setDoc(doc(db, 'users/alice'), aUser()));
    await assertFails(setDoc(doc(alice, 'users/alice'),
      aUser({ profile: { ...aUser().profile, role: 'admin' } }), { merge: true }));
  });

  it('rides / logs / reports reject an extra key', async () => {
    await assertFails(setDoc(doc(alice, 'rides/r9'), { ...aRide(), hacked: 1 }));
    await assertFails(setDoc(doc(alice, 'maintenance_logs/l9'), { ...aLog(), hacked: 1 }));
    await assertFails(setDoc(doc(alice, 'ai_reports/p9'), { ...aReport(), hacked: 1 }));
  });
});

describe('attack: cross-user and unscoped reads', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users/alice'), aUser());
      await setDoc(doc(db, 'bikes/b1'), aBike());
      await setDoc(doc(db, 'rides/r1'), aRide());
      await setDoc(doc(db, 'maintenance_logs/l1'), aLog());
      await setDoc(doc(db, 'ai_reports/p1'), aReport());
    });
  });

  it('bob cannot read alice docs', async () => {
    await assertFails(getDoc(doc(bob, 'users/alice')));
    await assertFails(getDoc(doc(bob, 'bikes/b1')));
    await assertFails(getDoc(doc(bob, 'rides/r1')));
    await assertFails(getDoc(doc(bob, 'maintenance_logs/l1')));
    await assertFails(getDoc(doc(bob, 'ai_reports/p1')));
  });

  it('alice cannot query for bob docs', async () => {
    await assertFails(getDocs(query(collection(alice, 'bikes'), where('userId', '==', 'bob'))));
  });

  it('unscoped collection listing is denied', async () => {
    await assertFails(getDocs(collection(alice, 'bikes')));
    await assertFails(getDocs(collection(alice, 'rides')));
    await assertFails(getDocs(collection(alice, 'maintenance_logs')));
    await assertFails(getDocs(collection(alice, 'ai_reports')));
    await assertFails(getDocs(collection(alice, 'users')));
  });

  it('anonymous access is denied', async () => {
    await assertFails(getDoc(doc(anon, 'bikes/b1')));
    await assertFails(setDoc(doc(anon, 'bikes/b2'), aBike()));
  });
});

describe('attack: ai_usage is server-only', () => {
  beforeEach(async () => {
    await seed((db) => setDoc(doc(db, 'ai_usage/alice_2026-11-07'),
      { uid: 'alice', day: '2026-11-07', units: 42 }));
  });

  it('client cannot read its own quota', async () => {
    await assertFails(getDoc(doc(alice, 'ai_usage/alice_2026-11-07')));
  });

  it('client cannot reset its own quota', async () => {
    await assertFails(setDoc(doc(alice, 'ai_usage/alice_2026-11-07'),
      { uid: 'alice', day: '2026-11-07', units: 0 }, { merge: true }));
    await assertFails(deleteDoc(doc(alice, 'ai_usage/alice_2026-11-07')));
  });
});

describe('attack: enums and literals', () => {
  it('bad rider level', async () => {
    await assertFails(setDoc(doc(alice, 'users/alice'),
      aUser({ profile: { ...aUser().profile, level: 'pro' } })));
  });

  it('bad goal, alone and mixed with a valid one', async () => {
    await assertFails(setDoc(doc(alice, 'users/alice'), aUser({ goals: ['winTour'] })));
    await assertFails(setDoc(doc(alice, 'users/alice'), aUser({ goals: ['loseWeight', 'winTour'] })));
  });

  it('bad maintenance status — wrong case', async () => {
    await assertFails(setDoc(doc(alice, 'maintenance_logs/l9'), aLog('alice', { status: 'OK' })));
  });

  it('bad risk level and non-bikeHealth type', async () => {
    await assertFails(setDoc(doc(alice, 'ai_reports/p9'), aReport('alice', { riskLevel: 'critical' })));
    await assertFails(setDoc(doc(alice, 'ai_reports/p8'), aReport('alice', { type: 'other' })));
  });
});

describe('attack: types', () => {
  it('ride distance as a string', async () => {
    await assertFails(setDoc(doc(alice, 'rides/r9'), aRide('alice', { distance: '42' })));
  });

  it('ride startedAt as an ISO string', async () => {
    await assertFails(setDoc(doc(alice, 'rides/r8'), aRide('alice', { startedAt: '2026-11-01T06:00:00Z' })));
  });

  it('preference as a string', async () => {
    await assertFails(setDoc(doc(alice, 'users/alice'),
      aUser({ preferences: { ...aUser().preferences, darkMode: 'true' } })));
  });

  it('components as a map instead of a list', async () => {
    await assertFails(setDoc(doc(alice, 'bikes/b9'), aBike('alice', { components: {} })));
  });

  it('null in a NON-nullable field is rejected', async () => {
    await assertFails(setDoc(doc(alice, 'rides/r7'), aRide('alice', { distance: null })));
    await assertFails(setDoc(doc(alice, 'rides/r6'), aRide('alice', { title: null })));
    // maintenance_logs.bikeId is non-nullable — unlike rides/ai_reports bikeId.
    await assertFails(setDoc(doc(alice, 'maintenance_logs/l8'), aLog('alice', { bikeId: null })));
  });
});

describe('attack: ranges and sizes', () => {
  it('health score out of 0..100', async () => {
    await assertFails(setDoc(doc(alice, 'ai_reports/p7'), aReport('alice', { healthScore: 101 })));
    await assertFails(setDoc(doc(alice, 'ai_reports/p6'), aReport('alice', { healthScore: -1 })));
  });

  it('negative mileage', async () => {
    await assertFails(setDoc(doc(alice, 'bikes/b7'), aBike('alice', { totalMileageKm: -1 })));
  });

  it('absurd derived avgSpeed (50km in 1min = 3000 km/h)', async () => {
    await assertFails(setDoc(doc(alice, 'rides/r5'), aRide('alice', { avgSpeed: 3000 })));
  });

  it('oversized summary and component list', async () => {
    await assertFails(setDoc(doc(alice, 'ai_reports/p5'), aReport('alice', { summary: 'x'.repeat(5000) })));
    await assertFails(setDoc(doc(alice, 'bikes/b6'), aBike('alice', {
      components: Array.from({ length: 61 }, (_, i) => ({ id: `c${i}` })),
    })));
  });
});

describe('attack: operations the app never performs', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users/alice'), aUser());
      await setDoc(doc(db, 'rides/r1'), aRide());
      await setDoc(doc(db, 'maintenance_logs/l1'), aLog());
      await setDoc(doc(db, 'ai_reports/p1'), aReport());
    });
  });

  it('update is denied on rides / logs / reports', async () => {
    await assertFails(setDoc(doc(alice, 'rides/r1'), aRide('alice', { title: 'edited' }), { merge: true }));
    await assertFails(setDoc(doc(alice, 'maintenance_logs/l1'), aLog('alice', { notes: 'x' }), { merge: true }));
    await assertFails(setDoc(doc(alice, 'ai_reports/p1'), aReport('alice', { summary: 'x' }), { merge: true }));
  });

  it('delete is denied on users / logs / reports', async () => {
    await assertFails(deleteDoc(doc(alice, 'users/alice')));
    await assertFails(deleteDoc(doc(alice, 'maintenance_logs/l1')));
    await assertFails(deleteDoc(doc(alice, 'ai_reports/p1')));
  });

  it('a create missing a required key is denied', async () => {
    const { tires, ...noTires } = aBike();
    await assertFails(setDoc(doc(alice, 'bikes/b5'), noTires));
    const { preferences, ...noPrefs } = aUser();
    await assertFails(setDoc(doc(alice, 'users/alice2'), noPrefs));
  });
});

describe('attack: unknown collections', () => {
  it('catch-all denies anything not explicitly matched', async () => {
    await assertFails(setDoc(doc(alice, 'bike_passports/x'), { userId: 'alice' }));
    await assertFails(getDoc(doc(alice, 'anything/y')));
  });
});

// --------------------------------------------------- odometerDeltaKm bounds

describe('rides: odometerDeltaKm', () => {
  it('accepts a valid delta, and null for an untracked ride', async () => {
    await assertSucceeds(setDoc(doc(alice, 'rides/d1'),
      aRide('alice', { bikeId: 'b1', odometerDeltaKm: 42.5 })));
    await assertSucceeds(setDoc(doc(alice, 'rides/d2'),
      aRide('alice', { odometerDeltaKm: null })));
  });

  it('rejects a negative, oversized or non-numeric delta', async () => {
    await assertFails(setDoc(doc(alice, 'rides/d3'), aRide('alice', { odometerDeltaKm: -1 })));
    await assertFails(setDoc(doc(alice, 'rides/d4'), aRide('alice', { odometerDeltaKm: 2001 })));
    await assertFails(setDoc(doc(alice, 'rides/d5'), aRide('alice', { odometerDeltaKm: '42' })));
  });

  it('still accepts a legacy ride: bikeId set, delta null', async () => {
    // Rides written before odometer accounting carry a bike but no delta.
    // They must stay valid, which is why the rules do not tie the two together.
    await assertSucceeds(setDoc(doc(alice, 'rides/d6'),
      aRide('alice', { bikeId: 'bike-1', odometerDeltaKm: null })));
  });
});

// ------------------------------------------------ maintenance_logs bounds

describe('maintenance_logs: field bounds (mirrored by the mock and the use case)', () => {
  it('component label: 80 chars passes, 81 fails', async () => {
    await assertSucceeds(setDoc(doc(alice, 'maintenance_logs/m1'), aLog('alice', { component: 'x'.repeat(80) })));
    await assertFails(setDoc(doc(alice, 'maintenance_logs/m2'), aLog('alice', { component: 'x'.repeat(81) })));
  });

  it('notes: 2000 chars passes, 2001 fails', async () => {
    await assertSucceeds(setDoc(doc(alice, 'maintenance_logs/m3'), aLog('alice', { notes: 'x'.repeat(2000) })));
    await assertFails(setDoc(doc(alice, 'maintenance_logs/m4'), aLog('alice', { notes: 'x'.repeat(2001) })));
  });

  it('mileageAtService: 0 and 500000 pass, -1 and 500001 fail', async () => {
    await assertSucceeds(setDoc(doc(alice, 'maintenance_logs/m5'), aLog('alice', { mileageAtService: 0 })));
    await assertSucceeds(setDoc(doc(alice, 'maintenance_logs/m6'), aLog('alice', { mileageAtService: 500000 })));
    await assertFails(setDoc(doc(alice, 'maintenance_logs/m7'), aLog('alice', { mileageAtService: -1 })));
    await assertFails(setDoc(doc(alice, 'maintenance_logs/m8'), aLog('alice', { mileageAtService: 500001 })));
  });
});
