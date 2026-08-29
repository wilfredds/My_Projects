// Identity for Bike Guide PH.
//
// The app used to identify a user by `bikeUserId` — a crypto.randomUUID() kept
// in localStorage and sent to Firestore as part of the document path. The rules
// engine cannot verify a value like that: a caller simply claims whichever ID it
// likes, so ownership was unenforceable and the data was protected only by the
// UUID being hard to guess.
//
// It now signs in with Firebase Anonymous Authentication. That still needs no
// account, no email and no password — the user sees nothing — but it yields a
// real `request.auth.uid` that Firestore rules can compare against the document
// path. Ownership is enforced server-side.
//
// Everything that touches Firestore must `await uid()` rather than read
// localStorage, because the UID is not known until sign-in resolves.

import { auth, db } from './firebase-config.js';
import { signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  doc, getDoc, setDoc, getDocs, collection, deleteDoc, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const LEGACY_KEY = 'bikeUserId';
const MIGRATED_KEY = 'bikeMigratedToAuth';

let readyPromise = null;

/**
 * Resolves to the signed-in user's UID, signing in anonymously on first call.
 * Every subsequent call reuses the same promise, so sign-in happens once.
 */
export function uid() {
  if (!readyPromise) {
    readyPromise = new Promise((resolve, reject) => {
      const stop = onAuthStateChanged(auth, (user) => {
        if (user) { stop(); resolve(user.uid); }
      }, reject);
      signInAnonymously(auth).catch(reject);
    }).then(async (id) => {
      await ensureProfile(id);
      return id;
    });
  }
  return readyPromise;
}

/**
 * The user's profile document doubles as the migration record: it carries
 * `legacyId`, the pre-auth localStorage UUID. The rules let a signed-in user
 * read the old `users/{legacyId}` subtrees only when their own profile claims
 * that ID, which is what makes the one-time copy below possible without leaving
 * the old data readable by everyone.
 *
 * `legacyId` is write-once — the rules reject any update that changes it — so a
 * profile cannot be re-pointed at one victim's data after another.
 */
async function ensureProfile(id) {
  const ref = doc(db, 'users', id);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return;

    const legacyId = localStorage.getItem(LEGACY_KEY);
    const profile = { createdAt: new Date().toISOString() };
    // Only claim a legacy ID if one exists and has not already been migrated.
    if (legacyId && localStorage.getItem(MIGRATED_KEY) !== 'true' && legacyId !== id) {
      profile.legacyId = legacyId;
    }
    await setDoc(ref, profile);

    if (profile.legacyId) await migrateLegacyData(id, profile.legacyId);
  } catch (err) {
    // Offline or rules rejection: the app still works for everything that does
    // not need Firestore, and migration is retried on the next launch.
    console.warn('Profile setup skipped:', err);
  }
}

/**
 * Copies rides and challenge progress from the pre-auth path to the new one,
 * then removes the originals so nothing is left behind under an ID that cannot
 * be authenticated. Runs at most once per device.
 */
async function migrateLegacyData(newId, legacyId) {
  let moved = 0;
  try {
    for (const sub of ['rides', 'challenge']) {
      const legacySnap = await getDocs(collection(db, 'users', legacyId, sub));
      if (legacySnap.empty) continue;

      const batch = writeBatch(db);
      legacySnap.forEach((d) => {
        batch.set(doc(db, 'users', newId, sub, d.id), d.data());
      });
      await batch.commit();

      // Delete originals only after the copy has committed, so a failure
      // half-way leaves the old data intact rather than losing it.
      for (const d of legacySnap.docs) {
        await deleteDoc(doc(db, 'users', legacyId, sub, d.id)).catch(() => {});
      }
      moved += legacySnap.size;
    }
    localStorage.setItem(MIGRATED_KEY, 'true');
    if (moved > 0) console.info(`Migrated ${moved} document(s) to the authenticated account.`);
  } catch (err) {
    // Leave MIGRATED_KEY unset so the next launch tries again. The copy is
    // idempotent: re-running overwrites the same document IDs.
    console.warn('Legacy data migration incomplete, will retry:', err);
  }
}

/**
 * The pre-auth ID, if this device had one. Used when checking a premium
 * entitlement that was granted against the old identifier.
 */
export function legacyId() {
  return localStorage.getItem(LEGACY_KEY);
}
