# Build Prompt — "Ride Doctor" (working name): a Flutter app that diagnoses, trains and race-preps cyclists

> Paste this whole file into Claude Code, or save it in the project root as `PROMPT.md` and tell Claude Code:
> **"Read PROMPT.md and follow section 0 exactly."**

---

## 0. How to work with me (read this first)

- **Your role:** senior Flutter engineer, AI engineer and instructor. I'm France, a 4th-year BSIT student (Python, C#, JavaScript, Dart/Flutter). I want to *learn* while we build, so explain **why** for every important decision in 2–4 sentences — not essays.
- **Start in plan mode.** Do not write feature code yet. First:
  1. Ask me the questions in **section 13** (all at once, numbered).
  2. Then propose the Phase 0 + Phase 1 plan (files, packages, commands).
  3. Wait for my "go" before implementing.
- **Work phase by phase (section 8).** At the end of every phase: stop, summarize what was built, show me how to run and test it, list known gaps, and wait for my "go".
- **Create and maintain `CLAUDE.md`** in the repo root: project purpose, commands (run, test, analyze, build), architecture rules, coding conventions, and "never do" rules from section 10. Keep it updated as decisions change.
- **Log decisions** in `docs/DECISIONS.md` (short ADR format: context → decision → consequences).
- **Document the science** in `docs/SCIENCE.md`: every formula and threshold, its source, its limits. If you are not sure a number or source is right, say so and mark it `TODO(verify)` — never invent a citation.
- Small, focused commits with Conventional Commit messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Never commit secrets.

---

## 1. Product vision

Strava records *what* happened on a ride. Training apps (TrainerRoad, JOIN) prescribe *plans*. Fit apps (MyVeloFit) analyze *position*. **No app connects a rider's symptom → its cause → a fix → a re-test**, across body, bike setup, ride data and weather.

**Ride Doctor** is a personal cycling coach that:

1. **Knows the rider** — body, fitness, health readiness, bike and drivetrain, goals, races.
2. **Calculates** personal numbers — heart-rate/power zones, saddle-height starting point, gear-vs-cadence on climbs, heat risk, fueling and hydration — with the formula and source behind every number.
3. **Prepares beginners for their first race** (criterium, road race, time trial, gravel, MTB XC) — countdown plan, skills, tactics, checklists, race-day timeline, post-race debrief.
4. **Plans every day** — one clear session per day, delivered by notification, adjusted for heat/rain and how the rider feels.
5. **Diagnoses problems** — "my quads cramp on climbs" → ranked likely causes → one fix to try → re-test next ride.
6. **Educates** — every screen teaches *why*, so beginners become knowledgeable riders.

Primary market: Philippines (hot, humid, rainy), but built for riders worldwide (units, languages, climates).

---

## 2. Users and personas

| Persona | Need | Example |
| --- | --- | --- |
| **First-time racer** (primary for MVP) | "My first criterium is in 2 weeks / tomorrow — what do I do?" | France: converted gravel bike (drop bar, 2x 39/52, 10-speed), quad cramps on moderate climbs, first crit race |
| **Beginner** | Ride without pain, build a routine, understand their bike | New rider with flat pedals, no sensors |
| **Intermediate** | Structured improvement, better pacing and gearing | Weekend group rider with HR strap |
| **Advanced** | Precise zones, load tracking, race-specific prep | Racer with power meter |

Design for the **beginner with only a phone**. Every sensor (HR strap, cadence, power meter, bike computer) is optional and *increases accuracy* when present.

---

## 3. Non-negotiables

1. **Accuracy:** all calculations live in a pure-Dart, framework-free `core/science` layer with unit tests and documented sources. Every output shows its **confidence**: `Measured` (from sensor/test), `Estimated` (formula), or `Rough` (weak inputs).
2. **Explainability:** every recommendation has a "Why?" sheet: inputs used, formula in plain words, source link, and what would make it more accurate.
3. **Safety first:**
   - Onboarding includes a **PAR-Q+ style** pre-participation readiness check. "Yes" answers → recommend seeing a doctor before hard training or racing (do not block the app, do not diagnose).
   - **Red-flag symptoms** (chest pain or pressure, fainting, unusual shortness of breath, palpitations, confusion during heat, sudden severe joint pain, swelling) always route to "Stop and seek medical care" — never to bike-fit advice.
   - Heat-risk warnings use PAGASA heat index categories (section 7.10).
   - **No weight-loss, calorie-restriction or body-image features.** Weight is used only for physics and fueling.
   - Clear disclaimer: educational tool, not a medical device.
4. **Security and privacy:** section 10 is mandatory, not optional polish.
5. **UX:** section 11. Beginners must reach a useful result within ~2 minutes of installing.

---

## 4. Tech stack (defaults — confirm with me in section 13)

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | Flutter (stable), Dart 3, **Android first**, iOS later | My main stack |
| State management | Riverpod (+ riverpod_generator) | Testable, compile-safe DI |
| Navigation | go_router | Declarative, deep-linkable |
| Models | freezed + json_serializable | Immutable models, safe serialization |
| Local database | drift (SQLite), **offline-first**, encrypted with SQLCipher | Works on rides with no signal; data stays on the device |
| Secrets on device | flutter_secure_storage | Holds the DB encryption key |
| Backend (later phase, opt-in sync) | Supabase: Auth, Postgres with RLS, Edge Functions | Familiar to me; RLS is the security model |
| Weather | Open-Meteo forecast API (hourly temperature, humidity, apparent temperature, precipitation probability, wind, UV) behind a `WeatherRepository` interface | Free, no key for non-commercial use. **Check its license before any monetization**; the interface lets us swap providers |
| Notifications | flutter_local_notifications + timezone + flutter_timezone | Daily plan reminders |
| Localization | flutter_localizations + intl ARB files: `en`, `fil` | Global + Filipino riders |
| Lints | very_good_analysis (or flutter_lints at strict settings) | Catch bugs early |
| CI | GitHub Actions: `dart format --set-exit-if-changed`, `flutter analyze`, `flutter test` | Quality gate on every push |

Later phases (evaluate packages first, explain trade-offs, then propose):
- GPS ride recording: geolocator + Android foreground service.
- BLE sensors: flutter_blue_plus — Heart Rate (0x180D), Cycling Speed and Cadence (0x1816), Cycling Power (0x1818).
- Health Connect: `health` package.
- .FIT file import: evaluate available Dart FIT parsers.
- On-device pose detection: google_mlkit_pose_detection.

**Do not build on the Strava API.** Since Nov 2024 its terms allow third-party apps to show Strava data only to that same user and forbid using API data in AI/ML models; June 2026 changes also cut off apps routing data through intermediaries. Our data comes from the phone, sensors, Health Connect and user-owned .FIT files.

---

## 5. Architecture and folder structure

Feature-first clean architecture. Domain and science code must not import Flutter.

```
lib/
  app/                 # bootstrap, router, theme, l10n wiring
  core/
    science/           # PURE DART: formulas, constants (with source comments), unit conversion
    rules/             # diagnosis rule engine (pure Dart)
    errors/  utils/  units/
  features/
    onboarding/        # profile wizard + PAR-Q+ + consents
    profile/           # rider, bike, drivetrain, sensors
    calculators/       # zones, saddle height, gear/cadence, climb predictor, heat, fueling
    race_prep/         # events, countdown plan, skills, tactics, checklists, race day, debrief
    daily_plan/        # sessions, notifications, check-ins
    weather/           # Open-Meteo client, heat index, ride windows
    diagnosis/         # body map, symptom reports, results, fix trials
    settings/          # units, language, privacy, export/delete
    <each feature>/{data, domain, presentation}
  l10n/
test/                  # mirrors lib/; core/science and core/rules tests are mandatory
docs/  SCIENCE.md  DECISIONS.md  PRIVACY.md
```

---

## 6. Rider profile — what to collect (and why)

Use **progressive profiling**: onboarding asks only the ★ essentials; the app asks for the rest when a feature needs it ("To calculate your climbing gears, tell me your cassette"). Every field shows a short "Why we ask".

| Group | Field | Unit / format | Used for | |
| --- | --- | --- | --- | --- |
| Basics | Display name | text | Personalization | ★ |
| | Birth year | year | Age → HRmax estimate, zones | ★ |
| | Sex (optional, "prefer not to say") | enum | Only where a formula needs it | |
| | Height | cm / in | Bike size context | ★ |
| | Weight | kg / lb | Climb physics, W/kg, fueling | ★ |
| | Inseam | cm / in | Saddle-height starting point | |
| | City / location | lat-lng (permission) | Weather, heat, timezone | ★ |
| Readiness | PAR-Q+ style answers | yes/no | Safety recommendation | ★ |
| | Resting HR | bpm | Karvonen zones | |
| | Max HR (measured) | bpm | Zones (beats estimate) | |
| | Current pain areas / past injuries | body map + optional note (sensitive) | Diagnosis context | |
| Fitness | Years riding; rides per week; typical ride length | numbers | Plan starting load | ★ |
| | Hours available per week; preferred days and time | numbers / weekdays | Daily plan | ★ |
| | FTP (W) — if known | W | Power zones, W/kg | |
| | LTHR — if known (or from a 30-min test) | bpm | Friel HR zones | |
| | Self-rated skills 1–5: cornering, pack riding, climbing, sprinting, descending | 1–5 | Skills plan | |
| Bike | Bike type (road, gravel, MTB, hybrid, converted) | enum | Advice context | ★ |
| | Wheel/tire (ETRTO, e.g. 622 + 28 mm) | mm | Wheel circumference | |
| | Crank length | mm | Fit, cadence context | |
| | Chainrings (e.g. 39/52) and cassette (e.g. 11-28, 10-speed) | teeth | Gear/cadence, climb predictor | |
| | Pedals (flat / clipless) | enum | Fit and skills advice | |
| | Current saddle height (BB center to saddle top) | mm | Fit check | |
| | Tire pressure | psi / bar | Race checklist | |
| Sensors | HR strap, cadence, speed, power meter, bike computer, smartwatch | multi-select | Data sources, confidence | |
| Goals | Goal type: finish first race, race faster, ride pain-free, build endurance, general fitness | enum | Plan focus | ★ |
| Races | Type, date, start time, location, duration or distance, laps, lap length, corner count, elevation, category, rules notes | structured | Race prep | |

Validation: realistic ranges for every numeric field (e.g. weight 30–250 kg, resting HR 30–120 bpm) with friendly error messages.

---

## 7. Calculation engine (pure Dart, `core/science`, 100% unit-tested)

Each function returns a value **plus** `confidence` and `explanation` (inputs used, formula name, source key). Put all constants in `core/science/constants.dart`, each with a source comment, and document them in `docs/SCIENCE.md`. Verify every source yourself; mark anything uncertain `TODO(verify)`.

7.1 **Age** from birth year.

7.2 **Max HR:** prefer measured. Otherwise estimate with Tanaka: `HRmax = 208 − 0.7 × age` (confidence: Estimated; say individual variation is large).

7.3 **HR zones**, best available method first:
- LTHR known → Friel cycling zones as % of LTHR: Z1 < 81%, Z2 81–89%, Z3 90–93%, Z4 94–99%, Z5a 100–102%, Z5b 103–106%, Z5c > 106%.
- Resting HR + max HR → Karvonen (heart-rate reserve) 5 zones.
- Else → % of HRmax 5 zones (50–60, 60–70, 70–80, 80–90, 90–100%).
- Include the LTHR field test instructions: 30-min solo hard effort, LTHR ≈ average HR of the last 20 minutes.

7.4 **Power zones** (if FTP): Coggan — Z1 < 55%, Z2 56–75%, Z3 76–90%, Z4 91–105%, Z5 106–120%, Z6 121–150%, Z7 > 150% of FTP. Also W/kg.

7.5 **Saddle height starting point:** LeMond `0.883 × inseam` (BB center to saddle top). Plus the heel-on-pedal check, and target knee flexion around 25–35° at bottom dead center for a static check (mark range as `TODO(verify)` and cite). Always say "starting point — adjust 2–3 mm at a time".

7.6 **Wheel circumference:** `π × (bead seat diameter + 2 × tire width)` mm (e.g. 622 + 2×28). Allow a measured override (roll-out test).

7.7 **Gearing:** ratio = chainring / cog; development (m per crank turn) = ratio × circumference; cadence at speed = (speed in m/min) / development; speed at cadence = inverse.
**Golden test:** 39×28, 2.10 m wheel, 8 km/h → **≈ 45.6 rpm**. 34×32 at the same speed → **≈ 59.8 rpm**.

7.8 **Climb predictor (physics):**
`P × η = v × [ m·g·(sin θ + Crr·cos θ) + 0.5·ρ·CdA·v² ]`
- m = rider + bike + kit; θ = atan(grade); defaults Crr ≈ 0.005 (road), CdA ≈ 0.35 m² (hoods), η ≈ 0.97; ρ from air temperature and pressure (`ρ = p / (287.05 × T_kelvin)`).
- Solve v for a given power with a numeric root-finder (bisection or Newton, with tests).
- Rider power: from FTP if known; otherwise a user-chosen effort (e.g. "steady but sustainable") mapped to a rough default, confidence = Rough.
- For each climb segment: speed → cadence in each available gear → recommend the gear nearest the target cadence (beginner target 70–90 rpm). **Flag "you will grind"** when even the lowest gear is below 60 rpm, and compute which cassette or chainring would reach ~75 rpm.

7.9 **Training load:** session RPE (Foster) × minutes = load. Show weekly load and flag (do not block) when a week exceeds ~1.5× the 4-week average.

7.10 **Heat risk:** NWS (Rothfusz) heat index from temperature + relative humidity, with the standard low-HI and adjustment cases. Test against values from the NWS heat index chart. Map to **PAGASA** categories:
- < 27°C not hazardous · 27–32°C caution · 33–41°C extreme caution · 42–51°C danger · ≥ 52°C extreme danger.
- Ride rules: danger → suggest an early-morning window or indoor/easy session; extreme danger → advise not riding outdoors. From the hourly forecast, find the **best ride window** (lowest heat index, low rain chance) for the rider's available time.

7.11 **Hydration:** sweat-rate test = (pre-ride kg − post-ride kg + fluid drunk L − urine L) / hours. Plan aims to limit body-mass loss to under ~2%, and warns against over-drinking (hyponatremia risk). Electrolyte note for long or hot rides.

7.12 **Fueling by ride duration:** < 60 min → usually not needed; 60–150 min → ~30–60 g carbs/h; > 150 min → up to ~60–90 g/h if the gut is trained. Pre-race meal 2–3 h before. Mark sources `TODO(verify)` until confirmed.

7.13 **Taper:** for races with ≥ 2 weeks notice, reduce volume roughly 40–60% over the final 7–14 days while keeping some intensity (cite the taper meta-analysis you use).

---

## 8. Phases, features and acceptance criteria

### Phase 0 — Foundation
- Project scaffold (or reuse my existing `pedalwise_ph` project — ask me), folder structure, lints, theme (light/dark), router, l10n setup (en/fil), CI workflow, `CLAUDE.md`, `docs/`.
- **Done when:** app launches to a placeholder home; `flutter analyze` is clean; CI passes; CLAUDE.md exists.

### Phase 1 — Profile, consents and calculation engine (core value)
- Onboarding wizard (★ fields only, ≤ 5 screens), PAR-Q+ check, consent screen (health data, location, notifications — separately).
- Profile/bike/drivetrain editors with progressive profiling.
- `core/science` complete for 7.1–7.8 and 7.10 with tests; "My Numbers" screen: zones, saddle height, gear chart (cadence vs speed per gear), each with confidence + Why? sheet.
- **Done when:** a new user finishes onboarding in ≤ 2 min; all golden tests pass; science test coverage ≥ 90%.

### Phase 2 — Race Prep (beginner racers) ← highest priority after Phase 1
- **Add a race:** type (criterium, road race, time trial, gravel, MTB XC), date/time, location, format (laps × lap length or distance or duration), corners, elevation, category, rules notes.
- **Countdown mode** picks itself from days remaining:
  - ≥ 8 weeks: base → build → taper plan.
  - 2–7 weeks: compressed build + taper.
  - 2–13 days: race-week mode (openers, sleep, skills review, logistics).
  - < 48 h: **Race-Day mode** — checklist, timeline, warm-up, tactics card, weather and heat.
- **Race-day timeline**, computed backward from start time: wake-up, pre-race meal (2–3 h before), arrival (60–90 min before), registration/number pinning, recon laps if allowed, warm-up 15–25 min with a few short hard efforts ending ~5–10 min before start, final bottle and toilet.
- **Checklists** (tick-able, reusable): bike (tire pressure, quick-releases/thru-axles, bolts, brakes, shifting, bar-end plugs), kit, documents (ID, license/waiver, race number and pins), nutrition and bottles, tools and spare tube, sunscreen.
- **Criterium skills and tactics library** (short cards + safe solo drills): holding a straight line, cornering (look through the turn, brake before not in the corner, outside pedal down), not overlapping wheels, riding in a pack, staying in the front third to avoid the accordion effect, **shifting to an easier gear before corners to sprint out spinning**, what to do when dropped or lapped, primes. Same structure for other race types.
- **Post-race debrief:** structured questions (result, where you struggled, when you got dropped, symptoms, what you'd change) → saved, and fed into Diagnosis (Phase 4) and the next plan.
- **Done when:** I can add my race and immediately see the right countdown mode, timeline, checklists and tactics; debrief saves and shows on history.

### Phase 3 — Daily plan, notifications and weather
- Rule-based plan generator using goal, available days/hours, fitness level, races on the calendar, and recent RPE/load. One clear session per day: purpose, duration, zone targets (HR/power/RPE), structure, and off-bike strength/mobility on rest days.
- **Morning notification** (user-chosen time): today's session + heat badge + best ride window. **Evening check-in:** RPE, sleep quality, soreness/pain → adjusts the next days.
- Android 13+ notification permission; use inexact scheduling for daily reminders (exact alarms are restricted on Android 14+); reschedule after reboot and timezone change.
- Open-Meteo client with caching and offline fallback; heat/rain adjustments (move, shorten or swap to indoor/easy).
- **Done when:** notifications fire at the chosen time on a real device; a danger-level forecast changes the suggested window or session.

### Phase 4 — Diagnosis engine ("Something hurts?")
- Body map (front knee, back of knee, quads, hamstrings, calves, hips, lower back, neck/shoulders, hands/wrists, feet, saddle area) × symptom type (pain, cramp, numbness, burning, fatigue) × context (climbs, sprints, after X min, heat, specific position) × severity.
- **Rule engine** in `core/rules`: versioned rules (JSON or Dart) with conditions, weights, explanation, fix, source. Red-flag rules evaluated first.
- Output: ranked likely causes (bike setup / gearing / training load / fueling-heat / technique), **one fix to try**, then a **fix trial** that asks after the next ride "better / same / worse?" and learns what worked.
- Example rule chain to support: quad cramp on moderate climbs + low climbing cadence (from gear calculator) + 39T small ring + hot day → (1) gearing too tall, (2) saddle low/forward, (3) heat + fatigue.
- **Done when:** every rule has a test; red flags always win; a fix trial completes end-to-end.

### Phase 5 — Ride data
- GPS ride recording with a foreground service; BLE HR/cadence/power; Health Connect import; .FIT import. Ride summary feeds load, diagnosis and climb predictor (real grades and cadence).

### Phase 6 — Phone fit check
- On-device pose detection on photos/video of the rider on the bike (against a wall or on a trainer): knee angle at bottom dead center, hip and back angle. **Images never leave the phone unless I opt in.** Results flow into Diagnosis.

### Phase 7 — Optional cloud and AI layer
- Opt-in Supabase account and encrypted sync (RLS on every table).
- LLM **explains** results in plain English/Filipino via a Supabase Edge Function proxy (API key server-side, rate-limited, minimal de-identified data, explicit consent). The LLM never makes the diagnosis — the rule engine does.

---

## 9. Data model (local drift tables; mirror in Supabase later)

`rider_profile`, `readiness_screening`, `consent_record`, `bike`, `drivetrain`, `sensor`, `race_event`, `race_checklist_item`, `race_debrief`, `training_plan`, `planned_session`, `completed_session` (duration, RPE, load, notes), `daily_checkin`, `symptom_report`, `diagnosis_result`, `fix_trial`, `weather_cache`, `app_settings`.
All rows carry `id` (UUID), `created_at`, `updated_at`; synced tables also carry `user_id`. Write migrations from day one.

---

## 10. Security and privacy (mandatory)

- Health and body data are **sensitive personal information** under the Philippine Data Privacy Act of 2012 (RA 10173); also design to GDPR-style rights for global users.
- **Granular consent** (health data, location, notifications), stored with timestamp and version; revocable in Settings.
- **Encryption at rest:** drift + SQLCipher; key generated on first launch and stored in flutter_secure_storage.
- **Data rights:** export all my data (JSON) and delete everything (local + cloud) from Settings.
- **No secrets in the repo:** use `--dart-define` / `.env` files that are gitignored; add a secret-scanning step to CI.
- **Supabase (when added):** RLS enabled on every table with `user_id = auth.uid()` policies; no service-role key in the app; Edge Functions validate input and rate-limit.
- **Network:** HTTPS only; validate and sanitize all API responses; timeouts and retries with backoff.
- **Logging:** no personal or health data in logs or crash reports; no third-party analytics that receives health data.
- **Release builds:** `--obfuscate --split-debug-info`; minimal Android permissions, each requested in context with a reason.
- **Input validation** on every field (ranges, types, lengths).
- Write `docs/PRIVACY.md` (plain-language privacy policy draft).

---

## 11. UI/UX requirements

- **Home = "Today":** today's session card, heat/weather badge + best ride window, race countdown card (switches to Race-Day mode < 48 h), big "Something hurts?" button.
- **Outdoor-first design:** high contrast, large type, touch targets ≥ 48 dp, one-handed use, dark mode, readable in sunlight.
- **Every number** shows unit, confidence chip (Measured / Estimated / Rough) and a "Why?" sheet — this is how the app educates.
- Friendly beginner language; glossary for terms like FTP, LTHR, cadence, RPE, criterium.
- Proper empty, loading, error and offline states everywhere.
- Accessibility: semantic labels, text scaling to 200%, color never the only signal.
- Metric/imperial toggle; English/Filipino.
- Material 3 with a clean, sporty, distinctive theme — propose 2 palette options before implementing.

---

## 12. Testing and quality gates

- Unit tests: every science function (golden values in 7.7, NWS chart values in 7.10, zone boundaries) and every diagnosis rule.
- Widget tests: onboarding, My Numbers, Race-Day mode, checklists.
- Integration test: add race → countdown mode → race-day timeline.
- Coverage: ≥ 90% for `core/science` and `core/rules`; ≥ 70% overall.
- CI must pass before any phase is marked done.

---

## 13. Questions to ask me before coding

1. App name and package ID — new app, or build inside my existing `pedalwise_ph` (com.pedalwise.ph) project?
2. Confirm the stack in section 4 (Riverpod, go_router, drift + SQLCipher, Supabase later)?
3. My bike details: cassette range, wheel/tire size, crank length, current saddle height.
4. Sensors I have now or plan to buy (HR strap, cadence, power meter, bike computer, smartwatch)?
5. Is this a portfolio project, research project or future startup? (Affects Open-Meteo licensing and monetization.)
6. LLM budget for Phase 7, or keep everything free and on-device?
7. Filipino translation at launch or after MVP?
8. Hours per week I can spend, so you can size each phase.

---

## 14. Your first task

Stay in plan mode. Ask me the section 13 questions. After I answer, present the Phase 0 + Phase 1 plan (packages with versions you'll verify on pub.dev, folder tree, first files, test list, commands). **Do not write code until I say "go".**
