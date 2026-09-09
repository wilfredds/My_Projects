# RallyReady — progress

Running log of what is built, what is next, and the judgement calls made along
the way.

---

## Status

| Phase                                   | State                          |
| --------------------------------------- | ------------------------------ |
| 0 — Scaffold, design system, data layer | ✅ Done                        |
| 1 — Guided drill trainer                | ✅ Done                        |
| 2 — Accounts, progress, benchmark       | ✅ Done                        |
| 3 — Stamina & conditioning              | ✅ Done                        |
| 4 — Multi-week programs                 | ✅ Done                        |
| 5 — Curated library                     | ✅ Done                        |
| 6 — Load, readiness, why                | ✅ Done                        |
| 7 — Finding your way in                 | ✅ Done                        |
| 8 — Coach, rating, game, premium        | ✅ Done                        |
| 9 — Making it feel alive                | ✅ Done                        |
| 10 — Off-court training, strokes, integrity | ✅ Done |
| 11 — The game you play, at your level | ✅ Done |
| 12 — The workouts, for the room you have | ✅ Done |
| 13 — Making it testable by other people | ✅ Done |
| 14 — Calling in the players' own language | ✅ Done |
| 15 — Choosing the voice that calls | ✅ Done |
| 16 — Training where the browser fights you | ✅ Done |
| **17 — Playing the app as a player** | ✅ **Done — ready for review** |

All seventeen phases are built. `npm run verify` is green: 0 type errors, 0 lint
errors/warnings, 634 unit tests passing, production build clean.

Earlier phases, one line each — the detail is in the git history:

- **1** — the timer engine, court board, audio-first cue layer and offline PWA.
- **2** — Supabase auth with local-to-account migration, the derived progress
  dashboard, and the B-ENDURANCE-style benchmark.
- **3** — conditioning circuits on the same engine, an eleven-exercise
  catalogue, and drawn demos.
- **4** — the periodiser, four built-in programs, and today's session on Train.
- **5** — the technique reference and one filterable library over everything.


---

## Phase 17 — playing the app as a player

Not a feature phase. The whole app was played end to end the way a club player
would — a first visit, the introduction, the questionnaire, the catalogue, a
drill set up and run and logged and rated — with a screenshot at every step,
and then swept mechanically across seventeen routes at three widths.

### What held

- **Every number the app shows a player is the number it runs.** Every drill,
  at every level, card estimate against what `buildTimeline` actually builds:
  no drift anywhere. That was the bug class most likely to be hiding here, and
  it is not.
- No console or page errors anywhere in the journey, or on any route.
- No horizontal overflow, no element covered by the sticky footer or the bottom
  nav, no link without a name, no image without alt text — at 320, 390 and 768.

### What did not

**The app told every player they had chosen a pace it chose for them.** The
level factors in `lib/training/profile` *scale* a drill's numbers, so a fitted
drill matches no named preset — and the setup screen had only two states, a
preset or "Custom · your own pace". Measured: at beginner **16 of 16** call
drills read as Custom, at advanced 16 of 16, at intermediate 11 of 16. So the
screen was lying to essentially everybody, and hiding the useful fact — that
this is what your level asks for.

There is now a third state. "Your level", with the actual pace on it, an
explanation underneath, and — because it is always offered rather than only
when selected — a way back after trying a preset, which did not exist before.

**The library listed the same exercise twice.** "Plank shoulder taps" appeared
as both `core-plank-reach` and `str-shoulder-tap`, added in different phases,
same movement, two different write-ups. The front-view one was deleted (a plank
has to be drawn edge-on) and its references repointed. "High knees" was also
there twice — but those are genuinely two exercises, one through an agility
ladder and one on the spot, so they are now named for the difference, which is
the only thing a player training at home needs to know from a list.

**Three workout cards asked for the same kit twice** — "skipping rope
(optional)" next to "skipping rope", "agility ladder (or tape)" next to "agility
ladder". `factsFor` was merging the drill's own wording with a derived label for
the same item. The derived label is now a fallback only, so the drill's wording
survives: "(optional)" and "(or tape)" are the words that decide whether
somebody without the kit can do the workout at all.

**The workouts filters were 34px tall.** They are the whole point of that
screen and they get tapped mid-workout with a shaking hand. Now 40.

### Not bugs, checked and dismissed

The duplicated "Week of 22 Jun: 0 sessions" on Progress is the chart's
screen-reader text and correctly `sr-only`. The repeated "Assumes court access"
on Programs is once per program, not three times on one card. "Needs a few
strides" on eleven workout cards is a per-card fact and a filter, not a repeated
sentence.

### Verified

`npm run verify`: 634 tests across 39 files, no type or lint errors, clean
build — eight new, covering the three setup-screen states, kit never named
twice while a drill that forgot its kit still gets a label, no two exercises
sharing a name, and every circuit step resolving to an exercise that exists.

Then re-driven in the browser: seventeen routes at three widths with no errors,
overflow or overlap; the library with no duplicate name and both high-knees
distinguishable; the kit chip in the drill's own words; and the pace reading
"Your level · 1.15s" for an advanced player, with picking a preset and coming
back both working.

---

## Phase 16 — training where the browser fights you

Two of this app's own promises had never actually been tested: that it works
offline, and that it degrades rather than breaking when a browser refuses to
store anything. So both were driven in a real browser rather than reasoned
about.

### Offline: the promise held

One online visit, then the connection cut. The app precached itself, cold-reloaded
with no network, every screen rendered, a full drill ran, the session was logged,
and it was still there after another offline reload — with no console errors
anywhere. Nothing to fix; now it is a thing that was checked rather than a thing
that was claimed.

### Storage refused: three real bugs

The other promise did not hold. With a browser that lets `localStorage` exist
and throws on every call — iOS Private Browsing, "block all cookies", and the
in-app browsers inside Messenger and Facebook — every screen degraded politely
**except the drill runner**, the only one that matters. And an in-app browser is
not an edge case: it is how somebody opens a link a friend sent them, which is
exactly how every tester of this app will arrive.

1. **The runner crashed to the error boundary.** `zustand/persist` guards
   *getting* the storage object but not the calls on it, and the runner writes a
   cue preference as it mounts. All six persisted stores now go through
   `store/persistStorage`, which wraps every call the way
   `lib/data/local/storage` already wrapped the session history. A refusal now
   means settings do not survive a reload — a disappointment. It used to mean no
   training at all — a broken app.

2. **Finishing a drill dead-ended on "Session not found".** The local session
   repository ignored whether the write succeeded and handed back an id that
   resolved to nothing, so the runner navigated to a summary for a session that
   was never stored. That is the worst possible answer to forty minutes of work.
   A refused write is now an error, which the runner's existing catch already
   knew what to do with.

3. **And then the app greeted them as a brand-new user.** Landing back on the
   home screen fired the first-run redirect — because with nothing stored there
   is no profile, no session and no "seen it" flag, so every condition stays
   true for ever and the introduction would have appeared on *every single
   visit*. `shouldSeeWelcome` now returns false when storage is unwritable,
   which is the module's own premise: a first-run screen that reappears is far
   worse than none at all. The introduction stays reachable from the profile,
   where it ambushes nobody.

### Saying so, rather than lying quietly

The Profile card said "Saved in this browser. Clearing your browser data would
erase it." to somebody for whom nothing was being saved at all — the kind of
lie you discover after a month of training. `isStorageWritable()` probes with a
real write and delete, because `localStorage` *exists* and answers in all of
these browsers and only refuses when you store something.

`components/StorageWarning` renders on Train and Profile and draws nothing at
all for almost everybody. For the rest it is the difference between finding out
now and finding out later:

> **This browser will not let RallyReady save anything.** You can train, and
> every call still works — but your sessions, streak and settings will be gone
> when you close this tab. Open RallyReady in Safari or Chrome to keep them.

### Verified

`npm run verify`: 626 tests across 39 files, no type or lint errors, clean
build. Ten are new — the guarded storage adapter under refusal and under quota,
the probe leaving nothing behind, and the first-run rule.

Then the browser audit, 12 checks, all passing: precache, offline cold start,
all fifteen routes offline, an offline drill logged and surviving a reload; then
with storage refused, all fifteen routes again, a drill started and run,
finishing landing on Train rather than a dead end or the welcome, and both
screens telling the truth about what is being kept.

---

## Phase 15 — choosing the voice that calls

A sweep for exports nothing imports turned up the one that mattered: the
settings screen had been storing a chosen voice as `voiceUri` since the app
shipped, and **nothing had ever read it**. `setPreferredVoice` — the only
function that would have applied it — had no callers at all. Every session this
app has ever spoken used the browser's automatic pick.

That was worth fixing on its own, and Phase 14 made it urgent: when there is no
Filipino voice the calls are respelled for an English one, and *which* English
voice reads "kah-lee-wah" is the difference between a call you can act on and a
noise. A player has to be able to change it, and to hear the change.

### What the voice preference is now

- **Per language.** Which Filipino voice speaks a native call and which English
  voice reads a respelling are separate decisions, and switching the call
  language back and forth keeps both. `voiceUri: string | null` became
  `voiceUris: Partial<Record<CallLanguage, string | null>>`.
- **Carried with the call.** It lives in `SpeakOptions` rather than in a
  module-level global set out of band, because the out-of-band version is
  exactly what went unwired and stayed unwired.
- **Local voices first.** A network voice fetches its audio for every call: it
  arrives late, which in a drill is the same as arriving wrong, and it does not
  work offline at all in an app whose whole point is that it does. They sort
  last and are labelled "needs a connection".
- **Never a dead end.** A stored voice this device no longer has — an
  uninstalled language pack, a new phone, a different browser — falls through to
  the automatic pick rather than silencing the drill.

The picker only appears when there is more than one voice to choose between,
and the **Hear a call** button beside it plays a real call through the current
choice.

### The other dead thing

`selectCuePreferences` existed to hand a screen the cue preferences and nothing
called it: the drill runner and the benchmark each copied the store out field by
field instead. That is why adding `callLanguage` in Phase 14 meant editing three
files, and why the type checker had to catch the third. Both now build on the
selector and override only what they genuinely differ on — the benchmark turns
the metronome off, because a test of your own pacing must not be paced.

`whenVoicesReady` went too, replaced by `subscribeVoices` + `voicesSnapshot`
feeding `useSyncExternalStore`. The voice list is external mutable state that
changes without React's knowledge, which is what that hook is for; the snapshot
holds its array identity until the voices actually change, because returning a
fresh array from `getVoices()` on every render loops forever.

### Verified

`npm run verify`: 616 tests across 38 files, no type or lint errors, clean
build. Thirteen are new and cover the parts that are easy to get quietly wrong —
local-before-network ordering, `fil` and `tl` both resolving, a stale stored URI
falling back rather than going silent, the respelled path using the *English*
choice and an English tag, `speak` cancelling before it speaks, and the snapshot
keeping its identity.

Then driven in a browser against five stubbed voices — 17 checks, all passing:

- the picker offers only voices that can speak the call, network ones last and
  labelled;
- picking one and pressing **Hear a call** speaks through it;
- switching the call language swaps the list, and switching back remembers the
  earlier choice — both are stored side by side;
- with no Filipino voice it offers the English voice that will read the
  respelling, and reads `lee-kod kah-lee-wah` with it;
- a real 22-second drill run used the chosen voice for all 8 calls;
- a v2 store migrates to v3 keeping its tone volume and language, with the dead
  `voiceUri` dropped rather than carried across — it named no language and had
  never been used, so there was nothing to preserve;
- no sideways scroll at 320px, and a 44px-tall select.

---

## Phase 14 — calling in the players' own language

Most of the people this app is for are Filipino, and the app called every
corner in English. On a court in Manila a coach does not shout "rear left" —
they shout "likod kaliwa", and then, in the same breath, "smash". Taglish is
not a translation of the call; it *is* the call.

### What is translated, and what deliberately is not

`lib/audio/language` owns the whole vocabulary and the reasoning sits in the
file, because the temptation to "finish the job" later is the thing most likely
to break it:

- **Corners** — translated. This is the call: the one thing you hear a hundred
  times a session and the only one you have to act on.
- **Zone numbers** — translated, so Number mode does not count in English
  inside a Filipino call.
- **Phase words** — translated. "Pahinga" is what you are told when a rest
  starts. "Warm up" and "cool down" stay as they are, because that is what
  Filipino coaches say.
- **Shots** — left in English. Nobody has ever shouted a Tagalog word for a
  smash, and inventing one would produce a call no player has heard.
- **Exercise names** — left in English. "Push up", "plank" and "burpee" are the
  words used in a Filipino gym; translating them would make a cue into a
  puzzle.
- **The interface** — left in English, for now. It is read sitting down with
  time to think, which is the opposite of a call. If that turns out to be
  wrong it is a separate and much larger piece of work.

### The phone that has no Filipino voice

This is the part that decides whether the feature is real. Android usually ships
`fil-PH` (sometimes tagged `tl-PH`); **iOS has no Filipino voice at all**, and
plenty of desktop browsers do not either. Falling back to English calls would
have quietly taken the feature away from a large share of the phones it was
built for.

So every phrase is written twice: natively, and **respelled for an English
voice**. "kaliwa" read by an English engine comes out "kal-EYE-wuh";
"kah-lee-wah" comes out right. When a real Filipino voice exists the app uses
the real spelling and tags the utterance `fil-PH`; when it does not, it uses the
respelling through the English voice and tags it `en-US` — because the
respelling *is* English spelling, and telling a Filipino engine otherwise would
have it read the hyphens.

The settings screen says which of the two is happening on your device, in
those words, next to a **Hear a call** button. A note claiming the fallback
sounds fine is worth nothing; the button lets you judge it by ear before you
commit to it.

### The call got longer, so the slot had to

"harap kaliwa" is five syllables where "net left" is two. Speech *cancels*
rather than queues, so a slot shorter than the phrase does not delay the call —
it amputates it, and half a corner name is worse than none. `minIntervalFor`
now scales both floors by the language: 800ms → 1000ms for a corner call,
1200ms → 1500ms when the call also names a shot. English is a factor of exactly
1, and a test asserts it, so no English session moved by a millisecond.

The language reaches the drill through `TrainingProfile`, alongside level and
game, because it changes the shape of a session rather than just its sound —
which means every screen that already fits a drill to the player agrees with
what will actually run. **A shared challenge passes no language at all**, so it
reconstructs at the English floor for both players and stays the same session
whatever either of them has their calls set to.

### Verified

`npm run verify`: 603 tests across 37 files, no type or lint errors, clean
build — 25 of them new, covering the vocabulary, the respellings, the voice-tag
matching (`fil`, `tl`, `fil_PH`, and *not* `enm` or `tlh`) and the interval
floors.

Then driven in a real browser against a stubbed voice list, because what the
app *says* is not something a unit test can see:

- with a Filipino voice, the drill speaks `harap kanan` tagged `fil-PH` through
  the Filipino voice;
- with only an English one, it speaks `lee-kod kah-lee-wah` tagged `en-US`
  through the English voice, rather than going silent;
- a 24-second run produced 9 utterances with nothing slipping out in English;
- an install that never touched the setting still says "net right", "rear
  left", "warm up" — byte for byte what it said before;
- a version-1 cue store keeps its tone volume, voice rate, split-step lead and
  haptics across the version bump (the `migrate` passthrough — zustand discards
  persisted state on a version mismatch without one);
- the picker fits a 320px screen with no sideways scroll and a 115×76 tap
  target.

### Known limits, stated plainly

The respelled fallback is an approximation tuned by ear on an English engine,
not a phonetic transcription, and it will sound like an accent. It has not been
heard by a native speaker on a real iPhone — that is the first thing worth
checking with a tester.

---

## Phase 13 — making it testable by other people

Twelve phases in, exactly one person had ever used this app. Every decision
about what is confusing, what is boring and whether the rally patterns land was
a guess, and there was no way for it to stop being one: the app had no feedback
path at all, and everything a tester does lives in their own browser's local
storage where nobody else can see it.

There is no server to post to and no analytics here, which is a constraint
worth keeping rather than working around. So a report is *text*: built by
`lib/feedback/report`, handed to the share sheet, and on the phone of the
players this is aimed at that means Messenger — the app they already have open.
Copy and download are the fallbacks for a desktop browser, and one of the three
always works.

Plain text rather than JSON on purpose. A person reads this in a chat window
and decides whether to send it; a blob of JSON is something you forward without
reading, which is the wrong instinct to encourage when it may carry someone's
training history. The complaint leads, the diagnostics are the footnote, and
the report states on its face what it contains.

It carries enough to reproduce a bug — the screen, the build, the level and
discipline, the viewport, how many sessions they have actually logged, because
an opinion after one go is a different opinion from one after twenty — and
nothing that identifies anybody. The training history is attached only if the
tester switches it on, with the contents written next to the switch.

Two entry points: the profile screen, and one quiet line at the very bottom of
the session summary, where an opinion about a session is sharpest. Not a
prompt — somebody who has just finished training does not want to be
interviewed about it.

The build version is stamped into the bundle for this, because testers are on
whatever the service worker last handed them rather than on what is deployed,
and "it does not do that on mine" is unanswerable without it.

### Verified

- `npm run verify`: 578 tests across 36 files.
- The dialog driven end to end in a browser: the report reads correctly, the
  history attaches only when asked, and with six sessions in it the whole thing
  is 2.4 KB — small enough to paste into a chat.

---

## Phase 12 — the workouts, for the room you have

The catalogue grew out of court drills, so the conditioning in it was
court-shaped too: reachable only as a tab beside the drills, and listed by name
and duration. That answers the wrong question first. Most people using this app
are in a bedroom or a garage, and what they need to know before anything else is
whether a session fits the floor they have and whether it will wake the house.

**Space and noise are first-class now.** Every exercise declares the floor it
needs — `spot` is the area of a towel, `room` is a few strides, `court` is a
court — and whether it lands hard enough for the flat below to hear. A workout
*derives* both from the exercises it contains rather than carrying a label
somebody has to remember to update: a circuit is as loud as its loudest
movement and needs as much room as its largest. A drill with no circuit calls
corners, which means strides and landings, so it is never "fits a towel, quiet"
— the first version of that fallback had four minutes of Tabata jumping
advertised as the neighbour-friendly option.

`/workouts` is the one place they are all listed, grouped by purpose, with both
facts on every card and both as filters. With both switched on a player is
still offered four real sessions rather than an empty screen, which is the case
the screen exists for.

**Eleven exercises** the published home lists are all built from and this one
had almost none of: jumping jacks, high knees, mountain climbers, burpees,
shuttle runs, skipping. Plus the gap that mattered more — badminton's signature
injury is the shoulder and there was nothing here for it: prone Y raises, plank
shoulder taps, single-leg balance, hip hinge, single-leg bridges.

**Five workouts**: Home Full Body, Explosive Power, Shoulder Care, Quiet Room
Workout, Skipping Intervals. The work-to-rest shape is the one the published
programmes use — roughly 20s on / 10s off at beginner through to 40s on / 10s
off — which is what the level scaling was already built to do.

Every new pose was rendered to a contact sheet and looked at. Two were wrong:
the burpee and the shuttle-run touch both had the hands up behind the back
instead of on the floor, because an arm angle is degrees from straight *down*
rather than from the leaned torso.

### Verified

- `npm run verify`: 569 tests across 35 files.
- 162 route/viewport/theme combinations including a 320px phone: no console or
  page errors, nothing scrolls sideways.
- The filters exercised in a browser: small room plus quiet leaves Foundation
  Strength, Smash Core, Shoulder Care and the Quiet Room Workout.

---

## Phase 11 — the game you play, at the level you play it

Prompted by watching real players train. What separates them is not that they
chase corners faster, it is that they rehearse *points*: the shot that wins a
rally is usually two shots after the one that decided it, and random calling
cannot teach that because it has no memory of what you just played.

**Rally patterns.** `lib/timer/patterns` holds twelve named sequences of
corner-plus-shot drawn from how rallies are built — smash and follow in, lift
and get level, block and steal the net, hold and slice. `pattern` selection
walks one and then picks another, never the same twice running. The shot comes
from the pattern rather than being drawn at build time, because in a rally the
shot is the reason for the corner rather than a decoration on it. Every shot is
legal for the part of the court it is called from and inside its own level.

**A vocabulary that opens up.** Eight more strokes — slice, kill, cross net,
hold drop, punch clear, jump smash, tumble, flick — each carrying the level at
which it starts being worth calling.

**Level and game finally do something.** Onboarding had asked for both since
Phase 2 and they steered one recommendation. `lib/training/profile` turns them
into the volume, the vocabulary and the zone weights. The same drill at
beginner is 4 rounds of 38s with 47s rest and a call every 1.9s; at advanced it
is 8 rounds of 52s with 25s rest and a call every 1.4s — fewer rounds and
*slower* calls for a beginner, because the thing being trained is arriving
properly.

Six defects followed, all found by hunting rather than by the test suite.
Opening a drill's setup screen wrote an override, and an override beats the
defaults for ever, so the drill silently stopped following the level. The
warm-up inherited the whole config and ran rally patterns — ninety seconds of
"hold, drop" under the word WARM-UP. Speech cancels the previous utterance, so
a slot shorter than the phrase chopped a four-word call in half. The court
picker was a control that did nothing in pattern mode. Challenges sent the
wrong session, because level decides the vocabulary and the code did not carry
it. And a flex item's default `min-width: auto` pushed the level control wider
than a 320px phone.

---

## Phase 10 — the other half of a session

Came from watching a real club train. Between court reps the players were on
the floor doing push-ups, planks and lunges, and half of what the coach shouted
was the *shot*, not the corner. Neither was in the app.

### Strength, and a renderer that can draw it

The catalogue had twenty-eight exercises and almost no strength in it: four
ladder patterns, five jumps, sixteen mobility and stretching drills, and for
actual bodyweight work one lunge and one plank. The reason was technical. The
figure renderer draws an upright skeleton — limbs rotating from a standing body
— so anything performed on the floor could not be drawn, and the catalogue
quietly drifted towards things you do standing up.

`MobilityPose.ground` now tips the whole body over, applied after every joint
so limb angles stay relative to the torso: `armL: 90` is "arm perpendicular to
the body" whether you are standing with it raised or lying on it in a plank.
Grounding was widened to match — it used to consider only feet and knees, which
is right for everything upright and wrong for a push-up, which is held on the
hands.

Fourteen exercises follow, chosen for badminton rather than for a gym: the
lunge is the sport, so single-leg work outranks two-legged; the smash is a
rotation, so the core work is anti-rotation rather than sit-ups; landing from a
jump smash is what wrecks ankles, so the calves get a slot of their own. Every
one has form cues, the common faults and a substitute, because "do fewer" is
not a scaling strategy.

Four of them shipped at first with **no diagram at all**. A glute bridge, a
superman, a seated twist and a side plank are each defined by a side-view
silhouette, and the renderer drew a front view; every attempt came out as a
person folded over backwards. Every pose was rendered to a contact sheet and
looked at — the only way figure defects here have ever been found — which is
how the four were identified in the first place.

They are drawn now. The mirroring in `step` is what made the renderer a front
view: left limbs get `side: -1` and right limbs `+1`, so a symmetric pair of
angles splays them apart instead of moving them together. `MobilityPose.profile`
turns that off, both limbs take the same side, and every angle becomes "degrees
forward from straight down" — which is how a side-view pose gets described out
loud anyway. The few pixels that keep the far limb from hiding exactly behind
the near one moved out of the shoulder width and into a screen-space stagger
applied after the body is tipped over: as a shoulder width it rotated with
everything else, so a figure on its back stood one foot on the floor and held
the other four pixels above it.

Drawing the floor exercises exposed a second thing: every figure was drawn in a
canvas sized for somebody standing up, so a push-up occupied the bottom third
of its card and the rest was white. The box is now cropped to what the sequence
actually uses — including the blends, because a limb swinging from one side to
the other passes through straight up, higher than either end of the movement.
The pose label shrinks by the same factor, so cropping the drawing does not
also blow the caption up. An overhead clear turned out to have been swinging
its racket a couple of units past the top of the fixed canvas all along.

What a side view still cannot show is a rotation about the axis you are looking
down, which is the seated twist. Its two frames draw the projection of that
rotation instead — hands travelling from in front of the chest to beside the
hip and back — because turning either way projects to the same place, and the
seat is the half people get wrong anyway.

Three workouts use them, under a new Strength category and focus area.

### The shot, not just the corner

Every drill called a place and you moved to it. That is half of what a coach
shouts; the other half is the shot, because where you go and what you play once
you arrive are separate decisions and the second changes the whole movement.

Strokes mode calls both — "rear left, smash", corner first because you start
moving before the second word lands. Which shots are legal from where is
encoded rather than left to chance: net gets net shots, lifts and pushes; mid
gets drives, blocks and pushes; rear gets clears, drops and smashes. A caller
that asks for a smash while you are standing at the net has not added variety,
it has told you it does not know the game.

The shot is chosen when the timeline is built, from the same seeded generator
the corners come from — a challenge has to replay the same shots as well as the
same corners or two people are doing different sessions under one name. Feints
stay silent about the shot, because a fake that named a stroke would give
itself away every time.

### What "premium" actually owes you

Buying three months of coaching is buying a *block* — twelve weeks with
sessions in them — and until now the app modelled that as a boolean and an
expiry date.

`lib/premium/commitment` records what was bought and derives delivery from
sessions that were actually logged. The account it produces is deliberately
two-sided: weeks the player fell short are shown, and so are weeks premium did
not cover. The second kind are **credited back automatically** — added to the
end date without anyone having to notice or ask. It is the only promise in the
app that costs the app something, which is what makes it worth making.

The promises are checked rather than asserted: the card reads them through the
same entitlement function the rest of the app gates on, so it cannot claim a
feature is delivered while the app quietly refuses it. Three guarantees are
written into `entitlements.ts` beside `ALWAYS_FREE`, each enforced by code.

Still no payment provider, and the page still says so above the prices.

### Verified

- `npm run verify`: 521 tests across 32 files.
- 90 route/viewport/theme combinations, including the new screens: no console
  errors, no page errors, nothing scrolls sideways.
- A stroke drill run end to end with speech stubbed: twelve calls, every one
  legal for the zone it came from, none impossible.
- The account screen in three states — on track, behind, and eight weeks
  uncovered with the end date extended to match.

---

## Phase 9 — making it feel alive

Everything worked and nothing felt like anything. The brief was to fix that
without touching what makes it work: audio-first is the product, the timer and
cue layers are latency-sensitive, `prefers-reduced-motion` is honoured
everywhere, and no new dependencies — framer-motion and Tailwind keyframes
only. Five commits, in that order.

### A motion vocabulary

Nine components had hand-rolled their own durations, easings and
reduced-motion ternaries. `lib/motion` now holds four durations, two easings,
two springs and nine shared variants, mirrored into CSS custom properties so a
Tailwind `duration-*` class and a framer transition can agree on what "quick"
means. Both copies carry a comment saying to change the other.

The interesting part is `motionSafe`, which strips every transform from a set
of variants and replaces the timing. Under reduced motion a state change must
still be *visible*, just not moving — so opacity survives and `x`, `y`, `scale`
and `rotate` do not. Two things in there are load-bearing and unobvious, and
both are covered by tests: a variant may be a *function* of its `custom` value,
so the wrapper has to strip the resolved result too or a list keeps its
per-index stagger delay; and the stripped transition is 0.01s rather than 0,
because framer skips its animation loop at zero and `AnimatePresence` then
never fires the exit callback that unmounts the element.

`/design-system` grew a Motion section that plays every variant live. It is
still out of the nav.

### Somewhere to land

A first-time visitor used to arrive on a catalogue of twelve drills. They never
learned what the app was for, never heard it work, and on iOS never performed
the gesture that unlocks the speech and audio the whole product depends on.

`/welcome` is three screens with one idea each, then the four profile questions
that already existed. The middle screen is the one that matters: pressing "Hear
a call" plays a real spoken call, with its real tone and its real buzz, and
that press *is* the audio unlock. It degrades honestly where speech or audio is
unavailable instead of looking broken.

Who sees it is decided by `lib/firstRun`, kept pure and tested: only from `/`,
only with no profile and nothing logged, and only once. The persisted flag is
backed by an in-memory guard, because storage can silently refuse to keep it
and the failure mode there is Skip bouncing you straight back into the
introduction. Deep links are never hijacked — a challenge someone sent you
opens the challenge.

### Per-screen polish

The bottom bar has one marker that travels to the tab you pressed rather than
five independent lights, and a navigating tap gets the shortest buzz the API
can express — gated on the same preference as the drill cues, silent when you
tap the tab you are already on. Pages arrive from the direction you moved in;
that rule lives in `lib/pageDirection` with tests, and the bar builds itself
from the same ordered list so the marker and the pages cannot disagree.

Lists deal themselves out, capped so twelve drills finish arriving in about a
fifth of a second. Cards have give under a press. Loading states are
card-shaped placeholders rather than a line of text everything below lurches
away from. Empty screens are drawn — a shuttle, a half-court, an empty chart —
as inline SVG, because this has to work with no connection.

Two changes on the runner's hot path made it faster rather than prettier: the
active zone grows with a transform instead of an animated radius, and the
player marker lost a `drop-shadow` filter that was repainting the board on
every frame it moved. The dial's sweep is deliberately left alone, and the
reason is written down next to it — the runner already pushes metrics at 30fps,
so a CSS transition there would chase a target that had already moved.

Reflex Rush got the full treatment, since it is the one screen you actually
watch: targets that snap out, a ring fired off whatever you hit, a score and a
clock that pop on change, a bar that turns red in the last five seconds. It
scales rather than resizes, so the game's own animation frame does not share a
thread with a layout pass. The targets are circles now; at 3:4 a percentage
width and a percentage height are different lengths, and they had been eggs
since the day they were written.

### Three moments

Finishing a session, unlocking a badge and extending a streak now look like
something happened. The animation was the easy half. The hard half is not
repeating it: an unlock that fires on every mount is a bug with confetti on it.

`lib/rewards` compares what is earned against a persisted record of what has
already been shown. `useRewards` snapshots that record when the screen opens
and writes the real one immediately — so closing the app mid-burst spends the
moment, which is the right trade, because a reward you can farm by reloading is
not a reward.

The record starts as `null` rather than empty, and that distinction is the
whole migration story: `null` means "never looked", which is what every install
from before this phase looks like, and on `null` the app takes a silent
snapshot. Nobody with nine badges already earned gets nine unlock animations
after updating. A streak is only celebrated when it beats the last one
celebrated, and the recorded number never goes down, so a streak that breaks
and climbs back does not fire five more times.

The confetti is about forty lines of DOM. Every package on npm ships a canvas
renderer and its own animation loop for what is twenty divs on a curve; these
animate transform and opacity, composite, and unmount when they are done.
Pieces are laid out from their index rather than from `Math.random`, so a
re-render cannot reshuffle a burst mid-flight.

Two things fell out of this worth more than the animation. Badges are now
reconciled when a session *ends* rather than the next time somebody opens the
dashboard, because the summary screen runs the same derivation the Progress
screen does. And the end of onboarding stops claiming a badge in small grey
text and actually hands it over.

### A voice and a hierarchy

Typography had drifted into six almost-identical headings. There are two
registers now: loud is tight and heavy, quiet is open and plain, size still
comes from Tailwind. Nine hand-rolled uppercase eyebrows now come from one
class.

Cards got three levels. The card that mattered on a screen used to be made to
matter by pasting the same four gradient classes at the site, sixteen times;
`level="lead"` says it once and gives us somewhere to change what important
looks like.

The setup screen opens with the session drawn to scale. "8 min" never said
whether that was eight minutes of work or four of work and four of standing
still. It is also where the runner's colour language gets introduced — the
ring, the board and the background wash all change hue with the phase, and
until now you met that vocabulary for the first time while already moving.
Built from the real timeline, so the preview and the session cannot drift
apart.

### Verified

- `npm run verify`: 473 tests across 29 files, 0 type errors, 0 lint problems.
- 65 route/viewport/theme combinations in Chromium — 13 routes at 375px and
  1280px, light and dark, plus 375px with `prefers-reduced-motion: reduce`. No
  console errors, no page errors, and nothing scrolls sideways.
- The whole first-run path walked with storage cleared, plus the four ways it
  must *not* fire: a returning player, a reload, a deep link, and a browser
  that refuses to persist the flag.
- The three reward moments fired once each, stayed quiet on reload, and stayed
  quiet entirely for a simulated pre-existing install.
- A drill run to completion with no interaction after Start and
  `speechSynthesis` stubbed: 14 corner calls spoken, "go" at each block, the
  finish announced, 23 buzzes, session logged — identical under reduced motion.
- Frame profile of a live drill, same machine, back to back: 59.8fps before,
  60.0fps after; frames over 33ms went from 2 to 0 in the first run and 1 to 1
  in the second. No regression, marginally fewer drops.
- Bundle: 1,202.04 kB → 1,236.10 kB raw (+34.06 kB), 364.90 → 375.73 kB gzip
  (+10.83 kB). About 2.8%, for a motion system, a first-run flow, the reward
  layer and three SVG illustrations.

### Found while building it

- The Reflex Rush targets were ellipses, not circles: `size-[26%]` on a 3:4
  board makes the height a third larger than the width.
- The premium page pushed a 375px screen 10px sideways. Buttons are
  `whitespace-nowrap`, and "Switch Premium on — 3 months, free preview" is
  longer than a phone. The bundle is named directly above it anyway.
- `speechSynthesis` cannot be assigned to — it is a read-only accessor. The
  eyes-free test needed `Object.defineProperty`.

### Deliberately not done

- **No transition on the dial's `strokeDashoffset`.** Explained above; the
  comment lives in `TimerDial.tsx` so nobody "fixes" it.
- **No animation on a running drill that has to be watched.** The board's only
  changes are the target and the recovery marker, both of which existed before
  and both of which the audio already says out loud.
- **No page-exit animation.** `AnimatePresence mode="wait"` would hold the new
  screen back by the exit duration; a screen that arrives 160ms later to look
  smoother is not smoother.

---

## Phase 8 — a coach, a number, a game, and a price

The feedback was "it is getting boring and plain", twice, and a request for an
algorithm, something social, a mini-game and a premium tier. The boredom
complaint was the real signal: the app had become an excellent set of
instruments and still gave the player nothing to chase.

**The coach decides.** `lib/coach/pick.ts` takes readiness, load status, the
program, the neglected-drill history, the benchmark clock and the level, and
returns one instruction with one reason. Everything it needs already existed —
the player was just being asked to hold all of it in their head and choose.
A coach does not hand you a catalogue. It refuses to train you at all on a
plan's rest day or after two sessions, puts the program ahead of its own
preferences, and drops the retest suggestion on a day it has already told you
to back off.

**A rating that goes up.** 0–1000 from five parts — consistency, volume,
sharpness, engine, range — through six tiers from Newcomer to Machine.
Deliberately hard to farm: consistency is capped by _weeks_, so six sessions in
one day buys nothing that six weeks does, and sharpness measures improvement
against your own earliest sessions so a beginner is not punished for being slow
in absolute terms.

**Reflex Rush.** Thirty seconds, tap the corner that lights up. Fast reads are
worth ten times a slow one, wrong taps cost you, and it is the one thing a solo
player genuinely cannot train against a wall. Kept out of the training
repositories entirely: a streak you can hold by playing a phone game is a streak
that means nothing.

**Challenges, with no server.** The engine has been seed-deterministic since
phase one, which turns out to be the entire feature: a short code carrying a
drill, four settings and a seed reproduces the identical corner order on someone
else's phone, so "beat my score" is a fair contest. Codes use a base-32 alphabet
with no O/0 or I/1, and settings are clamped on the way in — a hand-edited code
must not be able to start a nine-hour drill.

### The premium line, and where it does not fall

Two rules decided it. **Nothing that prevents an injury is ever paywalled** —
the warm-up, the readiness check and the load warning are free for everyone, for
ever, and there is a test that fails the build if one of them turns up in the
paid list. And **the free app has to be good on its own**: every drill, the
whole reference, the benchmark, the game and your full history are free.

Premium buys the judgement on top — being told what to do today and why, the
rating breakdown, every program, and sending challenges. Taking a challenge is
free even though sending one is not, because a social loop that needs both
people to pay is not a loop.

Bundles are ₱99 / ₱199 / ₱599 for one, three and twelve months, against roughly
₱800 for a single coaching session locally.

**No payments are connected, and the page says so above the prices rather than
below them.** The entitlement lives in local storage, which anyone who opens the
devtools can switch on; a real subscription needs a provider and a server that
verifies the receipt. The store is shaped so that is a small change rather than
a rewrite. A screen that looks like a checkout and quietly does nothing is how
you lose someone's trust permanently.

### Found while building it

- The challenge separator was a hyphen, which silently destroyed every code:
  `encodeURIComponent` leaves hyphens alone because they are unreserved, so
  "six-corner-shadow" split into three fields. It is a comma now, chosen
  specifically because the escaping removes it from the values.
- The game's first timing loop scheduled itself with `setTimeout` recursion and
  read a ref during render. Rewritten as a single animation frame asking "what
  should be on screen now?" — simpler, and impossible to leak timers.
- `Date.now()` in a React render is impure. The benchmark clock moved into
  `pickToday`, where the reference time is an injectable parameter.

---

## Phase 7 — finding your way in

A badminton coach and varsity player was handed the app and said, in Tagalog,
the most useful thing anyone has said about it: put it in categories. If a
player wants to improve their agility they should tap Agility and be shown the
drills that do that. Separate beginner from intermediate and advanced. And for
beginners, the basics — how to hold the racket, the backhand grip, the swing of
a smash, proper footwork — **with pictures**.

He was right on every count, and the two gaps he found were real.

**A flat catalogue only helps someone who already knows the answer.** Twelve
drills in a list is useful if you know that a six-corner shadow drill is the
thing that fixes your movement. Nobody new knows that. What a player does know
is what they want to be better at — so Train now opens with eight goals in the
player's own words ("I want to be quicker", "I want to last three games"), each
mapped onto the categories the catalogue already carried. The flat list is still
there underneath, as "or browse everything".

**Levels are now a filter, not a badge.** A beginner sees beginner material by
default and can move the level up whenever they like. Nothing is ever locked —
a hidden count says how much more is there, because permanently hiding things
from someone is its own kind of insult. Power is the one area that can be empty
for a beginner, deliberately: plyometrics punish cold, untrained legs, which is
why the periodiser keeps them out of base weeks too. The card reads "for later"
rather than "nothing", which is the truth.

**The basics, drawn.** Six new topics — the forehand grip, the backhand grip,
the ready stance, the overhead clear, the smash and the low serve — plus three
existing footwork ones, presented as a numbered path in teaching order rather
than alphabetically, because the order _is_ the pedagogy. Every one carries a
diagram the app draws from numbers:

- **Grips** get a racket alongside the handle in cross-section, with the exact
  bevel highlighted. The cross-section alone is how every coaching manual draws
  a grip, and on its own it is an octagon with a squiggle beside it — manuals
  get away with it because there is a photograph on the facing page. The racket
  anchors what you are looking down, and carries a second real instruction
  (hold it low) the cross-section cannot show.
- **Swings** reuse the warm-up skeleton with a racket in hand, and the motion
  arc follows the racket head rather than the wrist.

**A first visit now gets an introduction.** No profile and nothing logged means
a welcome card that says what the app is and offers one obvious first tap. The
recommended drill is withheld until then — "Start here: Six-Corner Shadow,
Intermediate" directly under "never played before?" is two pieces of advice
arguing with each other.

### The figures are testable now

Every defect in these drawings across the whole project has been found by
rendering one and squinting at it: a figure floating above the floor, an arrow
attached to a faded far-side limb, a racket swinging off the canvas. Squinting
does not scale to fifty poses, so the geometry moved out of the component into
`lib/figures/skeleton.ts` and the checks became arithmetic — feet on the floor,
nothing outside the canvas, labels short enough not to clip, a wide stance
actually wider than the hips, and every keyframe visibly different from the one
before it.

It immediately found a bug that had been shipping for weeks. Positive angles
mean "away from the centreline" on both sides, because the renderer does the
mirroring — but the warm-up poses were written `legL: -16, legR: 16`, which
draws a figure leaning to one side with its feet together. Thirty-three angles
across the exercise catalogue were wrong, so **"land wide, low" had been drawn
as a lean** in the split-step figure the user looks at every warm-up. Also
caught: a calf stretch reaching past the edge of its canvas, and three of the
new swings whose frames barely differed.

---

## Phase 6 — the app starts listening

Everything up to here was a very good timer with a very good plan attached. It
still could not tell the difference between a session that wrecked you and one
that did not, and it did not care how you felt when you opened it. Three
changes, in the order they matter.

**Session RPE and training load.** One tap on the summary screen, 1–10, rated
while you can still feel it. Effort × minutes is the standard measure in every
sport for a reason: twelve minutes of Tabata and twelve of technique footwork
are the same number of minutes and nothing like the same session. From that the
app derives the acute:chronic ratio — this week against the last four — which
is the closest thing amateur sport has to an early warning for overuse injury,
and exactly what a solo player has nobody to spot for them.

Two judgement calls in there. The ratio is withheld until three weeks of
history exist, because before that it screams "spike" at everyone who has just
started, and a warning that cries wolf on day two is one people learn to
ignore. And an unrated session counts as a moderate effort rather than being
skipped — dropping it would make a heavy week look light purely because it went
unrated, which is backwards for a safety net.

**The readiness check and auto-regulation.** Sleep, legs, energy; three taps,
no submit button, saved on the third answer. The result plus the load status
produce one instruction, and the player accepts it or ignores it — the app is
allowed an opinion about today, but it does not overrule anyone.

The rule that earns its keep: any single answer at the bottom of its scale
forces "lighter" regardless of the other two. "Slept fine, energy fine, legs
wrecked" averages to a perfectly respectable 50, and is not a day to go and do
repeated lunging. Averaging hides the answer that matters. The reverse
asymmetry is deliberate too — it will back you off on feel alone, but never
push you harder unless the workload figures agree, because a wrong "take it
easy" costs one ordinary session and a wrong "push" costs six weeks.

Accepting an adjustment does not touch the saved drill configuration. It is
applied at the moment the drill starts and expires overnight, so a tired
Tuesday never quietly becomes a drill's new normal. Rounds are trimmed before
work time, because "four instead of six" is a decision you can hold in your
head mid-drill and "42 seconds instead of 60" is just an odd number on a clock.

**Why today.** The Today card now names the block and the let-up — "Base week 3
of 12", "Next week backs off — hold on until then" — derived from the same
periodiser that generated the plan, so it cannot drift out of step with it. The
weeks people quit on are the ugly ones in the middle of a build block, and they
quit because from the inside a twelve-week plan is indistinguishable from an
infinite one.

### Found by looking rather than by testing

- A session you had already rated came back showing no rating. The metrics
  query only starts once the session has loaded, so the rating arrived a render
  after the prompt mounted and `useState(initial)` had already missed it.
  Derived during render instead.
- The load strip said "this week" over a rolling seven-day window while the
  bars directly beneath it were calendar weeks — two different weeks, two
  different numbers, in one card. Relabelled; the rolling window is the correct
  one for a ramp and the field names now say so.
- The load chart's Y axis was sized for two-digit minutes and silently ate the
  leading digit of every three-digit load.
- The check-in asked "How did you sleep? 1 2 3 4 5" with no indication of which
  end was good. Anchor labels now sit under each row, before the first tap
  rather than after it.

---

## After the brief — from testing on a real phone

The first person to actually train with this asked for a warm-up, and was
right: the app explained warming up in the Library and gave you no way to do
one, which is the wrong way round for the only advice in here that prevents an
injury rather than improving a shot.

**A guided warm-up and cool-down.** Three routines — Full (6:25), Quick (3 min)
and a five-minute cool-down — built as circuits on the existing engine, so no
timer work at all. RAMP structure: raise the heart rate, mobilise the joints
badminton punishes in the order it loads them, then two minutes of sharp
court-specific movement. Seventeen new movements across two new exercise kinds.

Every step rests for zero seconds, because the timeline already drops
zero-length rests — a warm-up flows from one movement to the next instead of
stopping to cool you down between them.

**Warm-ups do not log a session.** Logging them would let someone hold a streak
by stretching, and drag the training load and pace charts towards work that was
deliberately easy. The app remembers only _that_ you warmed up, so the prompt
can get out of the way for 45 minutes and then come back.

**Export and import.** Local storage is scoped to one origin in one browser —
we watched a domain change make a whole history unreachable during this build.
One JSON file holds every session, its metrics and every benchmark. Importing
merges rather than replaces, de-duplicating on when a session started rather
than on its id, because ids are assigned by whichever device stored the row and
never match across a backup. Importing the same file twice is a no-op.

**A share card.** The session drawn onto a 1080×1350 canvas in the app's own
palette, handed to `navigator.share` so it reaches Messenger, Facebook and
Instagram through the OS share sheet — no per-platform SDKs, no API keys, and it
works from an installed PWA. Where no share sheet exists it downloads the image
instead, so the button is never a dead end.

### Deliberately not built

- **Push reminders.** iOS only delivers them to an installed PWA, they are
  unreliable across platforms, and a daily nag is very easy to get wrong. A
  training app that annoys you is one you delete.
- **User-authored custom drills.** A large surface for something with little
  daily value next to the twelve that ship.

---

## Phase 5 — what the brief asked for

> _A curated, vetted library of drills and short reference clips from reputable
> coaches and federations. Filter by category, level, solo or partner, court or
> home, and duration. Coaching cues, common faults and recommended reps on every
> entry. One tap to start any entry as a timed drill, pre-configured._

| Item                                 | Status | How                                                                               |
| ------------------------------------ | :----: | --------------------------------------------------------------------------------- |
| One browsable reference              |   ✅   | 33 entries: 10 technique topics, 12 drills, 11 exercises, in one filterable list. |
| Filter by category                   |   ✅   | Only categories that exist are offered, derived from the entries themselves.      |
| Filter by level                      |   ✅   | Beginner / Intermediate / Advanced.                                               |
| Filter by solo or partner            |   ✅   | Everything trains solo except the two topics that honestly need a feeder.         |
| Filter by court or home              |   ✅   | Same `location` tag the drills and programs already use.                          |
| Filter by duration                   |   ✅   | Under 10 / 10–20 / over 20 minutes — run time for a drill, read time for a topic. |
| Cues, faults, recommended reps       |   ✅   | On every entry. Reps were added to the exercise catalogue, where they belong.     |
| One tap to start, pre-configured     |   ✅   | Every drill, and every topic that has a drill training it.                        |
| Short clips from coaches/federations |   ⬜   | Not shipped. The field exists and renders; nothing goes in it. See below.         |

### Built

**One list over three catalogues.** `src/lib/library/entries.ts` derives a
single `LibraryEntry` list from the drills, the exercises and the new technique
topics. Derived rather than copied: a cue fixed on a drill is fixed in the
library on the next render, and the two can never disagree. Pure, so the
filtering is unit-tested (21 tests) and the whole library works offline.

**Ten technique topics.** The split step, base and recovery, chassé versus
crossover, the net lunge, the scissor jump, grips, net play, deception, warming
up and the injuries to avoid, and how to train solo without wasting the time.
Each explains one thing a solo player can act on, names the faults that make it
go wrong, and links to the drills that train it.

**Search that reads the cues.** Searching "knee" finds the net-lunge topic,
whose title does not contain the word but whose cues do. Every word in the query
has to match, so adding a word narrows rather than widens.

**Integrated learning, both directions.** A drill's setup screen now links to
the technique behind it — three topics and a link to the rest — and every
technique topic has a Drill it button that starts the matching drill.

### The one thing not shipped, and why

The brief asks for short reference clips from reputable coaches and federations.
That means vouching for each link: that it resolves, that the channel is who it
claims to be, and that the coaching is sound. From this environment none of that
can be checked — outbound access to YouTube, the BWF, the national federations
and even Wikipedia is blocked by the egress proxy, so a curated list would be a
list of guesses formatted to look vetted. That is worse than none.

So the reference is written instead of linked, and it is the app's own: ten
topics with the same cues-and-faults structure as everything else. The seam for
clips is real rather than hypothetical — `ExternalReference` on a topic and
`videoUrl` on a drill, both rendered with attribution the moment either is
filled in, and a test asserting that nothing currently is. A curator with
network access can populate it without touching a component.

---

## Decisions and their reasons

**Entries are namespaced by kind, not by slug.** `rear-court-scissor` is both a
drill and a technique topic, and would have silently shadowed itself. Ids are
`kind/slug` and the route is `/library/:kind/:slug`, which is also a more
readable URL than a synthetic composite would have been.

**Technique sorts above drills.** The library exists so you can learn the thing
before drilling it; a list that opens with twelve drills buries the teaching
under the training.

**Recommended reps live with the exercise, not the library.** Adding a field to
eleven exercise records is more code than a lookup table in the library module,
and it is the right home: the exercise knows how much of itself to do.

**An exercise is not runnable on its own.** Tuck jumps are a component of a
circuit, not a session, so an exercise entry has cues, a demo and reps but no
Start button. The circuit that contains it is one tap away instead.

**The duration filter measures reading too.** "How long will this take me" is a
fair question about an article as well as a drill, so a topic's reading time
goes through the same buckets rather than being exempt from them.

### Deviations from the brief's data model

None. The library needs no table: it is derived from content already bundled
with the app, and technique topics are reference material like the exercises,
not user data. `drills.video_url` has been in the schema since Phase 0 and is
where a vetted clip would go.

### Fixed while verifying in a browser

- A ladder diagram on a 360px screen filled the entire viewport — the demo is
  1.5× as tall as it is wide and nothing capped its height. It is boxed now.
- The drill setup screen listed six technique topics, because half the
  catalogue touches a four-corner drill somehow. Three, plus a link to the rest.
- Durations read "4 mins" in the library and "4 min" everywhere else.

### Known limitations

- **No vetted clips.** Explained above. Everything else in the library is
  written, drawn or derived, and works offline.
- **The technique topics are text and diagrams.** They convey the what and the
  why well; timing and touch are the parts that genuinely want video.
- **Search is substring matching, not a real index.** Correct and instant across
  33 entries; it would want stemming and ranking at ten times the size.
- **The Supabase path is still unexercised against a live project** — no
  instance to point at here. Fully typed against the schema; the local backend
  is exercised end to end. Phase 6 adds a `readiness_checks` table and a unique
  index on `session_metrics (session_id, metric_key)`; re-running `schema.sql`
  applies both, and it de-duplicates any existing metric rows first so the index
  can build.
- **The load ratio needs three weeks before it says anything.** By design, but
  it does mean a new player sees "Settling in" for most of their first month.

---

## Where this could go next

Nothing in the brief remains. If it were carried on:

1. **Record and review your own swing.** The biggest hole left in solo
   training: nobody ever tells you your overhead is wrong, so a flaw gets
   grooved for six months. Camera, an eight-second clip, quarter-speed playback
   beside the technique checklist, and last month's clip next to this one.
   Needs IndexedDB rather than local storage, a camera permission flow and a
   storage-budget story — its own release, not a bullet point.
2. **Vet and add the clips** from an environment with network access — the seam
   is built and tested.
3. **Session-linked notes**, so a player can record what actually went wrong in
   a session against the fault it matches.
4. **Exercise-level circuit authoring**, the one thing Phase 3 deferred and
   Phase 4 did not pick up: swapping a single exercise inside a circuit.
5. **A wider desktop layout.** The content column caps at `max-w-3xl`, which
   uses under half of a 1440px screen. Real, but nobody trains from a desk.
6. **Real device testing.** Everything has been verified in Chromium at phone
   and desktop widths, but wake lock, vibration and speech behave differently on
   actual iOS and Android hardware.
