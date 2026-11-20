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

## ADR-0005 — Database encryption route

**Status:** Proposed — to be verified at the start of Phase 1

**Context.** The spec asks for drift + SQLCipher. The package that used to
provide SQLCipher to Flutter apps, `sqlcipher_flutter_libs`, was marked
end-of-life in February 2026 ("no longer does anything") after `sqlite3` 3.x
moved to Dart build hooks. The `sqlite3` documentation states that on native
platforms SQLCipher or SQLite3MultipleCiphers can be selected through its hook
options instead.

**Decision (proposed).** Use `drift` on `sqlite3` 3.x with an encrypted build
selected through the `sqlite3` hook options, the key generated on first launch
and held in `flutter_secure_storage`. Choose between SQLCipher and
SQLite3MultipleCiphers after reading the hook-options page and testing both on
Android.

**Consequences / what Phase 1 must prove before this is Accepted.**
- An encrypted database file is unreadable without the key (a test opens the
  file without it and must fail).
- The app builds for Android in CI with the encrypted variant.
- Unit tests can run against the same schema on the host machine.

---

## ADR-0006 — Brand palette

**Status:** Proposed — awaiting the owner's choice

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

**Decision.** Pending. Until then A is the default.

**Consequences once decided.** Delete the other `AppPalette` value, the
`PalettePreview` provider and the palette switcher; `AppTheme.build` loses its
palette argument. The design preview screen itself stays as a style guide.

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

**Status:** Accepted (2026-11-20); superseded when Phase 1 lands

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
