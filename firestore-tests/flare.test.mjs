// Rules tests for flare/firestore.rules
//
// FLARE holds Bureau of Fire Protection personnel data and the training
// compliance records built on it. Three properties matter more than the rest,
// and each has denial tests below:
//
//   1. A Firebase account is not authorization. Until an administrator sets
//      status 'active', the account reads nothing.
//   2. A learner cannot promote themselves, nor edit the BFP identity fields
//      (rank, badge number) that make their training records verifiable.
//   3. Assessment answers, graded attempts, certificates, progress and audit
//      logs are unreachable from every client — admins included — because
//      they are written server-side by the Admin SDK.
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, addDoc, collection, updateDoc, deleteDoc, getDocs,
} from 'firebase/firestore';

const RULES = new URL('../flare/firestore.rules', import.meta.url);

const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}

const testEnv = await initializeTestEnvironment({
  projectId: 'flare-rules-test',
  firestore: { rules: readFileSync(RULES, 'utf8'), host: '127.0.0.1', port: 8080 },
});

await testEnv.clearFirestore();

const ALICE = 'alice-uid';       // activated learner
const BOB = 'bob-uid';           // a different activated learner
const PENDING = 'pending-uid';   // registered, not yet approved
const SUSPENDED = 'suspended-uid';
const ADMIN = 'admin-uid';

// Escalation attempts get their own throwaway accounts. If one of those rules
// ever breaks, the write succeeds for real against the emulator — and an
// attacker who just promoted themselves to admin would turn every later
// assertion red too, burying the one that actually broke. Keeping them off
// ALICE and PENDING means each assertion fails for its own reason.
const MALLORY = 'mallory-uid';           // activated learner, tries to escalate
const MALLORY_PENDING = 'mallory-pending-uid';

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();

  const learner = (name, status) => ({
    username: name, email: `${name}@bfp.gov.ph`, fullName: 'Dela Cruz, Juan',
    rank: 'Fire Officer I', badgeNumber: 'BFP-00123', unit: 'Cavite City Fire Station',
    position: 'Chief of Operator', contactNumber: '09170000000',
    role: 'learner', status,
    preferences: { theme: 'system', language: 'en', notificationsPaused: false },
  });

  await setDoc(doc(db, 'users', ALICE), learner('alice', 'active'));
  await setDoc(doc(db, 'users', BOB), learner('bob', 'active'));
  await setDoc(doc(db, 'users', PENDING), learner('pending', 'pending'));
  await setDoc(doc(db, 'users', SUSPENDED), learner('suspended', 'suspended'));
  await setDoc(doc(db, 'users', ADMIN), { ...learner('admin', 'active'), role: 'admin' });
  await setDoc(doc(db, 'users', MALLORY), learner('mallory', 'active'));
  await setDoc(doc(db, 'users', MALLORY_PENDING), learner('mallory-pending', 'pending'));

  await setDoc(doc(db, 'categories', 'land'), { title: 'Land Training', order: 3, published: true });
  await setDoc(doc(db, 'categories', 'land', 'lessons', 'lesson-1'), { title: 'Lesson 1', order: 1 });
  await setDoc(doc(db, 'categories', 'land', 'lessons', 'lesson-1', 'sections', 'discussion'), { body: 'Ropes and knots.' });
  await setDoc(doc(db, 'categories', 'land', 'lessons', 'lesson-1', 'questions', 'q1'), {
    order: 1, prompt: 'Which knot is used for hoisting?', type: 'single',
    options: [{ id: 'a', label: 'Bowline' }, { id: 'b', label: 'Clove hitch' }],
  });
  await setDoc(doc(db, 'answerKeys', 'land__lesson-1__q1'), { correctOptionIds: ['a'], points: 1 });

  await setDoc(doc(db, 'users', ALICE, 'progress', 'land'), {
    lessons: { 'lesson-1': { discussion: 'finished', resources: 'not_started', assessment: 'not_started' } },
  });
  await setDoc(doc(db, 'users', ALICE, 'attempts', 'a1'), { categoryId: 'land', score: 80, passed: true });
  await setDoc(doc(db, 'users', ALICE, 'certificates', 'c1'), { categoryId: 'land', serial: 'FLARE-2026-0001' });
  await setDoc(doc(db, 'users', ALICE, 'notifications', 'n1'), {
    type: 'course_update', title: 'Course Update', body: 'Fire Suppression Techniques has been added.', readAt: null,
  });

  await setDoc(doc(db, 'announcements', 'ann1'), { type: 'system', title: 'Scheduled maintenance', body: 'Sunday 8:00 PM.' });
  await setDoc(doc(db, 'auditLogs', 'log1'), { uid: ALICE, action: 'sign_in', ip: '203.0.113.7' });
});

const anon = testEnv.unauthenticatedContext().firestore();
const alice = testEnv.authenticatedContext(ALICE).firestore();
const bob = testEnv.authenticatedContext(BOB).firestore();
const pending = testEnv.authenticatedContext(PENDING).firestore();
const suspended = testEnv.authenticatedContext(SUSPENDED).firestore();
const admin = testEnv.authenticatedContext(ADMIN).firestore();
const mallory = testEnv.authenticatedContext(MALLORY).firestore();
const malloryPending = testEnv.authenticatedContext(MALLORY_PENDING).firestore();

const LESSON = ['categories', 'land', 'lessons', 'lesson-1'];

// --- an account is not authorization ----------------------------------------

await check('anonymous CANNOT read the catalogue', () =>
  assertFails(getDoc(doc(anon, 'categories', 'land'))));

await check('a PENDING account CANNOT read the catalogue', () =>
  assertFails(getDoc(doc(pending, 'categories', 'land'))));

await check('a SUSPENDED account CANNOT read the catalogue', () =>
  assertFails(getDoc(doc(suspended, 'categories', 'land'))));

await check('an ACTIVE account CAN read the catalogue', () =>
  assertSucceeds(getDoc(doc(alice, 'categories', 'land'))));

await check('a PENDING account CANNOT read announcements', () =>
  assertFails(getDoc(doc(pending, 'announcements', 'ann1'))));

await check('a PENDING account CAN still read its own user document', () =>
  assertSucceeds(getDoc(doc(pending, 'users', PENDING))));

// --- user documents ----------------------------------------------------------

await check('anonymous CANNOT read a user document', () =>
  assertFails(getDoc(doc(anon, 'users', ALICE))));

await check('owner CAN read own profile', () =>
  assertSucceeds(getDoc(doc(alice, 'users', ALICE))));

await check('another learner CANNOT read someone else\'s profile', () =>
  assertFails(getDoc(doc(bob, 'users', ALICE))));

await check('a learner CANNOT list all users', () =>
  assertFails(getDocs(collection(alice, 'users'))));

await check('admin CAN read any profile', () =>
  assertSucceeds(getDoc(doc(admin, 'users', ALICE))));

await check('admin CAN list users', () =>
  assertSucceeds(getDocs(collection(admin, 'users'))));

// --- privilege escalation ----------------------------------------------------

await check('owner CAN change own preferences', () =>
  assertSucceeds(updateDoc(doc(alice, 'users', ALICE), {
    preferences: { theme: 'dark', language: 'fil', notificationsPaused: true },
  })));

await check('owner CAN change own contact number', () =>
  assertSucceeds(updateDoc(doc(alice, 'users', ALICE), { contactNumber: '09171111111' })));

await check('owner CANNOT make themselves an admin', () =>
  assertFails(updateDoc(doc(mallory, 'users', MALLORY), { role: 'admin' })));

await check('owner CANNOT activate their own account', () =>
  assertFails(updateDoc(doc(malloryPending, 'users', MALLORY_PENDING), { status: 'active' })));

await check('owner CANNOT change their own rank', () =>
  assertFails(updateDoc(doc(mallory, 'users', MALLORY), { rank: 'Fire Chief' })));

await check('owner CANNOT change their own badge number', () =>
  assertFails(updateDoc(doc(mallory, 'users', MALLORY), { badgeNumber: 'BFP-99999' })));

await check('owner CANNOT smuggle a role change alongside a preference change', () =>
  assertFails(updateDoc(doc(mallory, 'users', MALLORY), {
    preferences: { theme: 'dark' }, role: 'admin',
  })));

await check('a learner CANNOT edit another learner\'s profile', () =>
  assertFails(updateDoc(doc(bob, 'users', ALICE), { contactNumber: '09170000001' })));

await check('nobody can create a user document from the client', () =>
  assertFails(setDoc(doc(alice, 'users', 'invented-uid'), { role: 'admin', status: 'active' })));

await check('admin CANNOT create a user document from the client either', () =>
  assertFails(setDoc(doc(admin, 'users', 'invented-uid'), { role: 'admin', status: 'active' })));

await check('owner CANNOT delete their own user document', () =>
  assertFails(deleteDoc(doc(alice, 'users', ALICE))));

await check('admin CAN activate a pending account', () =>
  assertSucceeds(updateDoc(doc(admin, 'users', PENDING), { status: 'active' })));

// --- catalogue is admin-authored ---------------------------------------------

await check('active learner CAN read a lesson', () =>
  assertSucceeds(getDoc(doc(alice, ...LESSON))));

await check('active learner CAN read a lesson section', () =>
  assertSucceeds(getDoc(doc(alice, ...LESSON, 'sections', 'discussion'))));

await check('active learner CAN read a question', () =>
  assertSucceeds(getDoc(doc(alice, ...LESSON, 'questions', 'q1'))));

await check('learner CANNOT edit a category', () =>
  assertFails(updateDoc(doc(alice, 'categories', 'land'), { title: 'Vandalised' })));

await check('learner CANNOT edit a lesson', () =>
  assertFails(updateDoc(doc(alice, ...LESSON), { title: 'Vandalised' })));

await check('learner CANNOT edit lesson content', () =>
  assertFails(updateDoc(doc(alice, ...LESSON, 'sections', 'discussion'), { body: 'Vandalised' })));

await check('learner CANNOT edit a question', () =>
  assertFails(updateDoc(doc(alice, ...LESSON, 'questions', 'q1'), { prompt: 'Vandalised' })));

await check('learner CANNOT create a category', () =>
  assertFails(setDoc(doc(alice, 'categories', 'fake'), { title: 'Fake' })));

await check('admin CAN edit a category', () =>
  assertSucceeds(updateDoc(doc(admin, 'categories', 'land'), { title: 'Land Training' })));

await check('admin CAN author a lesson', () =>
  assertSucceeds(setDoc(doc(admin, 'categories', 'land', 'lessons', 'lesson-2'), { title: 'Lesson 2', order: 2 })));

// --- answer keys are unreachable from every client ---------------------------

await check('learner CANNOT read an answer key', () =>
  assertFails(getDoc(doc(alice, 'answerKeys', 'land__lesson-1__q1'))));

await check('learner CANNOT list answer keys', () =>
  assertFails(getDocs(collection(alice, 'answerKeys'))));

await check('ADMIN CANNOT read an answer key from the client', () =>
  assertFails(getDoc(doc(admin, 'answerKeys', 'land__lesson-1__q1'))));

await check('ADMIN CANNOT write an answer key from the client', () =>
  assertFails(setDoc(doc(admin, 'answerKeys', 'land__lesson-1__q2'), { correctOptionIds: ['a'] })));

// --- progress, attempts and certificates cannot be self-declared -------------

await check('owner CAN read own progress', () =>
  assertSucceeds(getDoc(doc(alice, 'users', ALICE, 'progress', 'land'))));

await check('owner CANNOT write own progress', () =>
  assertFails(setDoc(doc(alice, 'users', ALICE, 'progress', 'land'), {
    lessons: { 'lesson-1': { discussion: 'finished', resources: 'finished', assessment: 'finished' } },
  })));

await check('another learner CANNOT read someone else\'s progress', () =>
  assertFails(getDoc(doc(bob, 'users', ALICE, 'progress', 'land'))));

await check('admin CAN read a learner\'s progress (compliance reporting)', () =>
  assertSucceeds(getDoc(doc(admin, 'users', ALICE, 'progress', 'land'))));

await check('owner CAN read own attempt', () =>
  assertSucceeds(getDoc(doc(alice, 'users', ALICE, 'attempts', 'a1'))));

await check('owner CANNOT forge a passing attempt', () =>
  assertFails(setDoc(doc(alice, 'users', ALICE, 'attempts', 'forged'), { score: 100, passed: true })));

await check('owner CANNOT rewrite the score of an existing attempt', () =>
  assertFails(updateDoc(doc(alice, 'users', ALICE, 'attempts', 'a1'), { score: 100 })));

await check('owner CAN read own certificate', () =>
  assertSucceeds(getDoc(doc(alice, 'users', ALICE, 'certificates', 'c1'))));

await check('owner CANNOT issue themselves a certificate', () =>
  assertFails(setDoc(doc(alice, 'users', ALICE, 'certificates', 'forged'), {
    categoryId: 'fire', serial: 'FLARE-2026-9999',
  })));

await check('another learner CANNOT read someone else\'s certificate', () =>
  assertFails(getDoc(doc(bob, 'users', ALICE, 'certificates', 'c1'))));

// --- the feed ----------------------------------------------------------------

await check('active learner CAN read an announcement', () =>
  assertSucceeds(getDoc(doc(alice, 'announcements', 'ann1'))));

await check('learner CANNOT publish an announcement', () =>
  assertFails(setDoc(doc(alice, 'announcements', 'fake'), { type: 'system', title: 'Fake' })));

await check('admin CAN publish an announcement', () =>
  assertSucceeds(setDoc(doc(admin, 'announcements', 'ann2'), { type: 'system', title: 'Drill Friday' })));

await check('owner CAN mark their own notification read', () =>
  assertSucceeds(updateDoc(doc(alice, 'users', ALICE, 'notifications', 'n1'), { readAt: new Date().toISOString() })));

await check('owner CANNOT rewrite a notification\'s content', () =>
  assertFails(updateDoc(doc(alice, 'users', ALICE, 'notifications', 'n1'), { body: 'Rewritten' })));

await check('owner CANNOT create a notification', () =>
  assertFails(setDoc(doc(alice, 'users', ALICE, 'notifications', 'fake'), { type: 'system', title: 'Fake' })));

await check('a learner CANNOT plant a notification in someone else\'s feed', () =>
  assertFails(setDoc(doc(bob, 'users', ALICE, 'notifications', 'planted'), { type: 'system', title: 'Planted' })));

await check('owner CANNOT delete a notification', () =>
  assertFails(deleteDoc(doc(alice, 'users', ALICE, 'notifications', 'n1'))));

// --- audit log ---------------------------------------------------------------

await check('learner CANNOT read the audit log', () =>
  assertFails(getDoc(doc(alice, 'auditLogs', 'log1'))));

await check('ADMIN CANNOT read the audit log from the client', () =>
  assertFails(getDoc(doc(admin, 'auditLogs', 'log1'))));

await check('learner CANNOT append to the audit log', () =>
  assertFails(addDoc(collection(alice, 'auditLogs'), { uid: ALICE, action: 'forged' })));

await check('ADMIN CANNOT append to the audit log from the client', () =>
  assertFails(addDoc(collection(admin, 'auditLogs'), { uid: ALICE, action: 'forged' })));

await check('nobody can erase an audit entry', () =>
  assertFails(deleteDoc(doc(admin, 'auditLogs', 'log1'))));

// --- catch-all ---------------------------------------------------------------

await check('arbitrary collections are denied', () =>
  assertFails(setDoc(doc(alice, 'whatever', 'x'), { a: 1 })));

await check('arbitrary collections are denied to admins too', () =>
  assertFails(setDoc(doc(admin, 'whatever', 'x'), { a: 1 })));

await testEnv.cleanup();

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'FAIL') { failed++; console.log(`  ✗ ${name}\n      ${err}`); }
  else console.log(`  ✓ ${name}`);
}
console.log(`\n  ${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
