# Bike Guide PH → **Kasama** — Product Plan

> **Strava tells you how fast you rode. Kasama tells you what's ahead — and gets you home.**

---

## The insight

Every fear a Filipino cyclist has is the same fear wearing different clothes:

| The worry | The real problem |
|---|---|
| "My tire will go flat, so many potholes" | I don't know what's on the road ahead |
| "New place, I don't know where to go" | I don't know where this road leads |
| "Manila traffic might cause an accident" | I don't know what's around the corner |
| "That place is prone to bike stealing" | I don't know if this spot is safe |
| "I'm worried about the rain" | I don't know what the sky will do |
| "Stranded far from home, bike has issues" | I don't know where help is |
| "My family will worry" | *They* don't know where I am |

**One problem, seven times: a Filipino cyclist rides into the unknown.**

Global apps structurally cannot fix this:
- **Strava** = a scoreboard for a ride you already survived.
- **Google Maps** = knows the road, thinks you're a car.
- **Komoot** = beautiful routes, for European bike lanes.

The missing data — what's ahead, on *Philippine* roads, *right now* — can only be built by
the people who ride those roads. That is the moat, and it compounds with every user.

---

## The three acts

### Act 1 — Before you leave: *"Should I go, and where?"*
- Rain radar, next 3 hours
- **Loop ride generator** — "I'm here, give me a 25 km loop back to this spot"
- Route safety score — potholes, traffic, theft reports on the planned path
- Pre-ride check — tire pressure, lights, **"remove your earphones"**

### Act 2 — While you ride: *the core loop*
- **Voice hazard warnings ahead** (works offline — data cached on device)
- **One-tap reporting** — glove-friendly, or voice ("pothole")
- **Live share with family** — a link where they watch your dot move
- Breakdown mode — nearest open bike shop + SOS to your buddy

### Act 3 — After: *the retention engine*
- Not your stats — **your contribution**:
  *"You reported 3 hazards this month. 47 riders were warned because of you."*

Strava gives status for being fast. Kasama gives status for **protecting other riders**.
In a community culture, that is the stronger hook — and it is what keeps the data flowing.

---

## Bike theft: the anti-fake design

**You can only report a bike stolen if you registered it _before_ it was stolen.**

    Register (any time) -> serial + photos + receipt -> timestamped, locked
            |
       Stolen? -> one tap -> broadcast + auto-generated poster for Facebook
            |
       Buying used? -> type serial -> "REPORTED STOLEN - Quezon City, Mar 3"

Why this beats Facebook posts:
- Faking a report means registering a bike you don't own, with a receipt, weeks ahead. Nobody will.
- **The pre-purchase serial check attacks theft on the demand side** — it makes stolen bikes
  hard to sell. No Facebook group can do this.
- Every registered bike makes the check more useful → real network effect.
- Theft locations feed the hotspot map → which feeds the voice warnings. The systems compound.

---

## Tech stack — and why (all decisions cost-driven)

| Layer | Choice | Why |
|---|---|---|
| Map renderer | **MapLibre GL JS** | Free, open, vector tiles |
| Tiles | **OpenFreeMap** | No API key, no limits, no cost. Fallback: self-hosted Protomaps PH extract on R2 |
| Hazard delivery | **Snapshot file on CDN** + Firestore for writes only | ~100x cheaper than per-session queries, and works offline |
| Proximity check | **Client-side spatial index** | Microseconds, zero network, works with no signal |
| Database | Firestore | Free to ~30-50k users with snapshot architecture |
| Voice | **Web Speech API** | Built into the browser, free |
| Screen-on | **Wake Lock API** | The only way a PWA can track GPS |
| Push | **Web Push + VAPID** | Free, does NOT require Firebase |
| Auth | Email / Google only | **NEVER SMS** — never free, prime fraud target |

### Cost at scale
| Users | Google Maps | Mapbox | **This stack** |
|---|---|---|---|
| 10,000 | ~$700/mo | ~$165/mo | **$0** |
| 100,000 | ~$3,430/mo | ~$1,650/mo | **~$6-20/mo** |

### Hard constraints (known, accepted)
- **A PWA cannot track GPS with the screen off.** Not hard — impossible. The Geolocation API is
  not exposed to service workers. Mitigation: Wake Lock (screen on, handlebar mount), which is
  how people use Strava anyway. Real fix is Capacitor in Phase 4.
- **TWA/PWABuilder does NOT solve this** — it runs the PWA inside Chrome and inherits every limit.
- **Play Store:** 12 testers continuously opted in for 14 days before production. Counter resets
  if anyone drops. Recruit 15+. Hard two-week floor — start the clock early.

---

## Build order

### Phase 1 — The spine (prove the concept)
- [x] MapLibre + OpenFreeMap map screen
- [x] Live GPS position with Wake Lock
- [x] Hazard data layer (Firestore write, cached snapshot read)
- [x] Client-side proximity detection
- [x] **Voice alerts** — the "wow" moment
- [x] One-tap hazard reporting

### Phase 2 — Safety net
- [x] Live share with family (watch-my-dot link)
- [x] SOS — one tap sends a Maps pin via native share / SMS
- [ ] Nearest open bike shop when stranded
- [ ] Rain check before ride
- [ ] Pre-ride safety checklist

### Phase 3 — The moat
- [ ] Bike registry (serial + photos + receipt)
- [ ] Stolen bike board + auto-poster
- [ ] **Pre-purchase serial check**
- [ ] Theft hotspot map feeding voice warnings
- [ ] Contribution stats / rider reputation

### Phase 4 — Growth
- [ ] Loop ride generator
- [ ] "Who's riding my route today"
- [ ] Capacitor wrapper for background GPS
- [ ] Play Store launch

---

## Existing pages — nothing wasted, everything repositioned

| Page | New role |
|---|---|
| Maintenance, Bike Doctor | Surfaces **when you break down**, not buried in a menu |
| Safety Gear | Becomes the **pre-ride check** |
| Gear Simulator | Keep — genuinely unique and good |
| Knowledge, Diet, Warm-Up, Motivation | Fold into one "Learn" section. Supporting cast. |
| 30-Day Challenge | Keep as beginner onboarding |
| Routes | **Upgrades** into the loop generator |
| Record / Tracker | Keeps working, stops being the point |
