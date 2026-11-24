# Decision log

Short architecture decision records: **context → decision → consequences**.
Newest at the bottom. A decision is changed by adding a new record that
supersedes the old one, never by rewriting history.

Status values: **Accepted**, **Proposed** (needs the owner's answer or a
verification step), **Superseded by ADR-xxxx**.

---

## ADR-0001 — A new standalone project, `ride_doctor/`

**Status:** Accepted (2026-11-20)

**Context.** Two existing projects could have hosted this app. `pedalwise_ph`
is not in this repository. `cyclemind_ai/` is, and overlaps in theme (AI coach
+ bike doctor), but is built on opposite foundations: Firebase and online-first,
no code generation, and an LLM that produces the diagnosis.

**Decision.** Create a new Flutter project at `ride_doctor/`, application ID
`com.ridedoctor.app`. Leave `cyclemind_ai/` untouched.

**Consequences.** Ride Doctor's core rules — offline-first, encrypted local
data, a deterministic rule engine that diagnoses — are in place from the first
commit instead of being retrofitted. The cost is no code reuse; nothing in
`cyclemind_ai` was worth carrying over given the different data layer.

---

## ADR-0002 — Material widgets from `material_ui`, not `flutter/material.dart`

**Status:** Accepted (2026-11-20)

**Context.** As of Flutter 3.47 the Material library moved out of the framework
into the `material_ui` package; `package:flutter/material.dart` is deprecated.
Flutter 3.50.1 (our pinned version) scaffolds new apps with `material_ui`, and
`go_router` 18 already depends on it.

**Decision.** Import Material only from `package:material_ui/material_ui.dart`.

**Consequences.**
- No deprecation debt, and no forced migration later.
- The two libraries define *different classes with the same names*. A widget
  from a package that still imports the old library will not see our theme. If
  such a package is ever needed, wrap it in `MaterialUiCompatibilityBridge`.
- `flutter gen-l10n` still generates a `localizationsDelegates` list using the
  old Material delegate, so `lib/app/app.dart` builds the delegate list by hand
  from `GlobalMaterialLocalizations.delegates` (the `material_ui` one).
- Some `flutter_test` helpers look for old-library classes: `tester.pageBack()`
  does not find our back button. Tests tap `find.byType(BackButton)` instead.

---

## ADR-0003 — Add a dependency in the phase that first uses it

**Status:** Accepted (2026-11-20)

**Context.** The spec names about fifteen packages across seven phases. Adding
them all up front would mean most are never exercised by code or tests for
months, while still being able to break the build or conflict on upgrade.

**Decision.** `pubspec.yaml` contains only what the current phase uses. Phase 0:
`material_ui`, `flutter_riverpod`, `riverpod_annotation`, `go_router`, `intl`,
`meta`; dev: `build_runner`, `riverpod_generator`, `very_good_analysis`.
Versions were read from pub.dev on 2026-11-20 and the lockfile is committed.

**Consequences.** Every dependency is covered by tests from the day it arrives.
`freezed`, `drift` and `flutter_secure_storage` join in Phase 1;
`riverpod_lint` is deferred to Phase 1 too, to be added once verified against
the new analyzer-plugin system it now uses.

---

## ADR-0004 — Generated code is not committed

**Status:** Accepted (2026-11-20)

**Context.** `build_runner` produces `*.g.dart` (Riverpod providers; later
freezed models and drift tables) and `gen-l10n` produces
`lib/l10n/generated/`. Generated files can be committed or rebuilt.

**Decision.** Ignore them in git. CI and developers regenerate them.

**Consequences.**
- One source of truth: generated code can never be stale relative to its
  source, and never causes merge conflicts or noisy diffs.
- A fresh clone needs `flutter pub get && dart run build_runner build` before
  `analyze`, `test` or `run` will work. This is documented in `README.md` and
  `CLAUDE.md`, and CI does the same.
- The CI format check runs on `git ls-files '*.dart'`, so it naturally covers
  exactly the files we wrote.

---

## ADR-0005 — Encrypt the database with SQLite3 Multiple Ciphers

**Status:** Accepted (2026-11-23)

**Context.** The spec asks for drift + SQLCipher. The package that used to
provide SQLCipher to Flutter apps, `sqlcipher_flutter_libs`, was marked
end-of-life in February 2026 after `sqlite3` 3.x moved to Dart build hooks.
`sqlite3` now ships three prebuilt variants, chosen in `pubspec.yaml`: plain
SQLite, SQLite3 Multiple Ciphers, and SQLCipher.

**Decision.** `drift` on `sqlite3` 3.x with `source: sqlite3mc` (SQLite3
Multiple Ciphers), not the SQLCipher variant. The key is 256 random bits from
`Random.secure()`, generated on first launch and kept in the platform keystore
through `flutter_secure_storage`.

**Why not the SQLCipher variant.** The package's own documentation lists
sqlite3mc first and notes the SQLCipher build links OpenSSL on Android and
"may include an older SQLite version". sqlite3mc is self-contained. The
security property the spec is after — the file is unreadable without the key —
is the same.

**Proven by tests** (`test/core/database/database_opener_test.dart`,
`test/main_test.dart`): the file has no SQLite header and no plaintext; it
cannot be read without the key; a different key is rejected; a malformed
stored key is refused rather than interpolated into SQL. Because the hook
setting applies to every platform, the unit tests on a developer machine
exercise the same encrypting library the phone uses.

**Consequences.**
- `openEncryptedDatabase` refuses to continue if the loaded SQLite has no
  cipher (`PRAGMA cipher` returns nothing), instead of silently writing plain
  text.
- If the keystore is wiped the data is unrecoverable by design. The app shows
  a startup error with "try again" and "delete local data and start over".
- Android backup is disabled for the app (`allowBackup="false"` plus
  data-extraction rules): a backed-up file could not be opened without the
  key, which is never backed up.
- The build downloads the prebuilt library from the `sqlite3` package's
  GitHub releases, checked against sha256 hashes pinned in the package.

---

## ADR-0006 — Brand palette

**Status:** Accepted (2026-11-23) — the owner chose A, Hi-Vis

**Context.** The spec asks for a clean, sporty, distinctive Material 3 theme,
designed outdoor-first, and for two palette options before committing. Both
candidates are implemented and switchable at Settings → Design preview. A
side-by-side render is in `docs/design/palette-options.png`.

| | A — Hi-Vis | B — Monsoon |
|---|---|---|
| Idea | Asphalt neutrals + the lime of cycling safety gear | Deep teal, calm and clinical |
| For | Strongest sunlight legibility in dark mode; no major cycling app owns this colour (the common ones are orange, red, blue) | Sits far from the yellow→red heat scale, so brand and warnings never compete; suits the "Doctor" name |
| Against | Lime is a neighbour of "caution" yellow; relies on the icon + label every badge already carries | More conventional; teal is common in health apps |

Both pass WCAG AA (4.5:1) for every text/surface pair in light and dark,
enforced by `test/app/theme/contrast_test.dart`. Both use Material's medium
contrast level rather than the indoor-tuned default.

**Recommendation.** A — Hi-Vis. The product's hardest reading condition is a
phone on handlebars in tropical sun, and A is the stronger answer to it.

**Decision.** A — Hi-Vis.

**Consequences.** The second palette, the `PalettePreview` provider and the
switcher were deleted; colours now live in `brand_colors.dart`. The design
preview screen stays as a style guide.

---

## ADR-0007 — Weather provider is a swappable detail

**Status:** Accepted as a constraint (2026-11-20); provider chosen in Phase 3

**Context.** The spec defaults to Open-Meteo, whose free tier is described
there as non-commercial. The owner's intent is a future startup.

**Decision.** All weather access goes through a `WeatherRepository` interface.
Before any monetised release, review Open-Meteo's licence terms and either buy
a commercial plan or switch provider.

**Consequences.** Phase 1's heat-index maths is pure and needs no provider at
all. The licence terms themselves have not been read yet —
`TODO(verify)` in Phase 3, before the client is written.

---

## ADR-0008 — Bundled fonts: Barlow and Barlow Condensed

**Status:** Accepted (2026-11-20)

**Context.** The app is offline-first, shows many numbers, must stay readable
at 200% text scale, and ships long Filipino strings. `google_fonts` downloads
at runtime, which fails with no signal.

**Decision.** Bundle five font files (about 535 KB): Barlow 400/500/600 for
text and Barlow Condensed 600/700 for headings and large numbers. Both are SIL
Open Font License 1.1; the licence files sit beside them in `assets/fonts/`.

**Consequences.** Typography is identical on every device and works offline.
The condensed cut fits more digits per line at a large size and makes long
headings wrap less. Barlow was drawn after highway signage — legibility at a
glance is what it was designed for.

---

## ADR-0009 — CI runs on every push, and proves the Android build

**Status:** Accepted (2026-11-20)

**Context.** The other workflows in this monorepo run on pushes to `main` and
on pull requests. This project's rule is "CI must pass before a phase is marked
done", and phases are built on feature branches without a pull request. The
development environment also has no Android SDK.

**Decision.** `ride-doctor-ci.yml` runs on every push that touches
`ride_doctor/`, on any branch. It has three jobs: verify (format, analyze,
test, coverage thresholds), secret scan, and an Android debug build that
uploads the APK as an artifact.

**Consequences.** Every commit is checked, and the APK artifact is how the app
reaches a real phone without a local Flutter install. The Android job is the
*only* proof the Android project compiles — keep it. Coverage thresholds live
in `tool/check_coverage.dart` (90% for `core/science` and `core/rules`, 70%
overall), written in Dart so it runs the same everywhere.

---

## ADR-0010 — Settings are in memory until the database exists

**Status:** Superseded by ADR-0011 (2026-11-23)

**Context.** Phase 0 needs theme and language switching to prove the theme and
localisation wiring. The spec stores settings in the encrypted `app_settings`
table, which arrives in Phase 1.

**Decision.** `SettingsController` holds `AppSettings` in memory. No
`shared_preferences` stop-gap.

**Consequences.** Choices reset when the app restarts — a known Phase 0 gap. In
return there is no second storage mechanism to migrate away from, and no
unencrypted file on disk. `AppSettings` deliberately uses its own
`AppThemeMode` enum rather than Flutter's `ThemeMode`, so it is ready to be
stored and exported without a UI dependency.

---

## ADR-0011 — Settings persist in the encrypted database

**Status:** Accepted (2026-11-23). Supersedes ADR-0010.

**Context.** The `app_settings` table now exists.

**Decision.** `SettingsController` starts from the defaults so the first frame
can be painted, then swaps in the stored settings. A change the rider makes
before that load finishes is never overwritten by it.

**Consequences.** One storage mechanism, encrypted like everything else.
There is a brief moment at launch where the theme can be the default before
the stored one applies.

---

## ADR-0012 — Every result explains itself (`Explained<T>`)

**Status:** Accepted (2026-11-23)

**Context.** The spec requires each number to show a confidence level and a
"Why?" sheet with inputs, formula and source.

**Decision.** No science function returns a bare number. Each returns an
`Explained<T>`: the value, a `Confidence`, the `Formula` that made it, the
inputs, and the `Improvement`s that would raise its confidence. The science
layer holds only enums; the UI maps them to translated text with exhaustive
`switch`es, and `sources.dart` maps each formula to its citation and how far
that citation has been checked.

**Consequences.** A "Why?" sheet is built from the value it explains, so the
two cannot drift apart. Adding a formula without an explanation in both
languages is a compile error, not a blank sheet. The app tells the rider
whether a source was actually checked — more honest than most apps, and it
means unverified numbers cannot quietly pass as settled.

---

## ADR-0013 — Our own readiness questions, not the PAR-Q+

**Status:** Accepted (2026-11-23); wording needs medical review before release

**Context.** The spec asks for a "PAR-Q+ style" check. Summaries of the
PAR-Q+ terms say it must be used whole and unchanged, needs a commercial
licence for for-profit use, and may not be built into electronic tools without
written consent (docs/SCIENCE.md, "Readiness check").

**Decision.** Seven plain-language questions of our own, on the same topics.
The feature is called "Readiness check" and never claims to be the PAR-Q+.

**Consequences.** No dependency on someone else's licence. The questions carry
no validation of their own, so they are a prompt to seek advice and nothing
more: any "yes" recommends seeing a doctor, never blocks, never diagnoses.
Answers are stored with a questionnaire version so rewording stays traceable.

---

## ADR-0014 — Nothing is stored before consent, and onboarding saves atomically

**Status:** Accepted (2026-11-23)

**Context.** Health and body data are sensitive personal information.

**Decision.** Onboarding answers live only in widget memory until the last
step. `OnboardingSaver` then writes consents, profile, screening and bike in
one transaction, consents first, and throws if health-data consent is missing.
Consent history is append-only: a withdrawal is a new row, never an edit.

**Consequences.** A crash mid-save cannot leave a profile without a consent on
record. Health consent has no off switch while data exists — withdrawing it is
"Delete everything". Location and notification choices are recorded now; the
operating-system permission prompts come in Phase 3, in context, when a
feature first needs them.

---

## ADR-0015 — Location is asked for in Phase 3, not onboarding

**Status:** Accepted (2026-11-23). A deliberate deviation from the spec.

**Context.** The spec marks city/location as an onboarding essential. Nothing
in Phase 1 uses it; weather arrives in Phase 3.

**Decision.** Onboarding records the rider's *consent choice* for location but
does not request the permission or a position.

**Consequences.** We do not hold a location we have no use for (data
minimisation), and no location plugin is added before it is exercised
(ADR-0003). Onboarding is shorter. Phase 3 must ask in context.

---

## ADR-0016 — "Delete everything" wipes rows; the reset path destroys the file

**Status:** Accepted (2026-11-23)

**Decision.** From Privacy, "Delete everything" deletes every row with
`PRAGMA secure_delete = ON` (deleted content is overwritten, not left in free
pages) and the app returns to onboarding. The startup-error "start over" path
deletes the database file and the key.

**Consequences.** The normal path needs no app restart and is fully covered by
widget tests. It keeps the same key; the file-destroying path, which rotates
it, is used only when the file cannot be opened at all.

---

## ADR-0017 — Export is JSON to the clipboard, for now

**Status:** Accepted (2026-11-23); to revisit

**Decision.** "Export my data" reads every table generically and shows the
JSON with a copy button.

**Consequences.** No file or share plugin yet (ADR-0003), and a table added in
a later phase is exported automatically. The cost: a clipboard is a weak place
for sensitive data, and other apps may read it. A save-to-file flow should
replace it before release.

---

## ADR-0018 — Forms are never built inside lazy lists

**Status:** Accepted (2026-11-23)

**Context.** A `ListView` builds only the rows near the viewport. A form field
scrolled off screen does not exist, so `Form.validate()` skips it — an invalid
value could be saved. Found when the editor tests failed to find off-screen
fields.

**Decision.** Screens containing a `Form` use `ScrollingColumn` (a
`SingleChildScrollView` + `Column`). "Label ... value" lines use `LabelValue`
(a `Wrap`), which drops the value to the next line at large text sizes instead
of overflowing like a `Row`.

**Consequences.** Every field is always validated. Accessibility tests lay
each screen out on a very tall, phone-width surface so that every row is built
and any overflow is caught, in both languages at 200% text.

---

## ADR-0019 — Screenshots are rendered by tests, for review only

**Status:** Accepted (2026-11-23)

**Context.** The development environment has no Android device or emulator,
and the app can no longer be built for the web (native encrypted SQLite).

**Decision.** `test/screenshots/` renders real screens to PNG with the real
fonts, on demand. The images are git-ignored and are not compared in CI.

**Consequences.** The UI can be looked at without a phone. It already caught
three things tests did not: the debug ribbon covering a button, a disabled
switch that read as "off", and two awkward labels. Pixel-comparison gating was
rejected: it fails on harmless rendering differences between machines.

---

## ADR-0020 — A race start is a wall-clock time, with no time zone

**Status:** Accepted (2026-11-23)

**Context.** drift stores `DateTime` values as UTC instants. A race start is
not an instant in the rider's head: it is "6:30 on the 14th, at the race".

**Decision.** `race_events.starts_at_local` is text like
`2027-03-14T06:30:00.000`, with no zone marker, and is compared with the
phone's local clock.

**Consequences.** A 6:30 start stays 6:30 if the phone's zone changes or the
rider travels. It is wrong only for a rider looking at a race in another zone
before travelling there, where the countdown can be off by the zone
difference. ISO text also sorts chronologically, so the database orders races
without parsing.

---

## ADR-0021 — No ICU plurals for exact counts

**Status:** Accepted (2026-11-23)

**Context.** "In N days" was first written as an ICU plural:
`=0{Today} =1{Tomorrow} other{In N days}`. In Filipino it showed "Bukas"
(tomorrow) for a race five days away. Plural categories are grammatical, not
numeric, and Flutter maps `=1` onto the language's "one" category — which in
Filipino covers 1, 2, 3, 5, 7, 8 and more.

**Decision.** Exact cases (today, tomorrow, yesterday) are chosen in Dart with
a `switch`; the ARB files hold only plain messages.

**Consequences.** Correct in every language without knowing each one's plural
rules. `test/features/race_prep/race_text_test.dart` checks every count from
2 to 400 in both languages. Use an ICU plural only for genuine grammatical
agreement, never to mean "exactly one".

---

## ADR-0022 — Keep the shape of a form's widget list stable

**Status:** Accepted (2026-11-23). Extends ADR-0018.

**Context.** On the race form, showing "Choose a date." with
`if (missing) Text(...)` made the start-time field below it lose its own
validation message. Inserting a widget shifts every later sibling by one
position; Flutter matches children by position and type, so the fields below
were destroyed and rebuilt with fresh, error-free state.

**Decision.** Anything shown conditionally above form fields keeps its slot:
`InlineError` for messages (renders nothing when there is none) and
`Visibility` for optional groups of fields. Never `if` in that position.

**Consequences.** Field state survives. The alternative, a `Key` on every
field, also works but has to be remembered for each new field.

---

## ADR-0023 — Every released schema is frozen and its upgrade is tested

**Status:** Accepted (2026-11-23)

**Context.** Phase 2 is the first schema change (version 1 to 2). A wrong
migration destroys data on riders' phones and cannot be taken back.

**Decision.** Each version's schema is exported to `drift_schemas/` as JSON.
`test/generated_migrations/` holds drift's generated snapshots of each
version (committed: they are frozen history, not derived from current code).
`migration_test.dart` upgrades from every old version to every newer one,
checks the result is identical to a fresh install, and checks that a rider
stored under version 1 is still there afterwards.

**Consequences.** Adding a table or column now has a fixed recipe (in
`CLAUDE.md`). The test fails if a step is forgotten; removing one
`createTable` call was tried, and it failed.

---

## ADR-0024 — What Phase 2 leaves to later phases

**Status:** Accepted (2026-11-23)

- **Weather and heat in Race-Day mode** need the forecast, which arrives in
  Phase 3. Until then the Heat check under My Numbers takes manual input.
- **The build and taper phases show dates and one line of advice**, not daily
  sessions. Generating sessions is Phase 3.
- **The debrief is stored, not yet acted on.** It feeds the diagnosis engine
  (Phase 4) and the plan generator (Phase 3).
- **Skills are read, not tracked.** Self-rated skills and a skills plan were
  not added; nothing would use them yet.

---

## ADR-0025 — A web preview that keeps nothing

**Status:** Accepted (2026-11-24)

**Context.** The owner uses an iPhone. An Android APK cannot be installed on
it, and a native iOS build needs a Mac and an Apple developer account. The
only way for the owner to open the app today is in a browser.

**Decision.** The app also builds for the web, as a *preview*. Storage is
chosen at compile time (`core/database/storage/`): the phone gets the
encrypted file; the browser gets the same schema in the tab's memory, using
SQLite compiled to WebAssembly. Nothing is written anywhere, so a reload
starts over. A strip at the top of every screen says so, and the consent and
privacy screens replace "stored encrypted on this phone" with wording that is
true for the preview.

**Why not save in the browser.** A browser has no keystore, so an encryption
key would sit beside the data it protects. Saving health data there would put
it somewhere weaker than the app promises. A preview that forgets is honest;
a "web app" that quietly keeps readiness answers in browser storage is not.

**Consequences.**
- The two storage implementations cannot be compiled together (the phone side
  needs `dart:ffi`), so they meet only at the `AppStorage` interface and a
  conditional import.
- Unit tests cannot load the browser implementation. It is covered by the
  `build-web` CI job (it compiles) and was checked by hand in a real browser
  at iPhone size: full setup, save, Today, My Numbers.
- `web/sqlite3.wasm` is downloaded by `tool/fetch_web_sqlite.sh` and verified
  against the checksum the `sqlite3` package pins. It is not committed.
- If the owner wants to *use* the app on an iPhone rather than preview it,
  that is a product decision: a real iOS build, or a deliberate, documented
  web storage design. Until then the phone app remains Android.
