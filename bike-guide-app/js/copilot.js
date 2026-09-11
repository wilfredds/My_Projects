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

    this.track    = [];      // [{lat, lng, t}]
    this.distanceM = 0;
    this.startedAt = null;
    this.last = null;        // last fix
    this.heading = null;     // degrees, from GPS or derived from movement
    this.speedMps = 0;

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
    this.startedAt = Date.now();
    this.track     = [];
    this.distanceM = 0;
    this.last      = null;

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

  async stop() {
    this.running = false;
    if (this.watchId != null) { navigator.geolocation.clearWatch(this.watchId); this.watchId = null; }
    document.removeEventListener('visibilitychange', this._onVisibility);
    if (this.wakeLock) { try { await this.wakeLock.release(); } catch (_) {} this.wakeLock = null; }

    return {
      distanceKm: this.distanceM / 1000,
      durationMin: this.startedAt ? (Date.now() - this.startedAt) / 60000 : 0,
      track: this.track,
    };
  }

  _onFix(pos) {
    if (!this.running) return;
    const { latitude: lat, longitude: lng, heading, speed, accuracy } = pos.coords;

    // Ignore wild fixes — they create phantom distance and false alerts.
    if (accuracy != null && accuracy > 100) return;

    const now = Date.now();

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

    this.last = { lat, lng, t: now };
    this.track.push({ lat, lng, t: now });

    const nearby = this._scan(lat, lng);

    this.onUpdate({
      lat, lng,
      heading: this.heading,
      speedKmh: this.speedMps * 3.6,
      distanceKm: this.distanceM / 1000,
      durationMin: this.startedAt ? (now - this.startedAt) / 60000 : 0,
      accuracy,
      nearby,
    });
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
