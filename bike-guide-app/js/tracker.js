import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const userId = () => localStorage.getItem('bikeUserId') || 'anonymous';

// Today's date in the rider's own time zone, as YYYY-MM-DD.
// toISOString() is UTC: in the Philippines (UTC+8) it returns yesterday's
// date for anything before 8:00 AM — which is exactly when people ride.
export function localDate(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Firestore rejects `undefined` field values, so drop them before writing.
function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export async function logRide(rideData) {
  return addDoc(collection(db, 'users', userId(), 'rides'), clean({
    ...rideData,
    date: rideData.date || localDate(),
    timestamp: serverTimestamp(),
  }));
}

// One shape for every ride, whichever screen saved it.
// GPS rides from the ride screen were saved without a `source` tag, under
// the name "Co-pilot ride", and with a UTC date; recognise them and take
// the date from the save time instead, which is when the ride ended.
function normalize(id, d) {
  const legacyGps = !d.source && (d.routeName === 'Co-pilot ride' || d.avgSpeedKmh != null);
  const gps = d.source === 'gps' || legacyGps;
  const ts = d.timestamp?.toMillis ? d.timestamp.toMillis() : (typeof d.ts === 'number' ? d.ts : null);
  return clean({
    id,
    distanceKm: Number(d.distanceKm) || 0,
    durationMinutes: Number(d.durationMinutes) || 0,
    date: legacyGps && ts ? localDate(new Date(ts)) : (d.date || (ts ? localDate(new Date(ts)) : '')),
    routeName: d.routeName === 'Co-pilot ride' ? '' : (d.routeName || ''),
    notes: d.notes || '',
    source: gps ? 'gps' : 'manual',
    avgSpeedKmh: d.avgSpeedKmh ?? d.avgSpeed,
    maxSpeedKmh: d.maxSpeedKmh,
    elevGainM: d.elevGainM ?? d.elevationGain,
    calories: d.calories,
    ts: ts ?? undefined,
  });
}

// Newest ride first, by the day it was ridden (then by when it was saved).
function byRideDate(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (b.ts || 0) - (a.ts || 0);
}

// Throws when Firestore can't be reached, so the page can tell "you have
// no rides" apart from "we couldn't load your rides".
export async function getRides() {
  const q = query(collection(db, 'users', userId(), 'rides'), orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  const rides = snap.docs.map(d => normalize(d.id, d.data())).sort(byRideDate);
  cacheRides(rides);
  return rides;
}

export async function deleteRide(rideId) {
  return deleteDoc(doc(db, 'users', userId(), 'rides', rideId));
}

// What logRide needs to put a deleted ride back (Undo).
export function rideForResave(r) {
  const { id, ts, ...rest } = r;
  return rest;
}

export function calcStats(rides) {
  const totalKm      = rides.reduce((s, r) => s + (r.distanceKm || 0), 0);
  const totalMinutes = rides.reduce((s, r) => s + (r.durationMinutes || 0), 0);
  const totalRides   = rides.length;
  const avgSpeed     = totalMinutes > 0 ? (totalKm / (totalMinutes / 60)).toFixed(1) : 0;
  const longestRide  = rides.reduce((max, r) => Math.max(max, r.distanceKm || 0), 0);
  return { totalKm: totalKm.toFixed(1), totalMinutes, totalRides, avgSpeed, longestRide };
}

// ── Last-known list ──
// Firestore's first connection takes seconds on mobile data; paint the
// list the rider saw last time straight away and refresh behind it.
const CACHE_KEY = () => `bgph_rides_cache_${userId()}`;

export function cachedRides() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY())) || null; } catch { return null; }
}

export function cacheRides(rides) {
  try { localStorage.setItem(CACHE_KEY(), JSON.stringify(rides.slice(0, 300))); } catch (_) {}
}

// ── Route thumbnails, kept on this phone only ──
// A ride's GPS track shows where the rider starts and ends — usually home.
// Ride documents are protected only by an unguessable device ID (see
// firestore.rules), so tracks never leave the device: a small copy is kept
// in localStorage for the history thumbnail, for the 40 latest rides.
const TRACK_INDEX = 'bgph_track_index';
const MAX_TRACKS = 40;

export function saveLocalTrack(rideId, track) {
  if (!rideId || !Array.isArray(track) || track.length < 2) return;
  try {
    const step = Math.max(1, Math.ceil(track.length / 80));
    const pts = track.filter((_, i) => i % step === 0 || i === track.length - 1)
      .map(p => [Number(p.lat.toFixed(5)), Number(p.lng.toFixed(5))]);
    localStorage.setItem(`bgph_track_${rideId}`, JSON.stringify(pts));
    const index = (JSON.parse(localStorage.getItem(TRACK_INDEX)) || []).filter(id => id !== rideId);
    index.push(rideId);
    while (index.length > MAX_TRACKS) localStorage.removeItem(`bgph_track_${index.shift()}`);
    localStorage.setItem(TRACK_INDEX, JSON.stringify(index));
  } catch (_) {}
}

export function getLocalTrack(rideId) {
  try { return JSON.parse(localStorage.getItem(`bgph_track_${rideId}`)) || null; } catch { return null; }
}

export function moveLocalTrack(fromId, toId) {
  const t = getLocalTrack(fromId);
  if (!t) return;
  try {
    localStorage.removeItem(`bgph_track_${fromId}`);
    const index = (JSON.parse(localStorage.getItem(TRACK_INDEX)) || []).filter(id => id !== fromId);
    localStorage.setItem(TRACK_INDEX, JSON.stringify(index));
  } catch (_) {}
  saveLocalTrack(toId, t.map(([lat, lng]) => ({ lat, lng })));
}
