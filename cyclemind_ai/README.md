# CycleMind AI 🚴‍♂️🧠

An AI-powered cycling companion that unites an **AI Cycling Coach** and an
**AI Bike Doctor** in one Flutter app. Built with Material 3, Riverpod, and a
Firebase + Claude backend behind a clean abstraction layer.

> **Runs out of the box on mock data — no API keys required.**
> `flutter create . && flutter pub get && flutter run`

---

## Why it's built this way (architecture)

This project follows **Clean Architecture** with a **feature-first** layout and
the **Repository pattern**. The guiding decisions:

1. **Every external dependency sits behind an interface.** Auth, Firestore,
   Storage, Claude text AI, and Claude vision are each accessed through a Dart
   `abstract interface class`. The concrete implementation (mock vs. real) is
   chosen in *one* place per dependency via a Riverpod provider that reads
   `AppConstants.useMocks`. This is the Dependency Inversion Principle in
   practice and is what lets the whole app run offline with zero config.

2. **The Claude API key never ships in the app.** Real AI/vision calls are made
   by **Cloud Functions** (`functions/src/index.ts`) that hold the key
   server-side; the Flutter `ClaudeAiService` / `ClaudeVisionService` only POST
   to those HTTPS endpoints. The mobile binary contains no secret.

3. **No code-generation required.** We use hand-written immutable models
   (`copyWith` / `fromJson` / `toMap` / `Equatable`) and hand-written Riverpod
   providers instead of freezed / json_serializable / riverpod_generator. The
   result compiles with a plain `flutter pub get` — no `build_runner` step.

4. **Errors never leak across layers.** Data sources throw `Exception`s;
   repositories catch them and return a `Result<T>` (`Success` | `Failure`)
   wrapping a typed `AppFailure`. The UI folds over the result.

### Layered folder structure

```
lib/
├── app/            # MaterialApp, router (go_router), Material 3 theme
├── core/           # cross-cutting: errors, Result, constants, shared widgets,
│                   #   ride math, Firebase + mock-store providers
├── services/       # AI + Vision abstractions with mock & Claude impls
│   ├── ai/         #   AiService → MockAiService | ClaudeAiService
│   └── vision/     #   VisionService → MockVisionService | ClaudeVisionService
└── features/       # feature-first; each has data / domain / presentation
    ├── auth/       # email+password & Google, profile creation
    ├── dashboard/  # readiness, weekly stats, AI recs, bike health
    ├── coach/      # rides, trends, goals, training plan, readiness
    ├── bike_doctor/# photo → vision analysis → health report, mechanic chat
    ├── bikes/      # multiple bikes, components, mileage, maintenance reminders
    └── profile/    # profile, goals, preferences
```

Each feature layer:
- **domain/** — entities, repository *interfaces*, use cases (pure logic).
- **data/** — models (Firestore mapping), repository *implementations*
  (mock + Firebase).
- **presentation/** — Riverpod controllers/providers, screens, widgets.

---

## Features

| Module | What it does |
| --- | --- |
| **Auth** | Email/password + Google sign-in, profile creation, auth-gated routing. |
| **Dashboard** | Readiness ring, weekly distance/elevation/calories, AI recommendation, bike-health summary. |
| **AI Coach** | Log rides (auto calorie estimate), distance trend chart, AI ride summaries, training-plan generator, readiness score. |
| **Bike Doctor** | Capture/upload a photo, pick a bike area, run AI vision analysis → health score, risk level, per-area findings & fixes. Plus an AI mechanic chat. |
| **Bikes** | Multiple bikes, component tracking with wear bars, mileage, and automatic maintenance reminders. **Mark replaced** resets a part's wear and clears its reminder, and every replacement is kept in a per-bike, append-only **service history**. Parts added to a bike you already own can carry the km already on them. |

---

## Database schema (Firestore)

| Collection | Key fields |
| --- | --- |
| `users/{uid}` | `email`, `profile{displayName, level, weightKg}`, `goals[]`, `preferences{...}` |
| `bikes/{id}` | `userId`, `name`, `frame`, `groupset`, `tires`, `totalMileageKm`, `components[]` |
| `rides/{id}` | `userId`, `bikeId?`, `startedAt`, `distance`, `elevation`, `avgSpeed`, `durationSec`, `calories`, `cadence?`, `heartRate?`, `power?` |
| `maintenance_logs/{id}` | `userId`, `bikeId`, `component`, `mileageAtService`, `status`, `serviceDate`, `notes` |
| `ai_reports/{id}` | `userId`, `bikeId?`, `rideId?`, `type`, `healthScore?`, `riskLevel?`, `recommendations[]`, `createdAt` |

Access is locked down per-owner in `firestore.rules`; composite indexes are in
`firestore.indexes.json`.

---

## Running locally

### 1. Mock mode (default — no backend, no keys)

```bash
cd cyclemind_ai
flutter create .          # generate android/ios/web platform folders
flutter pub get
flutter run               # USE_MOCKS defaults to true
```

You'll land on the dashboard seeded with demo data (sign in with any
credentials). Log a ride and get an AI summary, run a Bike Doctor demo scan,
add a bike, generate a training plan — all offline.

### 2. Verify

```bash
flutter analyze           # expect no errors
flutter test              # unit tests for ride math, readiness, reminders, Result
```

### 3. Live mode (real Firebase + Claude)

```bash
# a) configure Firebase for this app (regenerates lib/firebase_options.dart)
dart pub global activate flutterfire_cli
flutterfire configure

# b) deploy backend (rules, indexes, functions)
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase functions:secrets:set ANTHROPIC_API_KEY   # paste your Claude key
firebase deploy --only functions

# c) run the app pointed at the live backend
flutter run \
  --dart-define=USE_MOCKS=false \
  --dart-define=FUNCTIONS_BASE_URL=https://<region>-<project>.cloudfunctions.net
```

---

## AI integration

- **Text (coach + mechanic chat):** `AiService` → Cloud Functions
  `summarizeRide`, `weeklyInsight`, `readinessAdvice`, `generateTrainingPlan`,
  `mechanicChat`.
- **Vision (bike doctor):** `VisionService` → Cloud Function `analyzeBike`
  (sends a base64 image to Claude's vision model, returns a structured report).
- **Model:** `claude-sonnet-4-6` (configurable in `AppConstants.claudeModel`
  and `functions/src/index.ts`).
- **Mock seed data:** the mock services reuse real cycling knowledge ported from
  the sibling "Bike Guide PH" PWA (`assets/data/tips.json`,
  `assets/data/troubleshooting.json`).

---

## Notes & next steps

- This was scaffolded without a Flutter SDK in the authoring environment, so it
  is delivered as **source verified by static review + unit tests** — run the
  `flutter create . / pub get / analyze / test / run` steps above to validate.
- Production hardening TODO: verify Firebase ID tokens inside the Cloud
  Functions, add rate limiting, upload bike photos to Storage and persist the
  URL on the report, and add push notifications (FCM) for maintenance reminders.
