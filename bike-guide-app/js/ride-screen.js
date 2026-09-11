// ── Ride screen controller ────────────────────────────────────────
// Wires the map, the co-pilot, and the report sheet together.

import { CoPilot } from './copilot.js';
import { loadHazards, reportHazard, getHazards, HAZARD_TYPES, hazardMeta, flushQueue } from './hazards.js';
import { isMuted, toggleMuted, confirm as speakConfirm } from './voice.js';

const DEFAULT_CENTER = [121.0470, 14.5507];   // BGC, Metro Manila
const $ = id => document.getElementById(id);

// The map library loads from a CDN. If that fails the rider should get a
// clear message, not a black screen — the co-pilot's voice alerts do not
// depend on the map, so the ride is still usable.
if (typeof maplibregl === 'undefined') {
  document.getElementById('map').innerHTML =
    '<div style="display:flex;height:100%;align-items:center;justify-content:center;' +
    'padding:30px;text-align:center;color:#9fb3aa;font-size:0.9rem;line-height:1.6;">' +
    'Map could not load.<br>Voice hazard alerts still work — tap START.</div>';
}

// ── Map ──
// OpenFreeMap: no API key, no request limits, no cost. Falls back to a
// second free provider if the primary style is unreachable.
const STYLE_PRIMARY  = 'https://tiles.openfreemap.org/styles/liberty';
const STYLE_FALLBACK = 'https://tiles.versatiles.org/assets/styles/colorful/style.json';

let map = null;
let styleFailed = false;

if (typeof maplibregl !== 'undefined') {
  map = new maplibregl.Map({
    container: 'map',
    style: STYLE_PRIMARY,
    center: DEFAULT_CENTER,
    zoom: 13,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');

  // A style that 404s or is blocked shouldn't kill the screen — swap once
  // to the backup provider, then give up quietly and keep voice working.
  map.on('error', e => {
    const msg = String(e?.error?.message || '');
    const isStyleProblem = msg.includes('style') || msg.includes('Failed to fetch') || msg.includes('403');
    if (isStyleProblem && !styleFailed) {
      styleFailed = true;
      try { map.setStyle(STYLE_FALLBACK); } catch (_) {}
    }
  });
}

let meMarker = null;
let follow = true;
let copilot = null;
let running = false;

// ── Hazards → GeoJSON ──
function hazardsGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: getHazards().map(h => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [h.lng, h.lat] },
      properties: {
        id: h.id,
        type: h.type,
        color: hazardMeta(h.type).color,
        label: hazardMeta(h.type).label,
        note: h.note || '',
        urgent: hazardMeta(h.type).urgent ? 1 : 0,
      },
    })),
  };
}

function refreshHazardLayer() {
  if (!map) return;
  const src = map.getSource('hazards');
  if (src) src.setData(hazardsGeoJSON());
}

// Hazard data must load whether or not the map does — the voice co-pilot
// depends on it and is the part that actually keeps riders safe.
const hazardsReady = loadHazards().catch(() => []);

// Adding the hazard source + layers is idempotent, because setStyle()
// (the CDN fallback path) wipes custom layers and re-fires styledata.
function addHazardLayers() {
  if (!map || !map.isStyleLoaded()) return;
  if (map.getSource('hazards')) { refreshHazardLayer(); return; }
  map.addSource('hazards', { type: 'geojson', data: hazardsGeoJSON() });

  // Soft halo so hazards read at a glance while moving.
  map.addLayer({
    id: 'hazard-halo',
    type: 'circle',
    source: 'hazards',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 16, 22],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.18,
    },
  });
  map.addLayer({
    id: 'hazard-dot',
    type: 'circle',
    source: 'hazards',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 9],
      'circle-color': ['get', 'color'],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });

}

let popupWired = false;
function wireHazardPopups() {
  if (!map || popupWired) return;
  popupWired = true;
  map.on('click', 'hazard-dot', e => {
    const pr = e.features[0].properties;
    new maplibregl.Popup({ offset: 12, closeButton: false })
      .setLngLat(e.features[0].geometry.coordinates)
      .setHTML(
        `<div style="font-family:Poppins,sans-serif;padding:2px 4px;">
           <strong style="font-size:0.85rem;color:${pr.color};">${escapeHtml(pr.label)}</strong>
           ${pr.note ? `<div style="font-size:0.75rem;color:#555;margin-top:3px;max-width:200px;">${escapeHtml(pr.note)}</div>` : ''}
         </div>`)
      .addTo(map);
  });
  map.on('mouseenter', 'hazard-dot', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'hazard-dot', () => { map.getCanvas().style.cursor = ''; });
}

map?.on('load', async () => {
  await hazardsReady;
  addHazardLayers();
  wireHazardPopups();

  // Drop the map on the rider's location straight away, before any ride starts.
  navigator.geolocation?.getCurrentPosition(
    p => { setMe(p.coords.latitude, p.coords.longitude); map.jumpTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 15 }); },
    () => {},
    { enableHighAccuracy: true, timeout: 8000 }
  );

  flushQueue().catch(() => {});
});

// Re-add layers after a style swap (CDN fallback).
map?.on('styledata', () => { hazardsReady.then(addHazardLayers); });

// Panning by hand turns off auto-follow so the map doesn't fight the rider.
map?.on('dragstart', () => { follow = false; });

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}

// ── Rider marker ──
function setMe(lat, lng, heading) {
  if (!map) return;
  if (!meMarker) {
    const el = document.createElement('div');
    el.className = 'me-marker';
    el.innerHTML = '<div class="me-cone" id="me-cone"></div><div class="me-dot"></div>';
    meMarker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
  } else {
    meMarker.setLngLat([lng, lat]);
  }
  const cone = document.getElementById('me-cone');
  if (cone) {
    cone.style.display = (heading == null || Number.isNaN(heading)) ? 'none' : 'block';
    if (heading != null) cone.style.transform = `rotate(${heading + 180}deg) translate(-13px, 4px)`;
  }
}

// ── Stats ──
function fmtTime(min) {
  const t = Math.max(0, Math.floor(min * 60));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

// ── Alert banner ──
let bannerTimer = null;
function showAlert(text, urgent, icon) {
  const b = $('alert-banner');
  $('alert-text').textContent = text;
  $('alert-icon').className = `fa-solid ${icon || 'fa-triangle-exclamation'}`;
  b.classList.toggle('urgent', !!urgent);
  b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), 6000);
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function gpsBadge(text) {
  const b = $('gps-badge');
  if (!text) { b.classList.remove('show'); return; }
  $('gps-text').textContent = text;
  b.classList.add('show');
}

// ── Start / stop ──
$('go-btn').addEventListener('click', async () => {
  if (!running) {
    gpsBadge('Getting GPS…');
    copilot = new CoPilot({
      onUpdate: u => {
        setMe(u.lat, u.lng, u.heading);
        if (follow && map) map.easeTo({ center: [u.lng, u.lat], duration: 700 });
        $('s-dist').textContent  = u.distanceKm.toFixed(1);
        $('s-time').textContent  = fmtTime(u.durationMin);
        $('s-speed').textContent = Math.round(u.speedKmh);
        $('s-ahead').textContent = u.nearby.length;
        gpsBadge(null);
      },
      onAlert: a => showAlert(a.text, a.meta.urgent, a.meta.icon),
      onError: e => {
        gpsBadge(e.code === 1 ? 'GPS permission denied' : 'Waiting for GPS…');
      },
    });
    await copilot.start();
    running = true;
    $('go-btn').classList.add('running');
    $('go-label').textContent = 'STOP';
    $('go-btn').querySelector('i').className = 'fa-solid fa-stop';
    follow = true;
  } else {
    const summary = await copilot.stop();
    running = false;
    gpsBadge(null);
    $('go-btn').classList.remove('running');
    $('go-label').textContent = 'START';
    $('go-btn').querySelector('i').className = 'fa-solid fa-play';
    toast(`Ride saved · ${summary.distanceKm.toFixed(1)} km`);
    try {
      const { logRide } = await import('./tracker.js');
      if (summary.distanceKm > 0.05) {
        await logRide({
          distanceKm: Number(summary.distanceKm.toFixed(2)),
          durationMinutes: Math.round(summary.durationMin),
          date: new Date().toISOString().split('T')[0],
          routeName: 'Co-pilot ride',
          notes: '',
        });
      }
    } catch (_) { /* logging is best-effort */ }
  }
});

// ── Mute ──
function paintMute() {
  const m = isMuted();
  $('mute-btn').classList.toggle('muted', m);
  $('mute-btn').querySelector('i').className = m ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
}
$('mute-btn').addEventListener('click', () => { toggleMuted(); paintMute(); });
paintMute();

// ── Report sheet ──
const grid = $('haz-grid');
grid.innerHTML = Object.entries(HAZARD_TYPES).map(([key, m]) => `
  <button class="haz-opt" data-type="${key}">
    <i class="fa-solid ${m.icon}" style="color:${m.color}"></i>
    <span>${m.label}</span>
  </button>
`).join('');

function openSheet(open) {
  $('sheet').classList.toggle('open', open);
  $('sheet-overlay').classList.toggle('open', open);
}
$('report-btn').addEventListener('click', () => openSheet(true));
$('sheet-overlay').addEventListener('click', () => openSheet(false));

grid.addEventListener('click', async e => {
  const btn = e.target.closest('.haz-opt');
  if (!btn) return;
  const type = btn.dataset.type;
  openSheet(false);

  const place = await currentPosition();
  if (!place) { toast('Need your location to report'); return; }

  await reportHazard({ lat: place.lat, lng: place.lng, type });
  refreshHazardLayer();
  const meta = hazardMeta(type);
  toast(`${meta.label} reported — salamat!`);
  speakConfirm(`${meta.label} reported. Thank you.`);
  if (navigator.vibrate) navigator.vibrate([40, 50, 40]);
});

// Use the live ride position if we have one, else ask for a one-shot fix.
function currentPosition() {
  if (running && copilot?.last) {
    return Promise.resolve({ lat: copilot.last.lat, lng: copilot.last.lng });
  }
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

// Warn before leaving mid-ride.
window.addEventListener('beforeunload', e => {
  if (running) { e.preventDefault(); e.returnValue = ''; }
});
