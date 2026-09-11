// ── Hazard data layer ─────────────────────────────────────────────
// Snapshot architecture: hazards live on the device, not behind a
// per-session query. We read a bundled seed + a cached delta, and only
// ask Firestore for what changed since last sync.
//
// Why: a naive "geo-query on every app open" costs ~$540/mo at 100k
// users. This costs ~$5 — and, more importantly, proximity warnings
// keep working when you have no signal, which is exactly when you are
// on a mountain road and need them most.

import { db } from './firebase-config.js';
import {
  collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { GeoIndex } from './geo.js';

const CACHE_KEY   = 'bgph_hazard_cache_v1';
const SYNC_KEY    = 'bgph_hazard_lastsync_v1';
const QUEUE_KEY   = 'bgph_hazard_queue_v1';
const SYNC_MIN_MS = 30 * 60 * 1000;   // don't re-sync more than twice an hour

export const HAZARD_TYPES = {
  pothole: {
    label: 'Pothole',    tl: 'Lubak',
    icon: 'fa-circle-dot',   color: '#e67e22',
    speech: 'Pothole',       urgent: false,
  },
  theft: {
    label: 'Theft spot', tl: 'Nakawan',
    icon: 'fa-user-secret',  color: '#c0392b',
    speech: 'Bike theft reported here. Do not leave your bike',
    urgent: true, standing: true,   // warn on approach regardless of heading
  },
  danger: {
    label: 'Danger',     tl: 'Delikado',
    icon: 'fa-triangle-exclamation', color: '#c0392b',
    speech: 'Dangerous section',  urgent: true,
  },
  traffic: {
    label: 'Heavy traffic', tl: 'Matrapik',
    icon: 'fa-car-burst',    color: '#8e44ad',
    speech: 'Heavy traffic ahead', urgent: false,
  },
  flood: {
    label: 'Flooding',   tl: 'Baha',
    icon: 'fa-water',        color: '#2980b9',
    speech: 'Flooded road',  urgent: true,
  },
  dog: {
    label: 'Loose dog',  tl: 'Askal',
    icon: 'fa-dog',          color: '#d35400',
    speech: 'Loose dogs reported', urgent: false,
  },
  construction: {
    label: 'Construction', tl: 'Konstruksyon',
    icon: 'fa-person-digging', color: '#f39c12',
    speech: 'Road construction', urgent: false,
  },
  glass: {
    label: 'Glass/debris', tl: 'Bubog',
    icon: 'fa-shard',        color: '#16a085',
    speech: 'Glass or debris on the road', urgent: false,
  },
};

export function hazardMeta(type) {
  return HAZARD_TYPES[type] || HAZARD_TYPES.danger;
}

const index = new GeoIndex(0.01);
let hazards = [];

export function getIndex()   { return index; }
export function getHazards() { return hazards; }

// ── Local cache ──
function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || []; }
  catch { return []; }
}
function writeCache(list) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list.slice(0, 5000))); }
  catch (_) { /* quota — cache is an optimisation, not a requirement */ }
}

function dedupe(list) {
  const seen = new Map();
  for (const h of list) {
    if (!h || typeof h.lat !== 'number' || typeof h.lng !== 'number') continue;
    const id = h.id || `${h.type}:${h.lat.toFixed(5)}:${h.lng.toFixed(5)}`;
    if (!seen.has(id)) seen.set(id, { ...h, id });
  }
  return [...seen.values()];
}

function rebuild(list) {
  hazards = dedupe(list);
  index.build(hazards);
  return hazards;
}

// ── Load: bundled seed + cache, then optional Firestore delta ──
export async function loadHazards({ forceSync = false } = {}) {
  let seed = [];
  try {
    const res = await fetch('assets/data/hazards.json', { cache: 'no-cache' });
    if (res.ok) seed = await res.json();
  } catch (_) { /* offline — cache carries us */ }

  rebuild([...seed, ...readCache()]);

  const lastSync = Number(localStorage.getItem(SYNC_KEY) || 0);
  if (forceSync || Date.now() - lastSync > SYNC_MIN_MS) {
    syncFromCloud().catch(() => {});   // background, never blocks the ride
  }
  return hazards;
}

// Pull recent community reports. Bounded by limit() so a busy region
// can never blow up the read bill.
export async function syncFromCloud() {
  if (!db) return hazards;
  try {
    const q = query(
      collection(db, 'hazards'),
      orderBy('createdAt', 'desc'),
      limit(1000)
    );
    const snap = await getDocs(q);
    const cloud = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const merged = rebuild([...hazards, ...cloud]);
    writeCache(merged.filter(h => !h.seed));
    localStorage.setItem(SYNC_KEY, String(Date.now()));
    return merged;
  } catch (_) {
    return hazards;   // stale data beats no data
  }
}

// ── Offline write queue ──
function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; }
  catch { return []; }
}
function writeQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (_) {}
}

// Report a hazard. Always succeeds locally and appears on the map
// immediately; upload is best-effort and retried later.
export async function reportHazard({ lat, lng, type, note = '' }) {
  const meta = hazardMeta(type);
  const local = {
    id: `local_${crypto.randomUUID()}`,
    lat, lng, type,
    note: String(note).trim().slice(0, 200),
    label: meta.label,
    createdAt: Date.now(),
    reporter: localStorage.getItem('bikeUserId') || 'anon',
    pending: true,
  };

  rebuild([...hazards, local]);
  writeCache(hazards.filter(h => !h.seed));

  const queued = readQueue();
  queued.push(local);
  writeQueue(queued);

  flushQueue().catch(() => {});
  return local;
}

// Push queued reports to Firestore. Safe to call repeatedly.
export async function flushQueue() {
  if (!db || !navigator.onLine) return;
  const queued = readQueue();
  if (!queued.length) return;

  const remaining = [];
  for (const h of queued) {
    try {
      await addDoc(collection(db, 'hazards'), {
        lat: h.lat,
        lng: h.lng,
        type: h.type,
        note: h.note,
        reporter: h.reporter,
        createdAt: serverTimestamp(),
        confirms: 0,
      });
    } catch (_) {
      remaining.push(h);   // keep for the next attempt
    }
  }
  writeQueue(remaining);
}

// Retry the queue whenever connectivity returns.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flushQueue().catch(() => {}));
}
