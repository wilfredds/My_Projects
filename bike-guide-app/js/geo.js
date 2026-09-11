// ── Geo engine ────────────────────────────────────────────────────
// Distance, bearing, and a spatial grid index so proximity lookups
// run on-device in microseconds. No network, no Firestore reads —
// which means hazard warnings still fire with zero signal.

const EARTH_R = 6371000; // metres
const M_PER_DEG_LAT = 111320;

export const toRad = d => d * Math.PI / 180;
export const toDeg = r => r * 180 / Math.PI;

// Great-circle distance in metres.
export function distanceM(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Initial bearing from A to B, normalised to 0–360.
export function bearingDeg(lat1, lng1, lat2, lng2) {
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Smallest angle between two bearings, 0–180.
export function angleDiff(a, b) {
  const d = Math.abs((a - b) % 360);
  return d > 180 ? 360 - d : d;
}

// Is the target ahead of a rider travelling on `heading`?
// coneDeg is the half-angle of the forward cone.
export function isAhead(heading, targetBearing, coneDeg = 60) {
  if (heading == null || Number.isNaN(heading)) return true; // unknown heading → don't filter
  return angleDiff(heading, targetBearing) <= coneDeg;
}

// Turn a bearing into something speakable relative to travel direction.
export function relativeSide(heading, targetBearing) {
  if (heading == null || Number.isNaN(heading)) return '';
  const delta = ((targetBearing - heading + 540) % 360) - 180; // −180..180
  if (Math.abs(delta) < 15) return 'straight ahead';
  return delta > 0 ? 'on your right' : 'on your left';
}

// ── Spatial grid index ──
// Buckets points into ~1 km cells. Query scans only the cells that the
// search radius touches, so cost is independent of total dataset size.
export class GeoIndex {
  constructor(cellDeg = 0.01) {   // 0.01° ≈ 1.1 km
    this.cellDeg = cellDeg;
    this.cells = new Map();
    this.points = [];
  }

  _key(ci, cj) { return ci + ':' + cj; }

  build(points) {
    this.points = Array.isArray(points) ? points : [];
    this.cells.clear();
    for (const p of this.points) {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
      const k = this._key(Math.floor(p.lat / this.cellDeg), Math.floor(p.lng / this.cellDeg));
      let arr = this.cells.get(k);
      if (!arr) { arr = []; this.cells.set(k, arr); }
      arr.push(p);
    }
    return this;
  }

  // All points within radiusM, nearest first, each tagged with _distanceM.
  near(lat, lng, radiusM) {
    const out = [];
    const dLat = radiusM / M_PER_DEG_LAT;
    // A degree of longitude shrinks with latitude (~108 km at Manila's 14°N).
    const cosLat = Math.max(1e-6, Math.abs(Math.cos(toRad(lat))));
    const dLng = radiusM / (M_PER_DEG_LAT * cosLat);

    const ci0 = Math.floor((lat - dLat) / this.cellDeg);
    const ci1 = Math.floor((lat + dLat) / this.cellDeg);
    const cj0 = Math.floor((lng - dLng) / this.cellDeg);
    const cj1 = Math.floor((lng + dLng) / this.cellDeg);

    for (let ci = ci0; ci <= ci1; ci++) {
      for (let cj = cj0; cj <= cj1; cj++) {
        const arr = this.cells.get(this._key(ci, cj));
        if (!arr) continue;
        for (const p of arr) {
          const d = distanceM(lat, lng, p.lat, p.lng);
          if (d <= radiusM) out.push({ ...p, _distanceM: d });
        }
      }
    }
    return out.sort((a, b) => a._distanceM - b._distanceM);
  }

  get size() { return this.points.length; }
}

// Human-friendly distance for speech: "200 meters", "1.2 kilometers".
export function speakDistance(m) {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} meters`;
  return `${(m / 1000).toFixed(1)} kilometers`;
}
