// ── Follow screen ─────────────────────────────────────────────────
// What the rider's family sees. Written for someone non-technical and
// possibly worried: one clear status line, big numbers, no jargon, and
// it never silently stops updating without saying so.

import { db } from './firebase-config.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const $ = id => document.getElementById(id);
const STALE_MS = 3 * 60 * 1000;   // no fix for 3 min → say so

const shareId = new URLSearchParams(location.search).get('id');

function centerMsg(icon, title, body) {
  $('center-msg').classList.remove('hidden');
  $('center-msg').style.display = 'flex';
  $('center-msg').innerHTML =
    `<i class="fa-solid ${icon}"></i><h2>${esc(title)}</h2><p>${esc(body)}</p>`;
}
function hideCenter() {
  $('center-msg').style.display = 'none';
  $('top-card').style.display = 'block';
  $('note').style.display = 'flex';
}
function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

if (!shareId) {
  centerMsg('fa-link-slash', 'No ride link',
            'This page needs a ride link. Ask the rider to send theirs again.');
  throw new Error('missing id');
}

// ── Map ──
let map = null, marker = null, firstFix = true;
if (typeof maplibregl !== 'undefined') {
  map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [121.0470, 14.5507],
    zoom: 12,
    attributionControl: { compact: true },
  });
}

function placeRider(lat, lng, live) {
  if (!map) return;
  if (!marker) {
    const el = document.createElement('div');
    el.className = 'rider-marker';
    el.innerHTML = '<div class="rider-dot" id="rider-dot"></div>';
    marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
  } else {
    marker.setLngLat([lng, lat]);
  }
  const d = document.getElementById('rider-dot');
  if (d) d.classList.toggle('live', !!live);

  if (firstFix) { map.jumpTo({ center: [lng, lat], zoom: 15 }); firstFix = false; }
  else          { map.easeTo({ center: [lng, lat], duration: 900 }); }
}

// ── Formatting ──
function fmtDuration(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}`
               : `${m}:${String(s).padStart(2, '0')}`;
}
function agoText(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  return `${h} hour${h === 1 ? '' : 's'} ago`;
}
const toMs = ts => ts?.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : null);

// ── Live subscription ──
let latest = null;

if (!db) {
  centerMsg('fa-wifi', 'No connection', 'Check your internet and refresh this page.');
} else {
  onSnapshot(
    doc(db, 'liveRides', shareId),
    snap => {
      if (!snap.exists()) {
        centerMsg('fa-circle-question', 'Ride not found',
                  'This link may be wrong, or the ride has not started yet.');
        return;
      }
      latest = snap.data();
      hideCenter();
      render();
    },
    () => centerMsg('fa-triangle-exclamation', 'Could not load',
                    'Something went wrong. Try refreshing the page.')
  );
}

function render() {
  if (!latest) return;
  const d = latest;

  $('rider-name').textContent = d.riderName || 'Rider';
  $('m-dist').textContent  = Number(d.distanceKm || 0).toFixed(1);
  $('m-speed').textContent = Math.round(d.speedKmh || 0);

  const started = toMs(d.startedAt);
  const ended   = toMs(d.endedAt);
  const updated = toMs(d.updatedAt);

  if (started) {
    $('m-time').textContent = fmtDuration((ended || Date.now()) - started);
  }

  if (typeof d.lat === 'number' && typeof d.lng === 'number') {
    placeRider(d.lat, d.lng, !!d.active);
  }

  const dot = $('status-dot'), txt = $('status-text'), row = $('status-row');
  row.className = 'who-status';

  if (!d.active) {
    dot.className = 'dot ended';
    row.classList.add('s-ended');
    txt.textContent = 'Ride finished — they got home safely';
    $('note-text').textContent = 'This ride has ended. You can close this page.';
    if (marker) document.getElementById('rider-dot')?.classList.remove('live');
    return;
  }

  const staleFor = updated ? Date.now() - updated : 0;
  if (updated && staleFor > STALE_MS) {
    // Be honest but not alarming — a lost signal is usually just a dead
    // spot or the phone screen going off, not an emergency.
    dot.className = 'dot stale';
    row.classList.add('s-stale');
    txt.textContent = `No update ${agoText(staleFor)}`;
    $('note-text').textContent =
      'The phone may have lost signal or the screen turned off. The last known spot is shown.';
  } else {
    dot.className = 'dot live';
    row.classList.add('s-live');
    txt.textContent = d.lat == null ? 'Starting the ride…' : 'Riding now';
    $('note-text').textContent = 'This page updates by itself. You can leave it open.';
  }
}

// Re-render on a timer so "no update 4 minutes ago" stays truthful even
// when no new snapshot arrives.
setInterval(() => { if (latest) render(); }, 15000);
