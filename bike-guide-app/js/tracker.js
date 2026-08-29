import { db } from './firebase-config.js';
import { uid } from './auth.js';
import { collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Identity comes from Firebase Anonymous Auth, not localStorage. The previous
// `localStorage.getItem('bikeUserId') || 'anonymous'` had a nasty edge: any
// device without that key wrote into a single shared 'anonymous' bucket, so
// those users saw each other's rides. Awaiting the real UID removes that case
// entirely — there is no fallback identity to collide on.

export async function logRide(rideData) {
  const id = await uid();
  return addDoc(collection(db, 'users', id, 'rides'), {
    ...rideData,
    timestamp: serverTimestamp(),
  });
}

export async function getRides() {
  try {
    const id = await uid();
    const q = query(collection(db, 'users', id, 'rides'), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

export async function deleteRide(rideId) {
  const id = await uid();
  return deleteDoc(doc(db, 'users', id, 'rides', rideId));
}

export function calcStats(rides) {
  const totalKm      = rides.reduce((s, r) => s + (r.distanceKm || 0), 0);
  const totalMinutes = rides.reduce((s, r) => s + (r.durationMinutes || 0), 0);
  const totalRides   = rides.length;
  const avgSpeed     = totalMinutes > 0 ? (totalKm / (totalMinutes / 60)).toFixed(1) : 0;
  const longestRide  = rides.reduce((max, r) => Math.max(max, r.distanceKm || 0), 0);
  return { totalKm: totalKm.toFixed(1), totalMinutes, totalRides, avgSpeed, longestRide };
}
