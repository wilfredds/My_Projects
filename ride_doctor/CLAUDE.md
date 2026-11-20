# Ride Doctor — working notes

A Flutter app (Android first) that is a personal cycling coach: it knows the
rider and bike, calculates personal numbers with their sources, prepares
beginners for a first race, plans each day, and diagnoses problems
(symptom → cause → one fix → re-test).

**`PROMPT.md` is the product spec and the working agreement. Read it first.**
This file is the short operational version; where they disagree, `PROMPT.md`
wins unless `docs/DECISIONS.md` records a deliberate change.

## Status

| Phase | State |
|---|---|
| 0 — Foundation | **Built.** Awaiting the owner's review and "go". |
| 1 — Profile, consents, calculation engine | Not started. Plan agreed in outline; see ADR-0005 for the open database-encryption check. |
| 2–7 | Not started. |

Open decisions waiting on the owner: **palette A or B** (ADR-0006).

## How we work (PROMPT.md section 0)

- One phase at a time. At the end of a phase: stop, summarise, show how to run
  and test it, list known gaps, and **wait for "go"**. Do not start the next
  phase unprompted.
- The owner is learning. Explain the *why* of each important decision in 2–4
  sentences — in chat and in code comments where the why is not obvious.
- Log every architectural decision in `docs/DECISIONS.md`.
- Document every formula and threshold in `docs/SCIENCE.md` with its source.
  **Never invent a citation.** Unsure → say so and mark it `TODO(verify)`.
- Small Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).

## Commands

Run from `ride_doctor/`.

```bash
flutter pub get                      # also generates lib/l10n/generated/
dart run build_runner build          # generates *.g.dart (required before analyze/test/run)
dart run build_runner watch          # ...or keep regenerating while you edit

flutter run                          # on a connected Android device/emulator
dart format lib test tool
flutter analyze                      # must report "No issues found!"
flutter test                         # all tests
flutter test --coverage && dart run tool/check_coverage.dart   # coverage gate
flutter build apk --debug
```

Generated code (`*.g.dart`, `lib/l10n/generated/`) is **not committed**
(ADR-0004). A fresh clone needs the first two commands before anything else
works.

### Remote/cloud sessions

No Flutter SDK is preinstalled there. Install the pinned one (about 1.5 GB,
a couple of minutes), then use the commands above:

```bash
source tool/setup_remote_flutter.sh
```

There is no Android SDK or emulator in that environment: `flutter analyze` and
`flutter test` work, `flutter run` and `flutter build apk` do not. The Android
build is proven by the `build-android` CI job, which also uploads a debug APK.
Anything that needs a real phone (notifications, sensors, timing a real
onboarding) must be verified by the owner — say so instead of claiming it.

## CI

`.github/workflows/ride-doctor-ci.yml` (repo root), on every push that touches
`ride_doctor/`: format check → analyze → test → coverage thresholds; a secret
scan; an Android debug build. A phase is not done until it is green.

## Architecture rules

Feature-first clean architecture (PROMPT.md section 5).

```
lib/
  app/        bootstrap, router, theme, locale wiring
  core/
    science/  PURE DART formulas + constants (arrives in Phase 1)
    rules/    PURE DART diagnosis rule engine (Phase 4)
  features/<feature>/{data, domain, presentation}
  l10n/       app_en.arb (template), app_fil.arb
test/         mirrors lib/
tool/         check_coverage.dart, setup_remote_flutter.sh
docs/         DECISIONS.md, SCIENCE.md, PRIVACY.md
```

1. **`domain/`, `core/science/` and `core/rules/` never import Flutter**, a UI
   package, Riverpod or go_router. Enforced by
   `test/architecture/layer_boundaries_test.dart`.
2. Every calculation returns its value **plus** a confidence
   (`Measured` / `Estimated` / `Rough`) and an explanation (inputs, formula
   name, source key). No bare numbers reach the UI.
3. Every external dependency (database, weather, sensors, clock) sits behind an
   interface provided by Riverpod, so tests can replace it.
4. Dependencies are added in the phase that first uses them (ADR-0003).
5. The rule engine makes diagnoses. An LLM, if ever added, only rephrases.

## Conventions

- **Material widgets come from `package:material_ui/material_ui.dart`**, not
  the deprecated `package:flutter/material.dart` (ADR-0002). In tests this
  means `tester.pageBack()` does not work — tap `find.byType(BackButton)`.
- **Dart 3.14 constructor syntax:** the lints require `const new({super.key});`
  instead of repeating the class name. `dart fix --apply` converts for you.
- **No hard-coded user-facing strings.** Add the key to `app_en.arb` (with an
  `@description`) *and* `app_fil.arb`; `test/l10n/arb_parity_test.dart` fails
  otherwise. Use `context.l10n.someKey`. Only exception: labels in
  `features/dev/` that describe the design system itself.
- Lints: `very_good_analysis`. Relax a rule only in `analysis_options.yaml`
  with a written reason.
- Accessibility is tested, not hoped for: 48 dp tap targets, labelled controls,
  no overflow at 200% text on a 320×568 screen, WCAG AA text contrast for every
  theme (`test/app/app_test.dart`, `test/app/theme/contrast_test.dart`).
  Colour is never the only signal — pair it with an icon and a label.
- Use `test/helpers/tap_targets.dart`, not `androidTapTargetGuideline`: the
  built-in matcher skips controls touching a screen edge, which is most of ours.

## Never do

From PROMPT.md sections 3 and 10. These are hard rules.

- Never commit secrets, keys or `.env` files. No service-role key in the app.
- Never log personal or health data, and never send it to analytics or crash
  reporting.
- Never store health, body or location data unencrypted, or before the matching
  consent is recorded.
- Never send data off the device without explicit opt-in. Photos and video for
  the fit check stay on the phone.
- Never give medical diagnoses. Red-flag symptoms (chest pain or pressure,
  fainting, unusual breathlessness, palpitations, confusion in heat, sudden
  severe joint pain, swelling) always route to "stop and seek medical care" —
  never to bike-fit advice.
- Never build weight-loss, calorie-restriction or body-image features.
- Never present an unverified formula, threshold or source as fact.
- Never build on the Strava API.
- Never call the network over plain HTTP, or trust an API response unvalidated.
- Never claim something works on a device when it was only run in tests.

## Owner context (answers to PROMPT.md section 13, 2026-11-20)

- New app, package `com.ridedoctor.app`. Stack in section 4 confirmed.
- Intent: **future startup** → Open-Meteo's free tier (non-commercial) cannot
  be the shipping weather source without a licence review (ADR-0007).
- Phases 0–6 free and on-device; LLM budget decided at Phase 7.
- English + Filipino from the start. The owner reviews Filipino wording,
  especially safety and medical text.
- Sensors: none yet (planning to buy) → design for phone-only, `Estimated` and
  `Rough` confidence paths first.
- Riding time available: stated as about 20 h/week. That is a ceiling, not a
  prescription — a beginner's plan must start from current load, not from 20 h.
- Reference bike, to seed Phase 1 fixtures: road bike, frame size 48;
  cassette 11-34; tyre 700×25C (ETRTO 25-622); crank 160 mm; flat pedals.
  **Still unknown / to confirm:** chainring sizes for this bike; bike brand
  (unclear in the voice note); first race date. The reported saddle height of
  30 in (762 mm) is very unlikely as a bottom-bracket-to-saddle-top measurement
  on a size-48 frame — probably measured from the floor. Ask for a re-measure
  before using it.
