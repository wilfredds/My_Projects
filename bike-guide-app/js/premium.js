import { db } from './firebase-config.js';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { isPremium, setPremium } from './app.js';

export async function submitPremiumRequest(gcashRef) {
  const userId = localStorage.getItem('bikeUserId');
  if (!userId || !gcashRef.trim()) return { success: false, msg: 'Please enter your GCash reference number.' };
  try {
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
  const userId = localStorage.getItem('bikeUserId');
  if (!userId) return false;
  try {
    const snap = await getDoc(doc(db, 'premiumUsers', userId));
    if (snap.exists() && snap.data().activated) {
      setPremium(true);
      return true;
    }
  } catch { /* offline */ }
  return false;
}
