# RallyReady — working notes

Self-directed at-home badminton training for a solo player with no coach and no
partner: guided footwork drills, conditioning, progression tracking, periodised
programs and a reference library.

**Stack:** Vite · React · TypeScript · Supabase · TanStack Query · Zustand ·
React Router · Tailwind · Radix/shadcn · Framer Motion · Recharts · Vitest ·
vite-plugin-pwa

## Node version

`package.json` declares:

```json
"engines": { "node": "^22.22.2 || ^24.15.0 || >=26.0.0" }
```

That range is `jsdom@30`'s, copied deliberately rather than loosened to
`>=22.22.2`. It is the exact intersection of what the toolchain needs —
`undici@8` wants `>=22.19.0`, `vite@8` wants `^20.19.0 || >=22.12.0`,
`vitest@4` wants `^20.0.0 || ^22.0.0 || >=24.0.0` — and jsdom is the binding
constraint in every case. A looser `>=22.22.2` would wrongly admit Node 23 and
25, which jsdom excludes.

Without a satisfying Node the failure is misleading: every vitest worker dies
before running a test with `TypeError: webidl.util.markAsUncloneable is not a
function`, and the summary reads `Test Files no tests`, which looks like a
config problem rather than a version one. That is exactly what happened when
CI first ran on Node 20.

**`engines` is advisory by default** — npm prints an `EBADENGINE` warning and
carries on. To make a wrong Node version fail at install time instead, add
`engine-strict=true` to an `.npmrc`. That is not set here, because it also
affects anyone else installing the project.

## Commands

```bash
npm run verify      # typecheck && lint && test && build — run this before claiming done
npm run dev
npm run typecheck   # tsc -b --noEmit
npm run lint        # eslint .
npm run lint:fix
npm test            # vitest run
npm run test:watch
npm run build       # tsc -b && vite build
npm run format
```

`npm run verify` is the single gate. Prefer it over running the four
individually. Baseline is **641 tests across 39 files, all passing** — if you
see fewer, something is being skipped.

## What matters here

- **Audio-first is the point.** Every corner call is spoken, carries a distinct
  tone and buzzes the phone, so a whole session can be completed without
  looking at the screen. Do not introduce a change that only communicates
  visually — you cannot watch a screen and move to a corner simultaneously.
- **The calls are in the player's language, and only the calls.**
  `lib/audio/language` holds the Taglish vocabulary: corners, zone numbers and
  phase words are Filipino, shots and exercise names stay English because that
  is what is actually shouted on a court in Manila, and the interface stays
  English because it is read sitting down. Every phrase is written twice —
  natively for a `fil-PH`/`tl-PH` voice, and **respelled** ("kah-lee-wah") for
  an English one, because iOS has no Filipino voice at all and falling back to
  English calls would take the feature away from the phones it is for. On the
  respelled path the utterance is tagged `en`: the text is English spelling, and
  a Filipino engine would read the hyphens. Which voice reads it is the
  player's choice, kept **per language** — the Filipino voice for a native call
  and the English one for a respelling are separate decisions — and it travels
  in `SpeakOptions` with the call rather than sitting in a module global, which
  is what the previous single `voiceUri` did: written by the settings screen,
  read by nobody, for the app's whole life. A stored voice the device no longer
  has falls through to the automatic pick rather than silencing the drill, and
  `listVoices` puts local voices first because a network voice fetches its audio
  and a late call is a wrong call. English is untouched by all of this
  and a test holds it that way — `cornerText(def, 'en')` is the corner's own
  wording and `LANGUAGE_INTERVAL_FACTOR.en` is exactly 1. Anything shown on
  screen that quotes a call must be quoted in the same language, or the player
  translates mid-lunge.
- **Split-step timing is precise.** An optional metronome tick fires a
  configurable 0.2–0.7s _before_ each call. Timing code (`lib/timer`,
  `lib/audio`) is latency-sensitive; changes there need tests.
- **The app is the random caller.** No partner, no feeder, no court. Features
  that assume a second person are out of scope.
- **One screen, one answer to "what do I do today?".** The hero on Train is a
  *fallback*, for a player nothing else is deciding for. It is withheld when
  Premium's coach is on and when a program is running — a plan that says rest
  with a big green Start button under it is the app arguing with itself, and on
  a bad check-in three separate systems were saying back off while the loudest
  control started a six-corner drill.
- **An accepted "take today lighter" is a 30% cut, and every number must know.**
  `configForToday` in `lib/data/readiness` is the single rule — the runner and
  every card that quotes a duration go through it, or the card advertises a
  session nobody is about to do. A warm-up or cool-down is never scaled: a
  shorter warm-up is not a lighter session, it is a worse one.
- **Say a thing once, and name it once.** Two exercises called "Plank shoulder
  taps" and two called "High knees" sat in the library for two phases, so the
  same movement appeared twice with two different write-ups; a test now fails
  the build on a duplicate name. `factsFor`'s kit label is a *fallback* for a
  drill that did not list its own — where the drill did, its wording wins,
  because "(optional)" and "(or tape)" are what decide whether somebody without
  the kit can train at all, and adding the generic label too produced cards
  asking for "skipping rope (optional)" next to "skipping rope".
- **Home is the default, the court is the bonus.** Every exercise declares the
  space it needs (`spot` / `room` / `court`) and whether the flat below can
  hear it. `lib/training/workouts` *derives* a workout's space, noise and kit
  from the exercises it contains — a circuit is as loud as its loudest movement
  — so a swapped exercise cannot leave a stale label behind. A drill with no
  circuit calls corners, which means strides and landings, never "fits a towel,
  quiet". `/workouts` is the one place they are all listed, and both facts are
  filters, because somebody in a small flat at eleven at night is the case the
  screen exists for.
- **Level and game are settings, not decoration.** `lib/training/profile`
  turns them into the three things that actually change a session: the volume
  (rounds, work, rest and call interval, scaled from the drill's own
  intermediate defaults), the shot vocabulary, and the zone weights. Singles is
  corner-to-corner, doubles is flat and front-heavy; a drill declares which game
  it is for and `both` takes the player's. Pass the profile into
  `configFromDrill` — without it you get the drill as written, which is what a
  challenge code reconstructs from. Anywhere a number is shown *to* the player
  it has to be the fitted one, or the card says 8 min and the drill runs 13.
  Opening a setup screen must not write an override: an override wins over the
  defaults for ever, so the drill silently stops following the level. A fitted
  drill matches no named preset, because the factors *scale* the drill's own
  numbers rather than snapping them to one — so the setup screen has three
  states, not two (`isFittedDifficulty` / `isFittedStructure`). Calling the
  fitted state "Custom · your own pace" told every beginner and every advanced
  player, on every drill, that they had chosen a pace the app chose.
- **A rally pattern calls a point, not a corner.** `lib/timer/patterns` holds
  named sequences of corner-plus-shot taken from how rallies are constructed;
  `pattern` selection walks one, then picks another. Every shot must be legal
  for its row and inside its own level, and a test asserts both. A pattern that
  asked for a smash from the net would discredit every call after it. The
  warm-up never runs one, and never names a shot either — it calls corners, at
  a gentler cadence, because a rally pattern is full-intensity work. When the
  call names a shot the interval has a higher floor (`minIntervalFor`): speech
  cancels the previous utterance, so a slot shorter than the phrase cuts
  "rear left, hold drop" in half.
- **Curated third-party video is deliberately absent.** See the README's
  library section and `PROGRESS.md` for the reasoning before adding it.
- **Safety features are never paywalled.** The warm-up, the daily readiness
  check and the training-load warning stay free for everyone. `ALWAYS_FREE` in
  `lib/premium/entitlements.ts` records this, and a test fails the build if one
  of them turns up in the paid list. Do not move that line.
- **A browser that refuses storage must still run a drill.** iOS Private
  Browsing, "block all cookies" and the in-app browsers inside Messenger and
  Facebook all let `localStorage` exist and then throw when you write to it —
  and an in-app browser is how somebody opens a link a friend sent them, which
  is how every tester arrives. `zustand/persist` guards *getting* the storage
  object but not the calls on it, so every persisted store goes through
  `store/persistStorage`, which wraps each one. Nothing may promise the player
  their training is safe without asking `isStorageWritable()` first — the
  Profile card and `components/StorageWarning` say plainly when it is not — and
  `shouldSeeWelcome` returns false there, because the "seen it" flag can never
  stick and the introduction would otherwise ambush the player on every visit.
  A refused session write is an *error*, not a shrug: returning the session
  anyway sent somebody who had just finished a drill to "Session not found".
- **`selectCuePreferences` is how a screen gets the cue preferences.** Three
  screens used to copy the store out field by field, so every new preference
  meant finding and editing three files and one was always missed. Build on the
  selector and override what your screen genuinely differs on — the benchmark
  turns the metronome off, because a test of pacing must not be paced.
- **Motion comes from `lib/motion`.** Four durations, two easings, two springs
  and a set of shared variants, mirrored into CSS custom properties in
  `index.css` so a Tailwind `duration-*` class and a framer-motion transition
  agree on what "quick" means. Do not hand-roll a duration, and do not write
  the reduced-motion ternary again — `useMotionSafe` / `useTransitionSafe` /
  `useInitialSafe` already do it, and `motionSafe` is unit-tested. Animate
  `transform` and `opacity` only. Nothing on `lib/timer/*` or `lib/audio/*`
  gets an animation, and nothing on the runner may force a layout or a paint
  per tick; `TimerDial.tsx` explains why its sweep has no CSS transition.
- **A figure that contradicts its cue is worse than no figure.** The renderer
  mirrors left and right, which makes it a *front view* by construction;
  `MobilityPose.ground` tips the whole body over for anything done on the floor
  and `MobilityPose.profile` turns the mirroring off for anything that has to
  be seen edge-on. In profile an angle means "degrees forward from straight
  down", and the sliver between the near and far limbs is added in screen space
  after the tip, not as a shoulder width — a body-space offset rotates with the
  figure and floats one foot off the floor. Render a contact sheet and look at
  a new pose before shipping it — every figure defect in this app has been
  found that way, never by reading. The box a sequence is drawn in comes from
  `figureBox`, cropped to what the poses and the blends between them actually
  use, so a figure on the floor is not drawn at a third of the size of one
  standing up; the pose label scales down with the crop so every caption in the
  app renders at the same size. Bones are filled tapered paths from `limbPath`,
  not strokes — a thigh and a wrist are different widths, which is what makes it
  a body rather than a stick man. Both end caps sweep 0; sweep 1 curls them back
  inside the limb and the non-zero fill rule punches a hole at every joint.
- **A premium block is weeks, not a flag.** `lib/premium/commitment` records
  what was bought and derives delivery from sessions that were actually logged.
  Any week inside a block that the entitlement did not cover is `uncovered` and
  is added back to the end date by `creditedEnd`. `GUARANTEES` in
  `entitlements.ts` states the three promises in the words they are made in;
  each is enforced by code, so do not weaken one without deleting its text.
- **A reward fires once.** `lib/rewards` compares what has been earned against
  a persisted record of what has been shown. That record is `string[] | null`,
  and `null` means "never looked" — an install from before rewards existed —
  in which case the app snapshots silently and celebrates nothing. Do not
  default it to `[]`.
- **Feedback is text, not telemetry.** There is no server to post to and no
  analytics in this app, so `lib/feedback/report` builds a plain-text report
  and hands it to the share sheet — Messenger, on the phone of the players this
  is for. Plain text because a human reads it before sending it, and a blob of
  JSON is something you forward without reading. It carries enough to reproduce
  a bug (screen, build, level, viewport) and nothing that identifies anybody;
  the training history is attached only if they switch it on, with the contents
  spelled out beside the switch. Do not quietly add anything to that report
  that its own "what this includes" section does not name.
- **No payment provider is wired.** Premium is a local entitlement plus an
  upgrade screen that says so on the page. Anything that looks like it takes
  money must keep saying it does not until a provider and server-side receipt
  verification exist.

## Layout

- `src/features/` — `train`, `workouts`, `progress`, `programs`, `conditioning`,
  `benchmark`, `library`, `auth`, `profile`, `welcome`, `onboarding`, `games`,
  `premium`, `social`, `design-system`. `welcome` is the first-run flow;
  `onboarding` is still the profile questionnaire it hands over to.
- `src/lib/` — `audio`, `timer`, `motion`, `programs`, `data`, `supabase`,
  `auth`, `coach`, `figures`, `games`, `library`, `premium`, `share`, `social`,
  `training`,
  `download.ts`, `firstRun.ts`, `pageDirection.ts`, `rewards.ts`, `theme.ts`
- `src/store/` — Zustand state · `src/hooks/` · `src/components/`
- `supabase/schema.sql` — database schema
- `scripts/generate-seed-sql.mjs` — run via `npm run seed:sql`

## Deployment

`vercel.json` configures Vercel. PWA assets come from `vite-plugin-pwa`.

## Gotchas

- `.github/workflows/rallyready-ci.yml` runs `npm run verify` on every push to
  `main` and every PR touching `rallyready/**`. It runs the same single command
  you would, rather than reimplementing the steps, so CI and local cannot drift.
  Still run `verify` locally first — CI is a safety net, not a substitute.
- Supabase credentials come from environment variables; the app expects them at
  build time via Vite's `import.meta.env`.
- `npm install` warns about a deprecated transitive `glob@11.1.0`. Harmless.
