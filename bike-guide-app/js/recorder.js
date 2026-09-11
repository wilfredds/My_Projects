// ── GPS Ride Recorder engine ──────────────────────────────────────
// Dependency-free state machine that turns raw geolocation fixes into a
// clean ride: filtered track, distance, speed, elevation and calories.
// The UI layer (record.html) wires the map, buttons and saving; this file
// owns all the math, the wake lock, crash-recovery and the hydration timer.

const RECOVERY_KEY = 'activeRide';

// ── Pure helpers ──
const R = 6371000; // Earth radius (m)
export function haversine(a, b) {
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)); // metres
}

// Cycling MET by speed (km/h) — Compendium of Physical Activities.
function metForSpeed(kmh) {
  if (kmh < 1)  return 0;     // stopped
  if (kmh < 16) return 4.0;   // leisurely
  if (kmh < 19) return 6.8;
  if (kmh < 22) return 8.0;
  if (kmh < 26) return 10.0;
  if (kmh < 30) return 12.0;
  return 15.8;                // racing
}

export function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = n => String(n).padStart(2, '0');
  return hh > 0 ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}`;
}

export class RideRecorder {
  constructor(opts = {}) {
    this.weightKg = opts.weightKg || 65;
    this.hydrationMin = opts.hydrationMin || 15;
    this.onUpdate = opts.onUpdate || (() => {});   // metrics tick
    this.onPoint  = opts.onPoint  || (() => {});   // new accepted track point
    this.onHydrate = opts.onHydrate || (() => {});
    this.onStatus = opts.onStatus || (() => {});   // 'gps-weak' | 'gps-ok' | 'error'

    // Filtering knobs
    this.maxAccuracy = 30;     // m — discard fuzzier fixes
    this.maxSegSpeed = 80;     // km/h — reject teleport spikes
    this.minMoveDist = 2;      // m — ignore jitter while standing still
    this.elevThreshold = 3;    // m — only count real climbs
    this.storeEverySec = 2.5;  // throttle stored points

    this.reset();
  }

  reset() {
    this.state = 'idle'; // idle | recording | paused | finished
    this.track = [];             // stored (throttled) points {lat,lng,t,alt,spd}
    this.distanceM = 0;
    this.maxSpeedKmh = 0;
    this.elevationGain = 0;
    this.calories = 0;
    this.startTime = null;
    this.pausedAccum = 0;        // ms of elapsed time before current resume
    this.lastResume = null;
    this._lastAccepted = null;   // last accepted raw fix (for distance)
    this._elevRef = null;        // reference (smoothed) altitude for hysteresis
    this._altWindow = [];        // moving-average buffer for noisy GPS altitude
    this._lastStoredT = 0;
    this._speedWindow = [];      // moving-average buffer
    this._watchId = null;
    this._wakeLock = null;
    this._tickTimer = null;
    this._hydrationTimer = null;
  }

  // ── Lifecycle ──
  async start() {
    if (this.state === 'recording') return;
    this.reset();
    this.state = 'recording';
    this.startTime = Date.now();
    this.lastResume = Date.now();
    this._beginWatch();
    this._acquireWakeLock();
    this._startTick();
    this._startHydration();
  }

  pause() {
    if (this.state !== 'recording') return;
    this.state = 'paused';
    this.pausedAccum += Date.now() - this.lastResume;
    this._lastAccepted = null;      // avoid a huge phantom segment on resume
    this._speedWindow = [];
    this._stopHydration();
    this.onUpdate(this.metrics());
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'recording';
    this.lastResume = Date.now();
    this._acquireWakeLock();
    this._startHydration();
  }

  finish() {
    const summary = this.metrics();
    this.state = 'finished';
    if (this._watchId != null) navigator.geolocation.clearWatch(this._watchId);
    this._watchId = null;
    clearInterval(this._tickTimer);
    this._stopHydration();
    this._releaseWakeLock();
    this.clearRecovery();
    return { ...summary, track: this.track };
  }

  // ── Geolocation ──
  _beginWatch() {
    if (!('geolocation' in navigator)) { this.onStatus('error'); return; }
    this._watchId = navigator.geolocation.watchPosition(
      pos => this._onFix(pos),
      err => this.onStatus(err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }

  _onFix(pos) {
    if (this.state !== 'recording') return;
    const { latitude: lat, longitude: lng, accuracy, altitude, speed } = pos.coords;
    const t = pos.timestamp || Date.now();

    if (accuracy != null && accuracy > this.maxAccuracy) { this.onStatus('gps-weak'); return; }
    this.onStatus('gps-ok');

    const cur = { lat, lng, t, alt: altitude, spd: speed };

    if (this._lastAccepted) {
      const dM = haversine(this._lastAccepted, cur);
      const dtSec = (t - this._lastAccepted.t) / 1000;
      if (dtSec <= 0) return;
      const segKmh = (dM / dtSec) * 3.6;
      if (segKmh > this.maxSegSpeed) return;        // GPS spike → drop
      if (dM < this.minMoveDist) {                  // basically standing still
        this._pushSpeed(0);
      } else {
        this.distanceM += dM;
        // Elevation: smooth the noisy GPS altitude first, then apply hysteresis —
        // count gain once the smoothed value climbs >threshold above a moving
        // reference. Captures steady climbs while rejecting altitude jitter.
        if (altitude != null) {
          this._altWindow.push(altitude);
          if (this._altWindow.length > 5) this._altWindow.shift();
          const smoothAlt = this._altWindow.reduce((a, b) => a + b, 0) / this._altWindow.length;
          if (this._elevRef == null) this._elevRef = smoothAlt;
          const dAlt = smoothAlt - this._elevRef;
          if (dAlt > this.elevThreshold) { this.elevationGain += dAlt; this._elevRef = smoothAlt; }
          else if (dAlt < 0) { this._elevRef = smoothAlt; } // descending → lower the ref
        }
        // Speed: prefer device-reported, else derive from segment
        const kmh = (speed != null && speed >= 0) ? speed * 3.6 : segKmh;
        this._pushSpeed(kmh);
        if (kmh > this.maxSpeedKmh && kmh < this.maxSegSpeed) this.maxSpeedKmh = kmh;
        // Calories for this segment via MET
        this.calories += metForSpeed(kmh) * this.weightKg * (dtSec / 3600);
      }
    }
    this._lastAccepted = cur;

    // Throttle what we actually store
    if ((t - this._lastStoredT) / 1000 >= this.storeEverySec || this.track.length === 0) {
      this._lastStoredT = t;
      const point = { lat: +lat.toFixed(6), lng: +lng.toFixed(6), t };
      this.track.push(point);
      this.onPoint(point, cur);
      this._saveRecovery();
    }
    this.onUpdate(this.metrics());
  }

  _pushSpeed(kmh) {
    this._speedWindow.push(kmh);
    if (this._speedWindow.length > 5) this._speedWindow.shift();
  }
  get currentSpeed() {
    if (!this._speedWindow.length) return 0;
    return this._speedWindow.reduce((a, b) => a + b, 0) / this._speedWindow.length;
  }

  // ── Metrics snapshot ──
  elapsedMs() {
    if (!this.startTime) return 0;
    const live = this.state === 'recording' ? Date.now() - this.lastResume : 0;
    return this.pausedAccum + live;
  }
  metrics() {
    const km = this.distanceM / 1000;
    const hrs = this.elapsedMs() / 3600000;
    const avg = hrs > 0 ? km / hrs : 0;
    return {
      distanceKm: km,
      durationMs: this.elapsedMs(),
      currentSpeedKmh: this.state === 'recording' ? this.currentSpeed : 0,
      avgSpeedKmh: avg,
      maxSpeedKmh: this.maxSpeedKmh,
      elevationGain: Math.round(this.elevationGain),
      calories: Math.round(this.calories),
      points: this.track.length,
      state: this.state,
    };
  }

  _startTick() {
    // Repaint duration even when no new fix arrives (e.g. waiting at a light)
    this._tickTimer = setInterval(() => {
      if (this.state === 'recording') this.onUpdate(this.metrics());
    }, 1000);
  }

  // ── Hydration reminder ──
  _startHydration() {
    this._stopHydration();
    if (!this.hydrationMin) return;
    this._hydrationTimer = setInterval(() => this.onHydrate(), this.hydrationMin * 60000);
  }
  _stopHydration() { clearInterval(this._hydrationTimer); this._hydrationTimer = null; }

  // ── Wake lock (keep screen on while recording) ──
  async _acquireWakeLock() {
    try {
      if ('wakeLock' in navigator && !this._wakeLock) {
        this._wakeLock = await navigator.wakeLock.request('screen');
        this._wakeLock.addEventListener('release', () => { this._wakeLock = null; });
      }
    } catch (_) { /* not supported / denied — recording still works */ }
  }
  _releaseWakeLock() {
    try { this._wakeLock?.release(); } catch (_) {}
    this._wakeLock = null;
  }
  // Re-acquire after the user tabs away and back
  handleVisibility() {
    if (document.visibilityState === 'visible' && this.state === 'recording') {
      this._acquireWakeLock();
    }
  }

  // ── Crash recovery ──
  _saveRecovery() {
    try {
      localStorage.setItem(RECOVERY_KEY, JSON.stringify({
        track: this.track,
        distanceM: this.distanceM,
        maxSpeedKmh: this.maxSpeedKmh,
        elevationGain: this.elevationGain,
        calories: this.calories,
        startTime: this.startTime,
        pausedAccum: this.pausedAccum,
        savedAt: Date.now(),
      }));
    } catch (_) {}
  }
  clearRecovery() { try { localStorage.removeItem(RECOVERY_KEY); } catch (_) {} }

  static getRecovery() {
    try {
      const raw = localStorage.getItem(RECOVERY_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Only offer recovery for a track with real content from the last 12h
      if (!data.track || data.track.length < 2) return null;
      if (Date.now() - (data.savedAt || 0) > 12 * 3600000) return null;
      return data;
    } catch { return null; }
  }

  // Rebuild a recorder mid-ride from a recovery snapshot (resumes paused)
  static fromRecovery(data, opts = {}) {
    const rec = new RideRecorder(opts);
    rec.track = data.track || [];
    rec.distanceM = data.distanceM || 0;
    rec.maxSpeedKmh = data.maxSpeedKmh || 0;
    rec.elevationGain = data.elevationGain || 0;
    rec.calories = data.calories || 0;
    rec.startTime = data.startTime || Date.now();
    rec.pausedAccum = data.pausedAccum || 0;
    rec.state = 'paused';
    const last = rec.track[rec.track.length - 1];
    if (last) rec._lastStoredT = last.t;
    return rec;
  }
}
