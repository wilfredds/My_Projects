# RallyReady

Self-directed at-home badminton training for a solo player with no coach and no
partner. Guided footwork drills, conditioning, progression tracking, structured
programs and a vetted library — in one place, instead of scattered across
YouTube tabs.

**Eight phases are complete** — the guided drill trainer, accounts, progress
tracking, the fitness benchmark, stamina/conditioning workouts, periodised
multi-week programs, the reference library, training load and readiness, the
goal-first catalogue and drawn fundamentals, and a coach that decides your day.
Two things are deliberately absent: curated third-party video (see
[the library](#the-library)), and a payment provider — the Premium tier is built
and its upgrade screen says plainly that nothing charges you yet. `PROGRESS.md`
has the reasoning for both.

---

## What makes it different

- **Audio-first.** Every corner call is spoken, carries a distinct tone, and
  buzzes the phone. You can complete a whole session without once looking at
  the screen — which is the point, because you cannot watch a screen and move
  to a corner at the same time.
- **Solo-native.** The app _is_ the random caller. No partner, no feeder, no
  court required.
- **Split-step training.** An optional metronome tick fires a configurable
  0.2–0.7s before each call, so you learn to land the split-step as the call
  arrives. This is the single most common club-player fault.
- **Real deception.** A fake call, then the real one, forcing a second
  split-step. The fake sounds _identical_ to a real call — a fake you can hear
  coming would train nothing.
- **Offline.** Installable as a PWA. The timer, the drills and the coaching
  notes all work with no connection at all, and sessions still log.
- **Real progression.** Sessions log themselves. The dashboard shows a weekly
  streak, training load, whether your pace is actually improving, personal
  bests per drill, and a trophy case — all derived from what you logged, none
  of it paywalled.
- **Training load, not minutes.** One tap after a session rates the effort 1–10;
  effort × minutes is the number that actually compares a brutal ten minutes
  with an easy half hour. From that the app watches the ramp — a week far
  heavier than the month behind it is where overuse injuries come from, and
  training alone means nobody else is watching for it.
- **It adjusts to you, not to the calendar.** Three taps — sleep, legs, energy —
  and the session bends: lighter when you are beaten up or ramping too fast, a
  round more when you are fresh and have room. A written plan cannot tell you
  slept four hours. This is the part that makes it feel coached.
- **It tells you why.** Today's card names the block you are in and when it lets
  up: "Base week 3 of 12 — next week backs off". The weeks people quit on are
  the ugly ones in the middle, and they quit because from the inside a
  twelve-week plan looks like an infinite one.
- **A number to chase.** A repeatable B-ENDURANCE-style benchmark: twelve
  levels of four-corner movement, work stepping 18s → 30s against a fixed 10s
  recovery. You go until you cannot hold the pace, and the score is charted
  over time.
- **Conditioning that needs no court.** Badminton HIIT on real rally:rest
  ratios, multifeed-style speed intervals, and agility-ladder and plyometric
  circuits — each exercise with coaching cues, common faults, a no-kit
  substitute, and an animated schematic the app draws itself.
- **Programs that decide for you.** Periodised 4–16 week plans — Base → Build →
  Sharpen, a deload every fourth week and a taper at the end — generated from
  four choices rather than hand-assembled. Today's session is the first card on
  the home screen. Write your own and publish it for other players to follow.
- **A warm-up you can actually do.** Guided, audio-first, RAMP-structured — six
  minutes of raise, mobilise and sharpen, or three when that is all you have,
  plus a cool-down. Offered under the drill you are about to run, and it gets
  out of the way once you have done it.
- **Your data is yours.** Export every session and benchmark to one file and
  import it on another device. Merges rather than overwrites, so importing the
  same backup twice changes nothing.
- **Share a session.** Drawn as an image and handed to the OS share sheet, which
  is what reaches Messenger, Facebook and Instagram.
- **A coach that decides.** Readiness, workload, what you have neglected, your
  program and the benchmark clock all collapse into one instruction with one
  reason: do this today, and here is why. It will refuse to train you on a rest
  day, and it puts the plan ahead of its own preferences.
- **A rating that goes up.** 0–1000 from consistency, volume, sharpness, engine
  and range, through six tiers. Hard to farm on purpose — consistency is
  counted in weeks, so six sessions in one day buys nothing that six weeks does.
- **Reflex Rush.** Thirty seconds, tap the corner that lights up. The one thing
  a solo player cannot train against a wall, measured to the millisecond. It is
  also the only part of the app that exists purely to be fun, and it never
  touches your training log.
- **Challenge anyone, with no server.** The engine has always been
  seed-deterministic, so a short code carrying a drill and a seed reproduces the
  identical corner order on someone else's phone. "Beat my score" becomes a fair
  contest that fits in a chat message.
- **Start from what you want, not from a list.** Eight goals in your own words —
  "I want to be quicker", "I want to last three games" — each opening onto
  everything that trains it, filtered to your level. A flat catalogue only helps
  someone who already knows which drill fixes their problem.
- **The basics, drawn.** How to hold the racket, the backhand grip, the ready
  stance, the clear, the smash and the low serve, as a numbered path in teaching
  order. Grips get the handle in cross-section with the exact bevel picked out;
  swings get a jointed figure with a racket in hand. A grip is close to
  impossible to learn from prose, and "shake hands with it" tells a beginner
  nothing about which of the eight bevels anything sits on.
- **Beginner, intermediate and advanced kept apart.** You see your own level by
  default and can raise it whenever you like. Nothing is ever locked — the app
  says how much more is waiting.
- **A reference that is actually written.** Every drill, exercise and technique
  in one filterable list, each with coaching cues, the faults that spoil it, how
  much of it to do, and one tap to start it pre-configured. Search reads the
  cues, so "knee" finds the lunge.

---

## Setup

### Run it locally (no account, no backend)

```bash
npm install
npm run dev
```

That is genuinely all you need. With no Supabase configured the app stores
everything in local storage and every Phase 1 feature works.

**What that costs a player, stated plainly.** With no Supabase connected, a
player's training lives in one browser on one device. Clearing browser data
erases it, and a new phone starts from zero. Nothing is lost silently — the
Profile screen says so, and **Back up your training** there writes everything
to a single file you can load back — but a tester should be told before they
put in a month of sessions. Connecting Supabase (below) is what removes this,
and it takes about fifteen minutes.

### Put it on a phone

The app is a root-scoped PWA (`start_url: '/'`), so it needs its own domain
rather than a subpath. `vercel.json` here covers the two things a Vite PWA needs
from a host: a catch-all rewrite to `index.html`, so a deep link like
`/library/technique/the-split-step` still resolves on a cold load from the home
screen, and a `no-cache` header on `sw.js`, so a stale service worker cannot pin
an old build forever.

This app lives in a subdirectory of the repo, so when importing set:

| Setting        | Value                  |
| -------------- | ---------------------- |
| Root Directory | `rallyready`           |
| Framework      | Vite (auto-detected)   |
| Build command  | `npm run build` (auto) |
| Output         | `dist` (auto)          |

No environment variables are needed. Without `VITE_SUPABASE_*` the app runs on
the local backend, which is the right default for a device test: accounts are
off, everything is stored on the phone, and every drill still works.

Once it is open on the phone, use the browser's **Add to Home Screen**. Wake
lock, vibration and speech all behave differently in an installed PWA than in a
tab, and installed is how the app is meant to be used.

### Optional: connect Supabase for accounts and sync

Accounts are entirely optional — the app never blocks on one. Connect Supabase
and you additionally get sign-in and cross-device sync; anything you logged
signed-out is uploaded to the account the first time you sign in.

1. **Create a Supabase project** at [supabase.com](https://supabase.com).

2. **Run the schema.** Open your project → **SQL Editor** → **New query**,
   paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and
   **Run**. It is idempotent — re-running it is safe and will not drop data.
   It creates every table, turns on Row-Level Security with per-user policies,
   and seeds the drill catalogue and badge definitions.

   Verified against a real PostgreSQL 16: applied twice from empty, it creates
   **12 tables, all with RLS, 41 policies, 11 enum types and 30 seeded
   drills**, with no errors on either run. That check matters, because for a
   while the file did not run at all — two `alter type ... add value`
   statements had been pasted into the middle of its enum block, splitting the
   block and leaving Postgres rejecting the very first statement. `npm test`
   now guards the structure and checks that every value the app uses is
   declared.

   Or, with the CLI:

   ```bash
   psql "$SUPABASE_DB_URL" -f supabase/schema.sql
   ```

3. **Set the environment variables.** Copy the example file and fill it in from
   **Project Settings → API**:

   ```bash
   cp .env.example .env
   ```

   ```
   VITE_SUPABASE_URL=https://<your-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your anon public key>
   ```

   Both are safe in a browser bundle — the anon key only grants what RLS allows.

4. **Enable Google sign-in** (optional): Supabase dashboard →
   **Authentication → Providers → Google**, then add your OAuth client ID and
   secret and set the redirect URL to your app's origin. Email/password works
   with no extra setup.

   > If you leave **Confirm email** switched on (the default), sign-up will ask
   > the user to confirm before their first sign-in. Turn it off under
   > **Authentication → Providers → Email** if you want instant sign-up while
   > developing.

5. ```bash
   npm run dev
   ```

---

## Scripts

| Command             | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Dev server with HMR                                     |
| `npm run build`     | Typecheck, then production build (incl. service worker) |
| `npm run preview`   | Serve the production build — needed to test the PWA     |
| `npm test`          | Unit tests (Vitest)                                     |
| `npm run lint`      | ESLint                                                  |
| `npm run typecheck` | `tsc --noEmit`                                          |
| `npm run format`    | Prettier                                                |
| `npm run verify`    | typecheck + lint + test + build, in that order          |

Two things are generated rather than hand-maintained:

```bash
node scripts/generate-icons.mjs   # the PWA icon set and favicon
npm run seed:sql                  # the drill seed block inside schema.sql
```

The drill catalogue lives in `src/lib/data/seed/drills.ts` so a fresh install
works offline; `npm run seed:sql` derives the matching Postgres seed from it.
Edit the TypeScript, then re-run the script — never the SQL block directly.

> **Testing offline behaviour:** the service worker is disabled in dev on
> purpose. Use `npm run build && npm run preview`, load the page once, then go
> offline.

---

## Architecture

```
src/
  lib/
    timer/        the drill engine — pure, deterministic, unit-tested
    programs/     the periodiser — plans generated from four numbers
    audio/        speech, tones, haptics, wake lock (all feature-detected)
    data/         the repository layer: ports, local adapter, Supabase adapter
    auth/         Supabase auth, wrapped so nothing else touches the client
    supabase/     the one place a Supabase client is constructed
  features/       one folder per domain (train, progress, programs, …)
  components/     ui/ holds the shadcn primitives; the rest is app chrome
  store/          Zustand — cue preferences and per-drill setup
```

### The timer engine

The part that has to be correct is the part that is easy to test, so it is
four small pure modules with no React in sight:

| Module         | Responsibility                                                          |
| -------------- | ----------------------------------------------------------------------- |
| `corners.ts`   | The court model for 4/6/8 zones, plus the audio and haptic mapping      |
| `sequencer.ts` | Picks the next zone: sequential, random, weighted, and deception feints |
| `timeline.ts`  | Expands a plan into absolute-timestamped events                         |
| `cursor.ts`    | Pure playback head; `clock.ts` owns pause, resume and seek              |
| `benchmark.ts` | The B-ENDURANCE-style protocol, expressed as a ladder of plan steps     |

A plan's main set is either uniform (`rounds` × work/rest) or an explicit
`ladder` of steps. The ladder is what lets one engine drive three different
things: a footwork drill, the stepped benchmark, and a conditioning circuit
where each step names an _exercise_ instead of calling a corner.

A session's whole event timeline is **precomputed against absolute timestamps**
from a seed, rather than accumulated tick by tick. Three things fall out of
that: playback cannot drift, the session can be previewed before it starts, and
the entire engine is assertable in a test without touching a clock. If a
backgrounded tab freezes `requestAnimationFrame` for eight seconds, the cursor
catches up in a single step and suppresses the stale audio rather than dumping
a burst of callouts for moments that have passed.

### The repository layer

Components never touch storage. They call `useRepositories()`, which returns
implementations of the interfaces in `src/lib/data/ports.ts`. Two adapters exist
— local storage and Supabase — and swapping between them is one argument to
`createRepositories()`. An ESLint rule fails the build if anything outside
`src/lib/data/**` imports `@supabase/supabase-js`.

Streaks, dashboard statistics and badge unlocks are all **derived** from the
session history rather than stored as counters, in both adapters. A projection
cannot drift out of sync with reality; a counter can. Badge awarding is
therefore reconciliation, not an event: on every load the derived set is
compared against what is stored and the difference is written, so a badge can
never be missed because the app was closed at the wrong moment.

Streaks are counted in **weeks, not days** — missing a Tuesday should not wipe
out two months of consistent training.

### Training load and auto-regulation

`src/lib/data/load.ts` turns sessions plus their effort ratings into one number
per session — RPE × minutes — and from there into the figure that matters:
this week's load against the average of the last four. Below 0.8 you are easing
off, 0.8–1.3 is the maintenance band, and past 1.5 you are ramping faster than
your body has been prepared for. The ratio is **withheld entirely until there
is three weeks of history**, because before that it reads "spike" for everyone
who has just started, and a warning that fires on day two is a warning people
learn to ignore.

An unrated session is counted as a moderate effort rather than skipped:
excluding it would make a heavy week look light purely because it went unrated,
which is backwards for something whose job is to catch a heavy week.

`src/lib/data/readiness.ts` scores the daily check-in and combines it with that
load status into a single instruction. Two rules do most of the work. Any single
answer at the bottom of its scale forces "lighter" whatever the other two say —
averaging hides the answer that matters, and "slept fine, energy fine, legs
wrecked" is not a day for repeated lunging. And it will never suggest going
harder on feel alone: backing off a fresh player wrongly costs one ordinary
session, pushing a tired one wrongly costs six weeks.

The adjustment is applied by `scaleConfig()` at the moment the drill starts and
is never written into the saved configuration — it is a decision about today,
and a tired Tuesday must not quietly become a drill's new normal. Rounds move
before work time, because a round is the unit a player counts in.

### The periodiser

`src/lib/programs/periodise.ts` turns a program's shape — weeks, sessions a
week, level, court access — into its full week-by-week plan. Every fourth week
is a deload and so is the last; the loading weeks that remain split into base,
build and sharpen blocks, with any remainder going to base, because more base is
the safer error for a returning player. Each phase has its own weekly pattern of
session types, and drill pools are ordered easiest first so a base week cannot
serve up the hardest thing in the catalogue.

It is pure and deterministic, which is what lets a published program look
identical to everyone following it, and lets the whole thing be tested without a
database or a browser.

### The library

`src/lib/library/entries.ts` derives one browsable list from three catalogues —
drills, conditioning exercises, and written technique topics — rather than
holding a fourth copy of the same content. A cue fixed on a drill is fixed in
the library on the next render. Entries are identified by `kind/slug` because a
drill and a topic can legitimately share a slug, and the filtering is pure and
unit-tested.

**On the missing videos.** The brief asks for short reference clips from
reputable coaches and federations. Curating those means vouching for each one:
that the link resolves, that the channel is who it claims to be, and that the
coaching is sound. None of that is checkable from the environment this was built
in — outbound access to YouTube, the BWF and the national federations is blocked
— so shipping a list of plausible-looking links would be presenting guesses as
vetted, which is worse than shipping none.

The reference is therefore written rather than linked: ten technique topics with
the same cues-and-faults structure as the drills. The seam for clips is real and
tested — `ExternalReference` on a topic, `videoUrl` on a drill, both rendered
with attribution the moment either is filled in — so a curator with network
access can add them without touching a component.

### Design system

Live documentation at [`/design-system`](http://localhost:5173/design-system):
tokens, type scale, and every component rendered for real rather than pictured.

One accent (volt) on a neutral graphite base, and a colour per drill phase so
the state of a session is readable from across a room. Full dark mode, defaulting
to your OS setting and remembering an explicit choice. Inter is self-hosted, so
an installed PWA makes no network requests at all.

---

## Notable decisions

- **Everything degrades.** Speech synthesis, Web Audio, vibration and Wake Lock
  are each feature-detected; the cue settings sheet shows unsupported ones
  disabled with the reason rather than offering a switch that does nothing.
- **Audio is created on the Start tap, never at page load** — building an
  AudioContext earlier would interrupt whatever the user is listening to for no
  reason. Music and podcasts keep playing.
- **Speech cancels before every call.** At a 0.8s interval an utterance can
  outlast its slot, and `speechSynthesis` queues rather than interrupts; left
  alone the voice ends up calling corners from ten seconds ago.
- **Skipping a round does not count as completing it,** and the average shot
  interval only measures gaps between calls _within the same block_ — spanning
  a rest would report the length of the break instead of the pace of the drill.
- **Three columns were added to `drills`** beyond the original data model
  (`default_interval_ms`, `default_call_mode`, `enabled_corners`, and the
  warm-up/cool-down/level fields). Without them a seeded drill cannot express
  "net corners only, slower interval, deception on", and those settings would
  have to be hard-coded in the client instead of living with the drill.
- **Accounts are never required.** Signing in adds sync and nothing else; the
  sign-in screen says so, and with no Supabase project attached the app states
  that plainly rather than offering a button that cannot work.
- **The benchmark runner has no Skip button.** Skipping a level would
  invalidate the score, so the only way out is to stop — and stopping _is_ the
  measurement.
- **Programs are generated from a shape, not authored day by day.** Hand-placing
  84 days is not a task anyone finishes, and a plan assembled by hand tends not
  to periodise at all. The builder asks four questions and generates the rest;
  changing the shape later rebuilds the plan, which it says on the screen.
- **Locally, only edited program days are stored.** The days are generated on
  read from the program's shape, and an edited day is kept as a sparse override.
  The Supabase adapter writes every day out as a row instead — a published
  program has to look the same to every reader, including one on a later version
  of the periodiser.
- **Exercise demos are drawn, not filmed.** The brief asks for short demo
  clips; curating vetted video is Phase 5, and inventing links now would plant
  dead ones. Instead each exercise carries a schematic the app renders itself:
  an animated footfall pattern for ladder work, and a side-view figure driven
  by pose parameters for everything else. Both work offline and never rot, and
  for a ladder pattern a diagram beats video you would have to scrub.

---

## Licence

Unlicensed private project.
