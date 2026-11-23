# Ride Doctor

A personal cycling coach for Android, built with Flutter: it connects a rider's
symptom to its likely cause, one fix to try, and a re-test — across body, bike
setup, ride data and weather. Built first for riders in the Philippines (hot,
humid, rainy), designed for riders anywhere.

**Status:** Phases 1 and 2 are built.

- **Setup and numbers.** A four-step setup (about you, your riding, readiness
  check, consents), then personal numbers, each with a confidence level and a
  "Why?" explanation: heart-rate zones, power zones, a saddle-height starting
  point, gear cadences, a climb check and a heat check.
- **Race prep.** Add a race and the app picks the right mode for the time left
  (long build, short build, race week, race day), works the race-day timeline
  backward from your start time, gives you a checklist and a skills library
  for that kind of race, and takes a debrief afterwards.

Everything is stored encrypted on the phone, in English or Filipino.

## Run it

You need Flutter 3.50.1 (stable) and an Android device or emulator.

```bash
cd ride_doctor
flutter pub get
dart run build_runner build
flutter run
```

Then check it:

```bash
flutter analyze
flutter test --coverage && dart run tool/check_coverage.dart
```

No Flutter installed? Every CI run uploads a debug APK you can install
directly: open the latest **Ride Doctor CI** run on GitHub → *Artifacts* →
`ride-doctor-debug-apk`.

## Where things are

| Read this | For |
|---|---|
| [`PROMPT.md`](PROMPT.md) | The full product spec and phase plan |
| [`CLAUDE.md`](CLAUDE.md) | Commands, architecture rules, conventions, "never do" rules |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Why each technical choice was made |
| [`docs/SCIENCE.md`](docs/SCIENCE.md) | Every formula, its source and its limits |
| [`docs/PRIVACY.md`](docs/PRIVACY.md) | Draft privacy policy |

Ride Doctor is an educational tool, not a medical device.

Fonts: Barlow and Barlow Condensed, SIL Open Font License 1.1
(`assets/fonts/OFL-*.txt`).
