// ── The co-pilot ──────────────────────────────────────────────────
// Watches your position and speaks what is ahead. Everything here runs
// on-device against the cached hazard index, so it keeps working with
// no signal.
//
// HARD LIMIT, known and accepted: a PWA cannot read GPS once the screen
// is off — the Geolocation API is not exposed to service workers, and
// watchPosition() stops the moment the page is backgrounded. We hold a
// Screen Wake Lock so the screen stays on in a handlebar mount. Screen-off
// tracking needs the native (Capacitor) build — see PLAN.md Phase 4.

import { getIndex, hazardMeta } from './hazards.js';
import { bearingDeg, isAhead, relativeSide, speakDistance, distanceM } from './geo.js';
import { say, resetSpoken, warmUp } from './voice.js';

export class CoPilot {
  constructor({ onUpdate = () => {}, onAlert = () => {}, onError = () => {} } = {}) {
    this.onUpdate = onUpdate;
    this.onAlert  = onAlert;
    this.onError  = onError;

    this.watchId  = null;
    this.wakeLock = null;
    this.running  = false;
    this.paused   = false;
    this.pausedMs = 0;        // total time spent paused
    this._pauseStart = null;

    this.track    = [];      // [{lat, lng, t}]
    this.distanceM = 0;
    this.startedAt = null;
    this.last = null;        // last fix
    this.heading = null;     // degrees, from GPS or derived from movement
    this.speedMps = 0;
    this.maxSpeedMps = 0;
    this.elevGainM   = 0;
    this._lastAlt    = null;

    this._onVisibility = this._onVisibility.bind(this);
  }

  // ── Wake lock ──
  async _acquireWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
    } catch (_) {
      // Rejected on low battery or power-save. Tracking still works
      // while the screen happens to be on.
    }
  }
  _onVisibility() {
    if (document.visibilityState === 'visible' && this.running && !this.wakeLock) {
      this._acquireWakeLock();
    }
  }

  async start() {
    if (this.running) return;
    if (!('geolocation' in navigator)) {
      this.onError(new Error('This device has no GPS support.'));
      return;
    }

    this.running   = true;
    this.paused    = false;
    this.pausedMs  = 0;
    this._pauseStart = null;
    this.startedAt = Date.now();
    this.track     = [];
    this.distanceM = 0;
    this.last      = null;
    this.maxSpeedMps = 0;
    this.elevGainM   = 0;
    this._lastAlt    = null;

    resetSpoken();
    warmUp();                       // unlock audio from the user gesture
    await this._acquireWakeLock();
    document.addEventListener('visibilitychange', this._onVisibility);

    this.watchId = navigator.geolocation.watchPosition(
      p => this._onFix(p),
      e => this.onError(e),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );

    say('Co-pilot on. Ride safe.', { key: 'start' });
  }

  // Moving time, excluding pauses. Without this a 20-minute stop at a store
  // silently wrecks the ride's average speed.
  movingMs() {
    if (!this.startedAt) return 0;
    const paused = this.pausedMs + (this._pauseStart ? Date.now() - this._pauseStart : 0);
    return Math.max(0, Date.now() - this.startedAt - paused);
  }

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this._pauseStart = Date.now();
    say('Ride paused.', { key: 'pause' });
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    if (this._pauseStart) {
      this.pausedMs += Date.now() - this._pauseStart;
      this._pauseStart = null;
    }
    // Drop the stale fix so the distance covered while paused (or the GPS
    // drift of a stationary phone) is not counted as riding.
    this.last = null;
    say('Resuming.', { key: 'resume' });
  }

  async stop() {
    this.running = false;
    this.paused  = false;
    if (this.watchId != null) { navigator.geolocation.clearWatch(this.watchId); this.watchId = null; }
    document.removeEventListener('visibilitychange', this._onVisibility);
    if (this.wakeLock) { try { await this.wakeLock.release(); } catch (_) {} this.wakeLock = null; }

    const km = this.distanceM / 1000;
    const hours = this.movingMs() / 3600000;
    return {
      distanceKm: km,
      durationMin: this.movingMs() / 60000,
      avgSpeedKmh: hours > 0 ? km / hours : 0,
      maxSpeedKmh: this.maxSpeedMps * 3.6,
      elevGainM: Math.round(this.elevGainM),
      calories: this.calories(),
      track: this.track,
    };
  }

  _onFix(pos) {
    if (!this.running) return;
    const { latitude: lat, longitude: lng, heading, speed, accuracy } = pos.coords;

    // Ignore wild fixes — they create phantom distance and false alerts.
    if (accuracy != null && accuracy > 100) return;

    const now = Date.now();

    // While paused, keep the dot on the map but stop counting distance and
    // stop speaking — a rider stopped at a junction does not want the
    // hazard 40 m away announced on a loop.
    if (this.paused) {
      this.last = { lat, lng, t: now };
      this.onUpdate({
        lat, lng, heading: this.heading, speedKmh: 0,
        distanceKm: this.distanceM / 1000,
        durationMin: this.movingMs() / 60000,
        accuracy, nearby: [], paused: true,
      });
      return;
    }

    if (this.last) {
      const step = distanceM(this.last.lat, this.last.lng, lat, lng);
      // 2 m floor filters GPS jitter while standing still.
      if (step > 2) {
        this.distanceM += step;
        // Derive heading from movement when the device doesn't report it.
        if (heading == null || Number.isNaN(heading)) {
          this.heading = bearingDeg(this.last.lat, this.last.lng, lat, lng);
        }
      }
      const dt = (now - this.last.t) / 1000;
      if (dt > 0 && step > 2) this.speedMps = step / dt;
    }

    if (heading != null && !Number.isNaN(heading)) this.heading = heading;
    if (speed != null && !Number.isNaN(speed) && speed >= 0) this.speedMps = speed;

    // Max speed: GPS occasionally reports absurd spikes when a fix jumps.
    // 90 km/h is well above anything reachable on a bike in PH traffic, so
    // anything past it is noise, not a personal record.
    if (this.speedMps > this.maxSpeedMps && this.speedMps < 25) {
      this.maxSpeedMps = this.speedMps;
    }

    // Elevation: phone barometers/GPS altitude drift by 10-20 m at rest, so
    // counting every rise would invent hundreds of metres on a flat ride.
    // Only accumulate climbs above a 3 m step, and ignore low-confidence fixes.
    const alt = pos.coords.altitude;
    const altAcc = pos.coords.altitudeAccuracy;
    if (alt != null && !Number.isNaN(alt) && (altAcc == null || altAcc <= 15)) {
      if (this._lastAlt != null) {
        const rise = alt - this._lastAlt;
        if (rise > 3) { this.elevGainM += rise; this._lastAlt = alt; }
        else if (rise < -3) { this._lastAlt = alt; }
      } else {
        this._lastAlt = alt;
      }
    }

    this.last = { lat, lng, t: now };
    this.track.push({ lat, lng, t: now });

    const nearby = this._scan(lat, lng);

    this.onUpdate({
      lat, lng,
      heading: this.heading,
      speedKmh: this.speedMps * 3.6,
      distanceKm: this.distanceM / 1000,
      durationMin: this.movingMs() / 60000,
      accuracy,
      nearby,
      paused: false,
    });
  }

  // Calories burned, via METs (metabolic equivalent) — the standard
  // approach: kcal = MET x weight(kg) x hours. The MET for cycling rises
  // with speed, so we bracket by average pace rather than assuming one
  // effort level. Defaults to 65 kg if the rider hasn't set a weight.
  calories() {
    const kg = Number(localStorage.getItem('riderWeightKg')) || 65;
    const hours = this.movingMs() / 3600000;
    if (hours <= 0) return 0;
    const avgKmh = (this.distanceM / 1000) / hours;
    let met;
    if      (avgKmh < 16) met = 4;
    else if (avgKmh < 19) met = 6;
    else if (avgKmh < 22) met = 8;
    else if (avgKmh < 25) met = 10;
    else                  met = 12;
    return Math.round(met * kg * hours);
  }

  // Look ahead and speak anything worth knowing about.
  _scan(lat, lng) {
    // Warn earlier when moving faster — aim for a consistent ~20 s of notice.
    const radius = Math.min(600, Math.max(150, this.speedMps * 25));
    const found = getIndex().near(lat, lng, radius);
    const ahead = [];

    for (const h of found) {
      const meta = hazardMeta(h.type);
      const brg  = bearingDeg(lat, lng, h.lat, h.lng);

      // Standing hazards (theft spots) matter wherever you're pointed.
      // Road hazards only matter if they're in front of you.
      if (!meta.standing && !isAhead(this.heading, brg, 55)) continue;

      ahead.push({ ...h, _bearing: brg, _meta: meta });

      const side = meta.standing ? '' : relativeSide(this.heading, brg);
      const dist = speakDistance(h._distanceM);
      const text = meta.standing
        ? `${meta.speech}.`
        : `${meta.speech} in ${dist}${side ? ', ' + side : ''}.`;

      if (say(text, { urgent: meta.urgent, key: h.id })) {
        this.onAlert({ hazard: h, meta, text });
      }
    }
    return ahead;
  }
}
