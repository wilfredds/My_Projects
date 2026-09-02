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
individually. Baseline is **547 tests across 34 files, all passing** — if you
see fewer, something is being skipped.

## What matters here

- **Audio-first is the point.** Every corner call is spoken, carries a distinct
  tone and buzzes the phone, so a whole session can be completed without
  looking at the screen. Do not introduce a change that only communicates
  visually — you cannot watch a screen and move to a corner simultaneously.
- **Split-step timing is precise.** An optional metronome tick fires a
  configurable 0.2–0.7s _before_ each call. Timing code (`lib/timer`,
  `lib/audio`) is latency-sensitive; changes there need tests.
- **The app is the random caller.** No partner, no feeder, no court. Features
  that assume a second person are out of scope.
- **Level and game are settings, not decoration.** `lib/training/profile`
  turns them into the three things that actually change a session: the volume
  (rounds, work, rest and call interval, scaled from the drill's own
  intermediate defaults), the shot vocabulary, and the zone weights. Singles is
  corner-to-corner, doubles is flat and front-heavy; a drill declares which game
  it is for and `both` takes the player's. Pass the profile into
  `configFromDrill` — without it you get the drill as written, which is what a
  challenge needs and what a listing should show.
- **A rally pattern calls a point, not a corner.** `lib/timer/patterns` holds
  named sequences of corner-plus-shot taken from how rallies are constructed;
  `pattern` selection walks one, then picks another. Every shot must be legal
  for its row and inside its own level, and a test asserts both. A pattern that
  asked for a smash from the net would discredit every call after it.
- **Curated third-party video is deliberately absent.** See the README's
  library section and `PROGRESS.md` for the reasoning before adding it.
- **Safety features are never paywalled.** The warm-up, the daily readiness
  check and the training-load warning stay free for everyone. `ALWAYS_FREE` in
  `lib/premium/entitlements.ts` records this, and a test fails the build if one
  of them turns up in the paid list. Do not move that line.
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
  app renders at the same size.
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
- **No payment provider is wired.** Premium is a local entitlement plus an
  upgrade screen that says so on the page. Anything that looks like it takes
  money must keep saying it does not until a provider and server-side receipt
  verification exist.

## Layout

- `src/features/` — `train`, `progress`, `programs`, `conditioning`,
  `benchmark`, `library`, `auth`, `profile`, `welcome`, `onboarding`, `games`,
  `premium`, `social`, `design-system`. `welcome` is the first-run flow;
  `onboarding` is still the profile questionnaire it hands over to.
- `src/lib/` — `audio`, `timer`, `motion`, `programs`, `data`, `supabase`,
  `auth`, `coach`, `figures`, `games`, `library`, `premium`, `share`, `social`,
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
