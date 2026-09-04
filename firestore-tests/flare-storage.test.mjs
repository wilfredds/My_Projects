// Rules tests for flare/storage.rules
//
// FLARE uploads training files straight from the authoring browser to Cloud
// Storage, because a 500 MB video cannot pass through a serverless function.
// That means no server sits in the upload path and these rules are the entire
// authorization decision — which is exactly why they are tested against the
// real emulator rather than trusted.
//
// The rules read the uploader's Firestore user document to decide who is an
// administrator, so this suite boots both emulators and seeds Firestore first.
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

const STORAGE_RULES = new URL('../flare/storage.rules', import.meta.url);
const FIRESTORE_RULES = new URL('../flare/firestore.rules', import.meta.url);

const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}

const testEnv = await initializeTestEnvironment({
  projectId: 'flare-storage-test',
  firestore: { rules: readFileSync(FIRESTORE_RULES, 'utf8'), host: '127.0.0.1', port: 8080 },
  storage: { rules: readFileSync(STORAGE_RULES, 'utf8'), host: '127.0.0.1', port: 9199 },
});

await testEnv.clearFirestore();
await testEnv.clearStorage();

const ADMIN = 'admin-uid';
const LEARNER = 'learner-uid';
const PENDING = 'pending-uid';
const SUSPENDED = 'suspended-uid';

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const person = (role, status) => ({ role, status, email: 'x@bfp.gov.ph' });

  await setDoc(doc(db, 'users', ADMIN), person('admin', 'active'));
  await setDoc(doc(db, 'users', LEARNER), person('learner', 'active'));
  await setDoc(doc(db, 'users', PENDING), person('learner', 'pending'));
  await setDoc(doc(db, 'users', SUSPENDED), person('learner', 'suspended'));

  // A file already in place, so read and delete have something to act on.
  const storage = ctx.storage();
  await uploadBytes(ref(storage, 'catalog/land/lesson-1/resources/existing'), new Uint8Array([1, 2, 3]), {
    contentType: 'application/pdf',
  });
});

const anon = testEnv.unauthenticatedContext().storage();
const admin = testEnv.authenticatedContext(ADMIN).storage();
const learner = testEnv.authenticatedContext(LEARNER).storage();
const pending = testEnv.authenticatedContext(PENDING).storage();
const suspended = testEnv.authenticatedContext(SUSPENDED).storage();

const PDF = { contentType: 'application/pdf' };
const MP4 = { contentType: 'video/mp4' };
const small = () => new Uint8Array(16);

const at = (storage, name) => ref(storage, `catalog/land/lesson-1/resources/${name}`);

// --- who may upload ----------------------------------------------------------

await check('admin CAN upload a PDF', () =>
  assertSucceeds(uploadBytes(at(admin, 'manual'), small(), PDF)));

await check('admin CAN upload an MP4', () =>
  assertSucceeds(uploadBytes(at(admin, 'clip'), small(), MP4)));

await check('a learner CANNOT upload', () =>
  assertFails(uploadBytes(at(learner, 'learner-upload'), small(), PDF)));

await check('an anonymous visitor CANNOT upload', () =>
  assertFails(uploadBytes(at(anon, 'anon-upload'), small(), PDF)));

await check('a PENDING account CANNOT upload', () =>
  assertFails(uploadBytes(at(pending, 'pending-upload'), small(), PDF)));

await check('a SUSPENDED account CANNOT upload', () =>
  assertFails(uploadBytes(at(suspended, 'suspended-upload'), small(), PDF)));

// --- content type allowlist --------------------------------------------------

await check('admin CANNOT upload an executable', () =>
  assertFails(uploadBytes(at(admin, 'tool'), small(), { contentType: 'application/x-msdownload' })));

await check('admin CANNOT upload HTML', () =>
  assertFails(uploadBytes(at(admin, 'page'), small(), { contentType: 'text/html' })));

await check('admin CANNOT upload SVG (it can carry script)', () =>
  assertFails(uploadBytes(at(admin, 'icon'), small(), { contentType: 'image/svg+xml' })));

await check('admin CANNOT upload a file with no content type', () =>
  assertFails(uploadBytes(at(admin, 'unknown'), small(), { contentType: 'application/octet-stream' })));

// --- size caps ---------------------------------------------------------------

await check('admin CANNOT upload a document over 25 MB', () =>
  assertFails(uploadBytes(at(admin, 'huge-pdf'), new Uint8Array(26 * 1024 * 1024), PDF)));

await check('admin CANNOT upload an empty file', () =>
  assertFails(uploadBytes(at(admin, 'empty'), new Uint8Array(0), PDF)));

// --- who may read ------------------------------------------------------------

await check('an activated learner CAN read training material', () =>
  assertSucceeds(getBytes(at(learner, 'existing'))));

await check('an anonymous visitor CANNOT read training material', () =>
  assertFails(getBytes(at(anon, 'existing'))));

await check('a PENDING account CANNOT read training material', () =>
  assertFails(getBytes(at(pending, 'existing'))));

await check('a SUSPENDED account CANNOT read training material', () =>
  assertFails(getBytes(at(suspended, 'existing'))));

// --- delete ------------------------------------------------------------------

await check('a learner CANNOT delete a file', () =>
  assertFails(deleteObject(at(learner, 'existing'))));

await check('admin CAN delete a file', () =>
  assertSucceeds(deleteObject(at(admin, 'existing'))));

// --- everything outside catalog/ --------------------------------------------

await check('admin CANNOT write outside catalog/', () =>
  assertFails(uploadBytes(ref(admin, 'anything/else.pdf'), small(), PDF)));

await check('admin CANNOT write to the bucket root', () =>
  assertFails(uploadBytes(ref(admin, 'root.pdf'), small(), PDF)));

await check('a learner CANNOT read outside catalog/', () =>
  assertFails(getBytes(ref(learner, 'anything/else.pdf'))));

await testEnv.cleanup();

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'FAIL') { failed++; console.log(`  ✗ ${name}\n      ${err}`); }
  else console.log(`  ✓ ${name}`);
}
console.log(`\n  ${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
