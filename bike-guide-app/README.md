# RidePH

> Strava tells you how fast you rode. RidePH tells you what's ahead — and gets you home.

A voice safety co-pilot for Philippine roads. Warns riders about potholes, flooding,
dangerous junctions and bike-theft spots **before they reach them**, shares a live ride
link with family, and lets any buyer check a serial against stolen bikes.

**Live:** https://rideph.vercel.app

---

## Why this exists

Every fear a Filipino cyclist named turned out to be the same fear:

| The worry | The real problem |
|---|---|
| "My tire will go flat, so many potholes" | I don't know what's on the road ahead |
| "New place, I don't know where to go" | I don't know where this road leads |
| "Manila traffic might cause an accident" | I don't know what's around the corner |
| "That place is prone to bike stealing" | I don't know if this spot is safe |
| "Stranded far from home with bike issues" | I don't know where help is |
| "My family will worry" | *They* don't know where I am |

Global apps structurally cannot fix this. Strava scores a ride you already survived.
Google Maps knows the road but thinks you're a car. Komoot plans routes for European
bike lanes. None of them know which EDSA underpass kills cyclists.

**That data can only be built by the people who ride those roads.** It compounds with
every user, and no amount of foreign engineering replicates it. That is the moat.

---

## Architecture

Vanilla HTML/CSS/ES modules. No build step, no framework, no bundler. Every decision
below was made to keep the app free to run at scale.

### The snapshot rule (the most important decision here)

Hazards are **not** queried per session. They ship as a seed file, cache on the device,
and only a bounded delta is fetched from Firestore.

| Users | Naive geo-query per session | Snapshot architecture |
|---|---|---|
| 10,000 | ~$15/mo | **$0** |
| 100,000 | ~$540/mo | **~$5/mo** |

The second benefit matters more than the cost: **proximity warnings work with zero
signal**, which is exactly when you're on a mountain road and need them.

### Map stack

MapLibre GL JS + **OpenFreeMap** tiles — no API key, no request cap, no cost.

| Provider | Cost at 100k users |
|---|---|
| Google Maps JS API | ~$3,430/mo |
| Mapbox | ~$1,650/mo |
| **OpenFreeMap (this)** | **$0** |

Google removed its $200/month credit in **March 2025**; any tutorial older than that is
wrong about Maps pricing. Most "free" tiers (MapTiler, Stadia, Thunderforest, Jawg) are
**non-commercial only** — adding a paid tier would violate them.

`tile.openstreetmap.org` is deliberately never used: OSM's usage policy forbids
production apps and they block offenders without notice.

### Modules

| File | Responsibility |
|---|---|
| `js/geo.js` | Haversine distance, bearing, forward-cone filtering, spatial grid index |
| `js/voice.js` | Web Speech alerts, per-hazard cooldown, queue, beep + vibrate fallback |
| `js/hazards.js` | Seed + cache + bounded delta, offline write queue |
| `js/copilot.js` | GPS loop, wake lock, pause/resume, elevation, calories, max speed |
| `js/livesafe.js` | Live share sessions, throttled position writes, SOS message builder |
| `js/bikes.js` | Registry, SHA-256 serial hashing, photo compression, stolen reports |
| `js/sw-register.js` | Service worker registration + auto-reload on update |
| `js/app.js` | Identity, i18n, bottom nav, page init |

### Performance

The spatial index buckets points into ~1 km cells, so lookup cost scales with cells
touched, not dataset size: **1,000 queries over 5,000 points run in 2 ms**. The 1 Hz GPS
loop is effectively free. 22 unit tests cover the geo math, including a brute-force
cross-check that the grid never misses a point.

---

## Data model

```
hazards/{id}                    public   lat, lng, type, note, reporter, createdAt
liveRides/{shareId}             public   riderName, lat, lng, active, distanceKm...
stolenBikes/{id}                public   serialHash, serialTail, brand, photo, area...
users/{deviceId}/rides/{id}     private  distanceKm, durationMinutes, elevGainM...
users/{deviceId}/bikes/{id}     private  serial (full), brand, model, photo...
premiumRequests/{id}            write    deviceId, gcashRef, amount, status
premiumUsers/{deviceId}         read     activated
```

No accounts. `crypto.randomUUID()` in localStorage is the identity.

---

## Security model

Rules live in `firestore.rules` — **deploy them or the database is open.**

- **hazards** — world-readable by design. Create-only from clients, shape-validated, with
  a Philippines bounding box enforced *at the database*. Never updatable or deletable, so
  no one can wipe the map.
- **stolenBikes** — only documents already marked `stolen` are readable. That single
  condition means a serial check returns a hit or nothing, and the collection can never be
  scraped into a list of every registered bike. Create-only; a thief must not be able to
  erase a report.
- **liveRides** — the share ID is the secret (8 chars from a 30-char alphabet ≈ 6.5×10¹¹
  combinations). Updates restricted to the moving fields only.
- **users/{deviceId}** — scoped by UUID. This is obscurity, not real security. Move to
  Firebase Auth before storing anything genuinely sensitive.
- Everything unmatched is denied.

Serials are **never stored in the clear publicly** — only SHA-256 and the last four
characters. Normalisation strips case, spaces and dashes before hashing, because a check
that fails on formatting would report a stolen bike as clean: the most dangerous possible
wrong answer.

### The anti-fake design, honestly

You can only report a bike stolen if you registered it first. But without accounts there
is **no way to cryptographically prevent** someone registering a bike they don't own and
reporting it minutes later. What the app does instead is make it visible: the board shows
how long each bike was registered before the theft. *"Registered 8 months before"* reads
very differently from *"Registered less than a day before — treat with caution."*

That is transparency, not prevention. Real proof needs accounts.

### Never do these

- **Phone/SMS auth** — never free (up to $0.46/SMS) and the top target for SMS-pumping fraud.
- **Ship without a billing alert** if on Blaze. Spark can't overspend; Blaze has no cap by default.

---

## Known limitations

**A PWA cannot read GPS with the screen off.** Not difficult — impossible. The Geolocation
API isn't exposed to service workers and `watchPosition()` stops on backgrounding. The app
holds a Screen Wake Lock so the screen stays on in a handlebar mount, which is how people
use Strava anyway.

A **TWA / PWABuilder wrapper does not fix this** — it runs the PWA inside Chrome and
inherits every limitation. The real fix is Capacitor (reuses ~100% of this JavaScript).

**Play Store:** a personal developer account needs **12 testers continuously opted in for
14 days** before production access, and the counter resets if anyone drops out. Recruit
15+. It's a hard two-week floor.

---

## Setup

1. **Firestore** → create in production mode, region `asia-southeast1`.
2. **Rules** → paste `firestore.rules` → Publish.
3. **Indexes** → open `stolen.html`, check the console, click the one-click link. Twice.
4. **Verify** → open `/firebase-check.html`. All 7 checks must pass — especially #3, which
   attempts an out-of-bounds write that correct rules *must* reject.

## Deploy

Vercel project `rideph`, root directory `bike-guide-app`, production branch
`claude/bike-guide-app-planning-ciID4`. Every push auto-deploys. See `DEPLOY.md`.

`vercel.json`'s key rule is `Cache-Control: max-age=0` on `sw.js` — a cached service
worker is a stuck app, and users keep running the old build while you wonder why your fix
didn't land.

---

## Roadmap

See `PLAN.md`. Next up: auto-generated stolen-bike poster for Facebook, theft hotspots
feeding the voice warnings, contribution stats, loop-ride generator, and the Capacitor
build for screen-off tracking.
