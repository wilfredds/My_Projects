// Routes: data, filtering, cards and the full-screen route preview.
//
// Every number in assets/data/routes.json was measured, not estimated: the
// route is ridden on real roads by OpenStreetMap's bicycle router, and the
// climbing comes from a 90 m elevation model with small wiggles filtered
// out. How each figure was produced, and the source for every factual claim
// in the descriptions, is in assets/data/routes-sources.md.

let allRoutes = [];
let shapes = null;

export async function loadRoutes() {
  const res = await fetch('assets/data/routes.json');
  allRoutes = await res.json();
  return allRoutes;
}

async function loadShapes() {
  if (shapes) return shapes;
  const res = await fetch('assets/data/route-shapes.json');
  shapes = (await res.json()).routes;
  return shapes;
}

export function getRoute(id) {
  return allRoutes.find(r => r.id === id);
}

function matches(r, { difficulty, area }) {
  if (difficulty !== 'all' && r.difficulty !== difficulty) return false;
  if (area === 'Metro Manila') return r.province === 'Metro Manila';
  if (area !== 'all' && r.island !== area) return false;
  return true;
}

// Open routes to show as cards, and Premium routes that match the same
// filters (shown as locked rows, so the count is honest).
export function filterRoutes(filters, premiumUnlocked) {
  const hits = allRoutes.filter(r => matches(r, filters));
  return {
    open:   hits.filter(r => premiumUnlocked || !r.isPremium),
    locked: premiumUnlocked ? [] : hits.filter(r => r.isPremium),
  };
}

// Directions to the start. No travelmode on purpose: Google Maps has no
// bicycle directions in the Philippines, and leaving the mode out lets Maps
// offer whichever modes it does support there.
export function directionsToStartUrl(r) {
  return `https://www.google.com/maps/dir/?api=1&destination=${r.start.lat},${r.start.lng}`;
}

// Google encoded polyline (precision 5) -> [[lat, lng], ...]
export function decodePolyline(str) {
  const out = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const axis of [0, 1]) {
      let shift = 0, result = 0, b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = (result & 1) ? ~(result >> 1) : (result >> 1);
      if (axis === 0) lat += d; else lng += d;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TYPE_LABEL  = { 'loop': 'Loop', 'out-and-back': 'Out and back', 'one-way': 'One way' };
const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

// Under ~30 m over a whole ride is inside the elevation model's error.
const isFlat = r => r.elevationM < 30;

function timeParts(r) {
  const m = /^(.*?)\s*(min|h)$/.exec(r.estimatedTime || '');
  return m ? [m[1], m[2]] : [r.estimatedTime || '', ''];
}

// What the elevation profile covers: one lap, the way out, or the whole ride.
function profileScope(r) {
  if (r.laps > 1) return { label: 'one lap', km: r.lapKm };
  if (r.type === 'out-and-back' && r.turnaround) return { label: 'the way out', km: r.distanceKm / 2 };
  return { label: r.type === 'loop' ? 'the whole loop' : 'start to finish', km: r.distanceKm };
}

// Elevation profile. The vertical scale never shrinks below 150 m, so a flat
// river path draws flat instead of being stretched into fake hills.
function profilePath(profile, w, h) {
  const lo = Math.min(...profile);
  const range = Math.max(Math.max(...profile) - lo, 150);
  const pts = profile.map((e, i) => [
    (i / (profile.length - 1)) * w,
    h - ((e - lo) / range) * (h - 2) - 1,
  ]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('');
  return { line, area: `${line}L${w} ${h}L0 ${h}Z` };
}

function profileSvg(r, cls, h) {
  if (!Array.isArray(r.profile) || r.profile.length < 2) return '';
  const { line, area } = profilePath(r.profile, 100, h);
  return `<svg class="${cls}" viewBox="0 0 100 ${h}" preserveAspectRatio="none" aria-hidden="true">
    <path class="pa" d="${area}"/><path class="pl" d="${line}" vector-effect="non-scaling-stroke"/></svg>`;
}

function elevRange(r) {
  return `${Math.max(0, r.minElevationM)}–${r.maxElevationM} m`;
}

function numbers(r) {
  const [t, unit] = timeParts(r);
  const climb = isFlat(r)
    ? `<span class="v">Flat</span>`
    : `<span class="v">+${esc(r.elevationM)}<small> m</small></span>`;
  return `
    <div class="rc-nums">
      <div><span class="v">${esc(r.distanceKm.toFixed(1))}<small> km</small></span><span class="l">distance</span></div>
      <div>${climb}<span class="l">climbing</span></div>
      <div><span class="v">${esc(t)}<small> ${esc(unit)}</small></span><span class="l">moving time</span></div>
    </div>`;
}

export function renderRouteCard(r) {
  const scope = profileScope(r);
  const laps = r.laps > 1 ? ` · ${r.laps} laps of ${r.lapKm} km` : '';
  return `
  <article class="rc" id="route-${esc(r.id)}">
    <header class="rc-head">
      <div>
        <h3 class="rc-name">${esc(r.name)}</h3>
        <p class="rc-place">${esc(r.place)} · ${esc(TYPE_LABEL[r.type] || r.type)}${esc(laps)}</p>
      </div>
      <span class="rc-level lvl-${esc(r.difficulty)}">${esc(LEVEL_LABEL[r.difficulty] || r.difficulty)}</span>
    </header>
    ${numbers(r)}
    ${profileSvg(r, 'rc-profile', 30)}
    <p class="rc-cap">Elevation, ${esc(scope.label)} · ${esc(elevRange(r))}</p>
    <p class="rc-desc">${esc(r.description)}</p>
    <ul class="rc-tags">${(r.highlights || []).map(h => `<li>${esc(h)}</li>`).join('')}</ul>
    <p class="rc-meta"><b>Start</b> ${esc(r.start.name)}${r.turnaround ? ` · <b>Turn back at</b> ${esc(r.turnaround.name)}` : ''}${r.finish ? ` · <b>Finish</b> ${esc(r.finish.name)}` : ''}<br><b>Best time</b> ${esc(r.bestTime)}</p>
    <div class="rc-actions">
      <button type="button" class="rc-btn primary" data-view="${esc(r.id)}"><i class="fa-solid fa-route" aria-hidden="true"></i>View route</button>
      <a class="rc-btn" href="${esc(directionsToStartUrl(r))}" target="_blank" rel="noopener"><i class="fa-solid fa-diamond-turn-right" aria-hidden="true"></i>Directions to start</a>
    </div>
  </article>`;
}

export function renderLockedRow(r) {
  const climb = isFlat(r) ? 'flat' : `+${r.elevationM} m`;
  return `
    <div class="lk-row">
      <i class="fa-solid fa-lock lk-ic" aria-hidden="true"></i>
      <div class="lk-text">
        <span class="lk-name">${esc(r.name)}</span>
        <span class="lk-sub">${esc(r.place)}</span>
      </div>
      <span class="lk-num">${esc(r.distanceKm.toFixed(0))} km<br>${esc(climb)}</span>
    </div>`;
}

// ── Route preview sheet ──────────────────────────────────────────────
const MAPLIBRE_JS  = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js';
const MAPLIBRE_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.css';
const STYLE_PRIMARY  = 'https://tiles.openfreemap.org/styles/liberty';
const STYLE_FALLBACK = 'https://tiles.versatiles.org/assets/styles/colorful/style.json';

let libPromise = null;
function ensureMapLib() {
  if (window.maplibregl) return Promise.resolve();
  if (!libPromise) {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = MAPLIBRE_CSS;
    document.head.appendChild(css);
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = MAPLIBRE_JS; s.onload = resolve;
      s.onerror = () => { libPromise = null; reject(new Error('maplibre')); };
      document.head.appendChild(s);
    });
  }
  return libPromise;
}

let sheetMap = null;
let sheetOpenId = null;

function pinEl(text, cls) {
  const el = document.createElement('div');
  el.className = `rs-pin ${cls}`;
  el.textContent = text;
  return el;
}

async function drawMap(r) {
  const box = document.getElementById('rs-map');
  box.innerHTML = '<p class="rs-map-msg">Loading map…</p>';
  try {
    const [, all] = await Promise.all([ensureMapLib(), loadShapes()]);
    if (sheetOpenId !== r.id) return;               // closed or switched while loading
    const shape = all[r.id];
    if (!shape) throw new Error('no shape');
    const coords = decodePolyline(shape.line).map(([lat, lng]) => [lng, lat]);
    box.innerHTML = '';
    if (sheetMap) { sheetMap.remove(); sheetMap = null; }

    const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    const map = new maplibregl.Map({
      container: box, style: STYLE_PRIMARY, bounds,
      fitBoundsOptions: { padding: 40 }, attributionControl: { compact: true },
    });
    sheetMap = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    let swapped = false;
    map.on('error', e => {
      const msg = String(e?.error?.message || '');
      if (!swapped && (msg.includes('style') || msg.includes('Failed to fetch') || msg.includes('403'))) {
        swapped = true;
        try { map.setStyle(STYLE_FALLBACK); } catch (_) {}
      }
    });
    // style.load fires again after a fallback swap, which wipes our layers.
    map.on('style.load', () => {
      if (map.getSource('route')) return;
      map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 8 } });
      map.addLayer({ id: 'route-line', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#0B5E3B', 'line-width': 4.5 } });
    });

    new maplibregl.Marker({ element: pinEl('Start', 'start') }).setLngLat(coords[0]).addTo(map);
    if (r.turnaround) {
      new maplibregl.Marker({ element: pinEl('Turn back', 'end') }).setLngLat(coords[coords.length - 1]).addTo(map);
    } else if (r.finish) {
      new maplibregl.Marker({ element: pinEl('Finish', 'end') }).setLngLat(coords[coords.length - 1]).addTo(map);
    }
  } catch (_) {
    if (sheetOpenId === r.id) {
      box.innerHTML = '<p class="rs-map-msg">The map needs an internet connection. The numbers and profile below still work offline.</p>';
    }
  }
}

function sheetBody(r) {
  const scope = profileScope(r);
  return `
    ${numbers(r)}
    <figure class="rs-chart">
      <div class="rs-chart-plot">
        <div class="rs-chart-y" aria-hidden="true"><span>${esc(r.maxElevationM)} m</span><span>${esc(Math.max(0, r.minElevationM))} m</span></div>
        ${profileSvg(r, 'rs-profile', 44)}
      </div>
      <figcaption><span>0 km</span><span>Elevation, ${esc(scope.label)}</span><span>${esc(scope.km.toFixed(1))} km</span></figcaption>
    </figure>
    <p class="rc-meta"><b>Start</b> ${esc(r.start.name)}${r.turnaround ? `<br><b>Turn back at</b> ${esc(r.turnaround.name)}, then return the same way` : ''}${r.finish ? `<br><b>Finish</b> ${esc(r.finish.name)} (one way)` : ''}${r.laps > 1 ? `<br><b>Laps</b> ${esc(r.laps)} × ${esc(r.lapKm)} km` : ''}</p>
    <p class="rc-desc">${esc(r.description)}</p>
    <div class="rc-actions">
      <a class="rc-btn primary" href="${esc(directionsToStartUrl(r))}" target="_blank" rel="noopener"><i class="fa-solid fa-diamond-turn-right" aria-hidden="true"></i>Directions to start</a>
    </div>
    <p class="rs-note">Distance and climbing were measured on OpenStreetMap roads with a 90 m elevation model; climbing can be off by about a fifth. Moving time assumes 13–20 km/h on the flat. Road conditions change, so check before you go.</p>`;
}

export function openRouteSheet(id) {
  const r = getRoute(id);
  const sheet = document.getElementById('route-sheet');
  if (!r || !sheet) return;
  sheetOpenId = id;
  document.getElementById('rs-title').textContent = r.name;
  document.getElementById('rs-sub').textContent = `${r.place} · ${TYPE_LABEL[r.type] || r.type}`;
  document.getElementById('rs-body').innerHTML = sheetBody(r);
  sheet.hidden = false;
  document.body.style.overflow = 'hidden';
  if (!history.state || history.state.routeSheet !== id) history.pushState({ routeSheet: id }, '');
  document.getElementById('rs-close').focus();
  drawMap(r);
}

function hideSheet() {
  const sheet = document.getElementById('route-sheet');
  if (!sheet || sheet.hidden) return;
  sheet.hidden = true;
  sheetOpenId = null;
  document.body.style.overflow = '';
  if (sheetMap) { sheetMap.remove(); sheetMap = null; }
}

// Close through history so the phone's back button closes the preview
// instead of leaving the page.
export function closeRouteSheet() {
  if (history.state && history.state.routeSheet) history.back();
  else hideSheet();
}

window.addEventListener('popstate', hideSheet);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRouteSheet(); });
