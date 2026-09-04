# CorruptionReportSystem — repository guide

This repository is a **monorepo of eight unrelated projects**. Despite the
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

Each project has its own `CLAUDE.md` (or, for `portfolio/`, a `README.md`)
with specifics. Read that one before working in it.

`flare/` is mid-build. Its backend layer is real — security rules, catalogue
reads, server-written progress, audit logging and the theme system — but the
front-end design lives in a client-owned Figma file not yet shared with this
environment's Figma account, so its screens are still placeholder markup.
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

- **No Flutter or Dart SDK.** `cyclemind_ai` cannot be built, run or tested
  here. Its CI builds it via `.github/workflows/deploy-web.yml`. Change its
  Dart source by reading carefully — you cannot verify it locally, so say so
  rather than claiming a change is tested.
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
| `rallyready-ci.yml` | `npm run verify` — typecheck, lint, 515 tests, build |
| `hiroshi-ci.yml` | lint, 132 tests, build, 43 RLS policy tests against a Postgres service |
| `firestore-rules-ci.yml` | 123 rules assertions against the real Firestore emulator |
| `static-sites-ci.yml` | parses all JS in the three static sites |
| `deploy-web.yml` | builds `cyclemind_ai` for web and publishes to Pages |
| `deploy-bike-guide.yml` | publishes `bike-guide-app/` to Pages under `/bike-guide-app/` |
| `flare-ci.yml` | lint, typecheck, 22 tests, build |

Known coverage gaps, so nobody assumes more than is there:

- **`cyclemind_ai` is only built, never tested.** `flutter test` runs nowhere,
  and cannot run in this environment either.
- **The static sites are syntax-checked, not behaviour-tested.** There are no
  unit tests for them; `static-sites-ci.yml` catches typos, not logic. This
  covers `portfolio/` too.
- **`flare` has no UI tests.** Its backend logic is covered — the progress
  rollup, the request validation and the theme parser under `flare/tests/`,
  and 63 rules assertions in `firestore-tests/flare.test.mjs` — but its
  screens are still placeholder markup pending Figma design access, so
  nothing tests them.

Note that `node --check` does **not** validate syntax: it exits 0 on a
syntactically invalid file. `.github/scripts/check-static-js.mjs` uses
`vm.SourceTextModule` instead, which genuinely throws on bad syntax — verified
against a deliberately broken file. Don't "simplify" it back to `node --check`.

## Conventions

- Each project keeps its own `.gitignore` for project-specific entries; the
  root one only covers `node_modules/`, `.vite/`, `.DS_Store` and `*.log`.
- The READMEs in `autocare/`, `rallyready/` and `cyclemind_ai/` are detailed and
  current. Read them before making architectural changes.
