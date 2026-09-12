// ── Bike registry & stolen-bike network ───────────────────────────
// The strategic core. A Facebook post about a stolen bike reaches the
// people who already follow you; it does nothing to stop the sale. A
// serial check that any buyer can run attacks theft on the DEMAND side,
// which is the only side that actually shrinks it.
//
// Storage split, and why:
//   users/{deviceId}/bikes/{id}  private registry, stays on your device's subtree
//   stolenBikes/{id}             public board, written ONLY when reporting stolen
//
// Serials are never published in the clear. We publish a SHA-256 hash so
// a buyer can check "is this serial stolen?" without the board becoming a
// harvestable list of every serial in the country.

import { db } from './firebase-config.js';
import {
  collection, doc, addDoc, setDoc, getDocs, query, where, orderBy, limit,
  serverTimestamp, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const deviceId = () => localStorage.getItem('bikeUserId') || 'anonymous';
const LOCAL_KEY = () => `bgph_bikes_${deviceId()}`;

// ── Serial handling ──
// Normalise aggressively: people transcribe serials with spaces, dashes
// and lowercase, and a check that fails on formatting is worse than useless.
export function normalizeSerial(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function hashSerial(serial) {
  const norm = normalizeSerial(serial);
  if (!norm) return null;
  const data = new TextEncoder().encode('kasama-bike-v1:' + norm);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Shown on the board so an owner can recognise their own entry without
// the full serial ever being public.
export function serialTail(serial) {
  const n = normalizeSerial(serial);
  return n.length > 4 ? '…' + n.slice(-4) : n;
}

// ── Photos ──
// Firebase Storage needs the Blaze plan for new buckets, so photos are
// compressed client-side and stored inline. Firestore's limit is 1 MiB
// per document; 800px JPEG at q0.7 lands around 60–120 KB, well inside it.
export function compressImage(file, maxDim = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Not an image'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode the image'));
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else       { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Local mirror ──
// The garage must open instantly and work with no signal, so the device
// keeps the source of truth for its own bikes.
function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY())) || []; }
  catch { return []; }
}
function writeLocal(list) {
  try { localStorage.setItem(LOCAL_KEY(), JSON.stringify(list)); } catch (_) {}
}

export function getBikes() { return readLocal(); }
export function getBike(id) { return readLocal().find(b => b.id === id) || null; }

// ── Register ──
export async function registerBike({ serial, brand, model, color, year, marks, photo }) {
  const clean = normalizeSerial(serial);
  if (clean.length < 4) throw new Error('Serial number looks too short. Check the frame under the bottom bracket.');

  const id = crypto.randomUUID();
  const bike = {
    id,
    serial: clean,                       // full serial: device + your own subtree only
    serialHash: await hashSerial(clean), // public lookup key
    serialTail: serialTail(clean),
    brand: String(brand || '').trim().slice(0, 40),
    model: String(model || '').trim().slice(0, 40),
    color: String(color || '').trim().slice(0, 30),
    year:  String(year  || '').trim().slice(0, 4),
    marks: String(marks || '').trim().slice(0, 300),
    photo: photo || null,
    registeredAt: Date.now(),
    status: 'owned',
  };

  writeLocal([...readLocal(), bike]);

  // Cloud copy is what makes "registered before the theft" checkable later.
  try {
    if (db) {
      await setDoc(doc(db, 'users', deviceId(), 'bikes', id), {
        ...bike,
        registeredAt: serverTimestamp(),
      });
    }
  } catch (_) { /* local registration still stands */ }

  return bike;
}

export function updateBikeLocal(id, patch) {
  const list = readLocal().map(b => (b.id === id ? { ...b, ...patch } : b));
  writeLocal(list);
  return list.find(b => b.id === id);
}

export async function deleteBike(id) {
  writeLocal(readLocal().filter(b => b.id !== id));
  try { if (db) await deleteDoc(doc(db, 'users', deviceId(), 'bikes', id)); } catch (_) {}
}

// ── Report stolen ──
// Publishes to the public board. Deliberately does NOT publish the serial
// in the clear — only the hash and the last four characters.
export async function reportStolen(id, { area, contact, note, lat, lng }) {
  const bike = getBike(id);
  if (!bike) throw new Error('Bike not found.');
  if (!db)   throw new Error('Reporting a stolen bike needs a connection.');

  const record = {
    serialHash: bike.serialHash,
    serialTail: bike.serialTail,
    brand: bike.brand,
    model: bike.model,
    color: bike.color,
    year:  bike.year,
    marks: bike.marks,
    photo: bike.photo || null,
    // Copied from registration so the board can show how long the bike was
    // registered before the theft — see the honesty note in reportAgeDays().
    registeredAt: bike.registeredAt,
    area:    String(area    || '').trim().slice(0, 80),
    contact: String(contact || '').trim().slice(0, 60),
    note:    String(note    || '').trim().slice(0, 300),
    lat: typeof lat === 'number' ? lat : null,
    lng: typeof lng === 'number' ? lng : null,
    reportedAt: serverTimestamp(),
    status: 'stolen',
  };

  const ref = await addDoc(collection(db, 'stolenBikes'), record);
  updateBikeLocal(id, { status: 'stolen', stolenDocId: ref.id, stolenAt: Date.now() });
  return ref.id;
}

export async function markRecovered(id) {
  const bike = getBike(id);
  if (!bike) return;
  updateBikeLocal(id, { status: 'owned', recoveredAt: Date.now() });
  // The public entry is left for a human to clear — a client should not be
  // able to delete board records, or a thief could erase the report.
}

// ── Public lookups ──
// The rules only expose documents with status == 'stolen', so a clean
// serial simply returns nothing. That is the correct answer, and it means
// the board can never be scraped into a list of every registered bike.
export async function checkSerial(serial) {
  if (!db) return { ok: false, msg: 'No connection.' };
  const hash = await hashSerial(serial);
  if (!hash) return { ok: false, msg: 'Enter a serial number.' };
  try {
    const snap = await getDocs(query(
      collection(db, 'stolenBikes'),
      where('serialHash', '==', hash),
      where('status', '==', 'stolen'),
      limit(5)
    ));
    if (snap.empty) return { ok: true, stolen: false };
    return { ok: true, stolen: true, hits: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
  } catch (e) {
    // Firestore needs a composite index the first time this query runs.
    // Saying so beats a silent "no results", which would read as "clean"
    // and is the most dangerous possible wrong answer here.
    if (e?.code === 'failed-precondition') {
      return { ok: false, needsIndex: true,
               msg: 'Search index still building. Open the browser console for the one-click setup link, then try again.' };
    }
    return { ok: false, msg: 'Could not check right now.' };
  }
}

export async function getStolenBoard(max = 50) {
  if (!db) return [];
  try {
    const snap = await getDocs(query(
      collection(db, 'stolenBikes'),
      where('status', '==', 'stolen'),
      orderBy('reportedAt', 'desc'),
      limit(max)
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    if (e?.code === 'failed-precondition') {
      console.warn('[Kasama] Firestore needs a composite index for the stolen board. ' +
                   'Click the link in the error below to create it:', e.message);
    }
    return [];
  }
}

// How long the bike was registered before it was reported stolen.
//
// Being straight about what this does and doesn't prove: without accounts
// there is no way to cryptographically stop someone registering a bike they
// do not own and reporting it minutes later. What we CAN do is make that
// visible. A bike registered eight months before the theft reads very
// differently from one registered ten minutes before, and the board shows
// which it is. Transparency, not prevention.
export function registrationLeadDays(rec) {
  const reg = rec?.registeredAt?.toMillis ? rec.registeredAt.toMillis() : rec?.registeredAt;
  const rep = rec?.reportedAt?.toMillis  ? rec.reportedAt.toMillis()  : rec?.reportedAt;
  if (!reg || !rep) return null;
  return Math.max(0, Math.round((rep - reg) / 86400000));
}

export function trustLabel(days) {
  if (days == null) return { text: 'Unknown', tone: 'warn' };
  if (days >= 180)  return { text: `Registered ${Math.round(days / 30)} months before the theft`, tone: 'good' };
  if (days >= 30)   return { text: `Registered ${Math.round(days / 30)} month(s) before the theft`, tone: 'good' };
  if (days >= 2)    return { text: `Registered ${days} days before the theft`, tone: 'ok' };
  return { text: 'Registered less than a day before the report — treat with caution', tone: 'warn' };
}
