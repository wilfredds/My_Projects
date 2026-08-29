import { db } from './firebase-config.js';
import { uid, legacyId } from './auth.js';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { isPremium, setPremium } from './app.js';

export async function submitPremiumRequest(gcashRef) {
  if (!gcashRef.trim()) return { success: false, msg: 'Please enter your GCash reference number.' };
  try {
    const userId = await uid();
    await addDoc(collection(db, 'premiumRequests'), {
      deviceId: userId,
      gcashRef: gcashRef.trim(),
      amount: 79,
      status: 'pending',
      submittedAt: serverTimestamp(),
    });
    return { success: true, msg: 'Request submitted! Please allow 1–24 hours for activation. Tap "Check Activation" below.' };
  } catch {
    return { success: false, msg: 'Network error. Please try again.' };
  }
}

export async function checkPremiumActivation() {
  try {
    const userId = await uid();

    // Entitlements granted since the move to authentication are keyed by UID.
    const snap = await getDoc(doc(db, 'premiumUsers', userId));
    if (snap.exists() && snap.data().activated) {
      setPremium(true);
      return true;
    }

    // Anyone who paid before that is recorded against their old device ID. The
    // rules allow reading it only while this account's profile still claims
    // that legacyId, so a user cannot lose access they already paid for.
    const legacy = legacyId();
    if (legacy && legacy !== userId) {
      const legacySnap = await getDoc(doc(db, 'premiumUsers', legacy));
      if (legacySnap.exists() && legacySnap.data().activated) {
        setPremium(true);
        return true;
      }
    }
  } catch { /* offline */ }
  return false;
}
