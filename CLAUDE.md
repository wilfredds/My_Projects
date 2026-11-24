# CorruptionReportSystem — repository guide

This repository is a **monorepo of nine unrelated projects**. Despite the
repository name, most of the code here has nothing to do with corruption
reporting — the name is historical. There is no shared build, no workspace
tooling, and no dependency between projects. Treat each directory as its own
codebase and work inside it.

| Directory | What it is | Stack | Build/test here? |
|---|---|---|---|
| `autocare/` | Job-management system for a car care shop | Next.js, Prisma, PostgreSQL, next-auth | Yes — full |
| `rallyready/` | Solo badminton training app | Vite, React, TypeScript, Supabase | Yes — full |
| `cyclemind_ai/` | AI cycling coach and bike doctor | Flutter, Riverpod, Firebase | **No — no Flutter SDK** |
| `corruption-reporting-system-final/` | Corruption reporting site | Static HTML/CSS/JS, Firebase | No build step |
| `bike-guide-app/` | Cycling guide PWA | Static HTML/CSS/JS, Firebase | No build step |
| `hiroshi-grill/` | Restaurant reservation app (client work) | Next.js 16, TypeScript, Supabase | Yes — full |
| `portfolio/` | Personal portfolio site | Static HTML/CSS/JS | No build step |
| `flare/` | Full-stack build for a client-supplied Figma design (client work) | Next.js 16, TypeScript, Firebase (Auth + Firestore) | Yes — full |
| `ride_doctor/` | Cycling coach app: diagnoses, trains and race-preps riders | Flutter, Riverpod, go_router, drift on encrypted SQLite | Analyze + test, after installing the SDK — see below |

Each project has its own `CLAUDE.md` (or, for `portfolio/`, a `README.md`)
with specifics. Read that one before working in it.

`flare/` is mid-build. Its backend layer is real — security rules, catalogue
reads, server-written progress, audit logging, the theme system, and an admin
surface covering accounts, announcements and the audit log. The learner-facing
design lives in a client-owned Figma file not yet shared with this
environment's Figma account, so those screens are still placeholder markup.
`flare/docs/DATA-MODEL.md` is the schema source of truth; `flare/README.md`
has the Figma file key and what to do once access is granted.

## Environment

A `SessionStart` hook (`.claude/hooks/session-start.sh`) prepares remote
sessions: it installs npm dependencies for `autocare` and `rallyready`, starts a
local PostgreSQL cluster and applies autocare's migrations, and installs the
pinned Python Playwright binding. It only runs when `CLAUDE_CODE_REMOTE=true`,
so local checkouts are untouched.

If something seems missing, run it by hand:

```bash
CLAUDE_CODE_REMOTE=true ./.claude/hooks/session-start.sh
```

### Known environment limits

- **No Flutter or Dart SDK is preinstalled**, and the hook does not install
  one (it is a 1.5 GB download). For `ride_doctor`, run
  `source ride_doctor/tool/setup_remote_flutter.sh` to install the pinned SDK
  for the session; `flutter analyze` and `flutter test` then work. There is
  still no Android SDK or emulator, so nothing can be run on a device here.
  `cyclemind_ai` has no such script and no committed platform folders: treat
  it as unverifiable locally, and say so rather than claiming a change is
  tested. Its CI builds it via `.github/workflows/deploy-web.yml`.
- **Docker is installed but its daemon is not running.** `autocare`'s
  `docker-compose.yml` will not work. The hook starts PostgreSQL directly
  instead.
- **Playwright must stay pinned** to `1.56.0` for the Python binding — it has
  to match the bundled Chromium build `1194`. Never run `playwright install`;
  the browsers already live at `$PLAYWRIGHT_BROWSERS_PATH`.

## Skills

`.claude/skills/` contains 23 vendored skills (UI/UX Pro Max, Anthropic's
`frontend-design` and `webapp-testing`, and obra/superpowers). See
`.claude/skills/README.md` for provenance, licenses and runtime requirements.

For UI work, the design database is queryable directly:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "dashboard" --stack shadcn
```

Useful stacks for this repo: `shadcn`, `nextjs`, `react`, `html-tailwind`.
Flutter coverage is sparse and often returns no match.

## CI

Every project now has a workflow, each path-filtered to its own directory:

| Workflow | Covers |
|---|---|
| `autocare-ci.yml` | lint, typecheck, test, migrate, seed, DB tests, build |
| `rallyready-ci.yml` | `npm run verify` — typecheck, lint, 557 tests, build |
| `hiroshi-ci.yml` | lint, 132 tests, build, 43 RLS policy tests against a Postgres service |
| `firestore-rules-ci.yml` | 144 rules assertions against the real Firestore and Storage emulators |
| `static-sites-ci.yml` | parses all JS in the three static sites |
| `deploy-web.yml` | builds `cyclemind_ai` for web and publishes to Pages |
| `deploy-bike-guide.yml` | publishes `bike-guide-app/` to Pages under `/bike-guide-app/` |
| `flare-ci.yml` | lint, typecheck, 87 tests, build |
| `ride-doctor-ci.yml` | format, analyze, 427 tests, coverage thresholds, secret scan, Android debug build (uploads the APK), web preview build. Runs on every push to any branch, unlike the others |

Known coverage gaps, so nobody assumes more than is there:

- **`cyclemind_ai` is only built, never tested.** `flutter test` runs nowhere,
  and cannot run in this environment either.
- **The static sites are syntax-checked, not behaviour-tested.** There are no
  unit tests for them; `static-sites-ci.yml` catches typos, not logic. This
  covers `portfolio/` too.
- **`flare` has no automated UI tests.** Its backend logic is covered — the
  progress rollup, request validation, theme parsing, the administrator
  lockout guards and the media/embed-URL validation under `flare/tests/`, plus
  84 rules assertions across `firestore-tests/flare.test.mjs` and
  `flare-storage.test.mjs`. The admin screens were verified by hand
  against the Firebase emulators (`cd flare && npm run emulators`, then
  `npm run seed`), but nothing asserts them in CI. The learner-facing screens
  are still placeholder markup pending Figma access.

- **`ride_doctor` has never been run on a device from this environment.** Its
  widget tests drive the real app in a test harness, and CI compiles the
  Android build, but notifications, sensors and anything timing-related need a
  real phone.

Note that `node --check` does **not** validate syntax: it exits 0 on a
syntactically invalid file. `.github/scripts/check-static-js.mjs` uses
`vm.SourceTextModule` instead, which genuinely throws on bad syntax — verified
against a deliberately broken file. Don't "simplify" it back to `node --check`.

## Conventions

- Each project keeps its own `.gitignore` for project-specific entries; the
  root one only covers `node_modules/`, `.vite/`, `.DS_Store` and `*.log`.
- The READMEs in `autocare/`, `rallyready/` and `cyclemind_ai/` are detailed and
  current. Read them before making architectural changes.
