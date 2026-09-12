// ── Live share & SOS ──────────────────────────────────────────────
// "My family might worry." — so give them a link and let them watch
// the dot move. Nothing else in the app is worth more than this.
//
// Cost note: writing a GPS fix every second would be 3,600 writes/hour
// and would burn the 20k/day free tier in under six rides. We throttle
// to one write per 20s AND require 25m of movement, so a rider stopped
// at a sari-sari store costs nothing.

import { db } from './firebase-config.js';
import { doc, setDoc, updateDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const SHARE_ID_KEY   = 'bgph_share_id';
const RIDER_NAME_KEY = 'bgph_rider_name';
const SOS_CONTACT_KEY = 'bgph_sos_contact';

const WRITE_INTERVAL_MS = 20000;  // at most one write per 20s
const MIN_MOVE_M        = 25;     // ...and only if actually moving

let lastWriteAt = 0;
let lastWritten = null;   // {lat, lng}
let sharing = false;

// Unambiguous alphabet: no O/0, I/1, L. Easier to read aloud over a call.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function makeShareId(len = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}

// Stable per device. Deliberately NOT the device UUID — a share link
// should not be a handle onto the rider's other data.
export function getShareId() {
  let id = localStorage.getItem(SHARE_ID_KEY);
  if (!id) {
    id = makeShareId();
    localStorage.setItem(SHARE_ID_KEY, id);
  }
  return id;
}

// Rotate the code if a link has been shared too widely.
export function resetShareId() {
  const id = makeShareId();
  localStorage.setItem(SHARE_ID_KEY, id);
  return id;
}

export function getRiderName() {
  return localStorage.getItem(RIDER_NAME_KEY) || 'Rider';
}
export function setRiderName(n) {
  localStorage.setItem(RIDER_NAME_KEY, String(n || '').trim().slice(0, 40) || 'Rider');
}

export function getSosContact() {
  return localStorage.getItem(SOS_CONTACT_KEY) || '';
}
export function setSosContact(c) {
  localStorage.setItem(SOS_CONTACT_KEY, String(c || '').trim().slice(0, 40));
}

export function shareUrl(id = getShareId()) {
  const base = location.href.replace(/[^/]*$/, '');
  return `${base}follow.html?id=${encodeURIComponent(id)}`;
}

export function isSharing() { return sharing; }

// ── Session lifecycle ──
export async function startShare() {
  if (!db) return { ok: false, msg: 'Live share needs a connection.' };
  const id = getShareId();
  try {
    await setDoc(doc(db, 'liveRides', id), {
      riderName: getRiderName(),
      active: true,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lat: null, lng: null,
      distanceKm: 0,
      speedKmh: 0,
    });
    sharing = true;
    lastWriteAt = 0;
    lastWritten = null;
    return { ok: true, url: shareUrl(id) };
  } catch (_) {
    return { ok: false, msg: 'Could not start live share.' };
  }
}

// Called on every GPS fix; writes rarely. Never throws — a failed
// position update must not interrupt a ride.
export async function pushPosition({ lat, lng, distanceKm = 0, speedKmh = 0, force = false }) {
  if (!sharing || !db) return;

  const now = Date.now();
  if (!force) {
    if (now - lastWriteAt < WRITE_INTERVAL_MS) return;
    if (lastWritten) {
      const moved = haversine(lastWritten.lat, lastWritten.lng, lat, lng);
      if (moved < MIN_MOVE_M) return;   // parked — don't pay for it
    }
  }

  lastWriteAt = now;
  lastWritten = { lat, lng };

  try {
    await updateDoc(doc(db, 'liveRides', getShareId()), {
      lat, lng,
      distanceKm: Number(distanceKm.toFixed(2)),
      speedKmh: Math.round(speedKmh),
      updatedAt: serverTimestamp(),
    });
  } catch (_) { /* best-effort */ }
}

export async function endShare({ lat, lng, distanceKm = 0 } = {}) {
  if (!db) { sharing = false; return; }
  try {
    await updateDoc(doc(db, 'liveRides', getShareId()), {
      active: false,
      endedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(typeof lat === 'number' ? { lat, lng } : {}),
      distanceKm: Number(distanceKm.toFixed(2)),
    });
  } catch (_) {}
  sharing = false;
}

// ── SOS ──
// No server, no paid SMS gateway. Build a message the rider can fire
// through whatever they already use — Messenger, SMS, Viber.
export function buildSosMessage({ lat, lng }) {
  const maps = `https://www.google.com/maps?q=${lat},${lng}`;
  return `I need help. I'm stopped on my bike ride here: ${maps} — ${getRiderName()}`;
}

export function sosSmsHref({ lat, lng }) {
  const body = encodeURIComponent(buildSosMessage({ lat, lng }));
  const to   = getSosContact().replace(/[^\d+]/g, '');
  // The ?body= form works on Android; iOS wants &body=. Android is the target.
  return to ? `sms:${to}?body=${body}` : `sms:?body=${body}`;
}

// Native share sheet where available — reaches Messenger/Viber directly.
export async function shareSos({ lat, lng }) {
  const text = buildSosMessage({ lat, lng });
  if (navigator.share) {
    try { await navigator.share({ title: 'I need help', text }); return true; }
    catch (_) { return false; }   // user dismissed
  }
  try { await navigator.clipboard.writeText(text); return 'copied'; }
  catch (_) { return false; }
}

export async function shareRideLink() {
  const url = shareUrl();
  const text = `Follow my bike ride live: ${url}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Follow my ride', text, url }); return true; }
    catch (_) { return false; }
  }
  try { await navigator.clipboard.writeText(url); return 'copied'; }
  catch (_) { return false; }
}

// Local copy so this module doesn't depend on geo.js.
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = d => d * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
