import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const userId = () => localStorage.getItem('bikeUserId') || 'anonymous';

export async function logRide(rideData) {
  return addDoc(collection(db, 'users', userId(), 'rides'), {
    ...rideData,
    timestamp: serverTimestamp(),
  });
}

export async function getRides() {
  try {
    const q = query(collection(db, 'users', userId(), 'rides'), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

export async function deleteRide(rideId) {
  return deleteDoc(doc(db, 'users', userId(), 'rides', rideId));
}

export function calcStats(rides) {
  const totalKm      = rides.reduce((s, r) => s + (r.distanceKm || 0), 0);
  const totalMinutes = rides.reduce((s, r) => s + (r.durationMinutes || 0), 0);
  const totalRides   = rides.length;
  const avgSpeed     = totalMinutes > 0 ? (totalKm / (totalMinutes / 60)).toFixed(1) : 0;
  const longestRide  = rides.reduce((max, r) => Math.max(max, r.distanceKm || 0), 0);
  return { totalKm: totalKm.toFixed(1), totalMinutes, totalRides, avgSpeed, longestRide };
}
