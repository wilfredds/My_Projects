# AutoCare — working notes

Job-management system for HI-OCTEN CAR CARE SERVICES, also installable for any
other talyer or car-care shop (one install and one database per shop — see
`INSTALL-NEW-SHOP.md`). Replaces a paper notebook: the owner records a finished
job across seven short screens, and the running total is always calculated,
never typed.

**Stack:** Next.js (App Router) · TypeScript · Prisma · PostgreSQL · next-auth ·
Tailwind · Radix/shadcn · next-intl · Zod · react-hook-form

## Commands

```bash
npm run lint        # next lint
npm run typecheck   # tsc --noEmit
npm test            # money maths, branding, reminder rules — no database
npm run test:db     # job integrity, security, access control, setup, reminders — needs PostgreSQL
npm run test:all    # both
npm run build       # prisma generate && next build
npm run test:e2e    # 31 Playwright tests against the built app — run build first
npm run dev
node scripts/check-contrast.mjs   # WCAG AA for every colour pairing × 4 accents
```

`test:e2e` adds its own test accounts to the `.env` database and recreates a
second, empty database (`<name>_e2e_fresh`) for the first-run setup tests. It
starts `next start` on ports 3200 and 3201, so stop anything else using them.
It uses the global Playwright 1.63.0 with the browsers in
`/opt/pw-browsers` — never run `playwright install` here (CI does).

Database:

```bash
npm run db:migrate  # prisma migrate dev
npm run db:deploy   # prisma migrate deploy
npm run seed
npm run db:studio
```

## Database in remote sessions

The SessionStart hook already starts PostgreSQL, applies migrations and exports
`DATABASE_URL`, so `npm run test:db` works with no setup. If the connection is
refused, the cluster is not up:

```bash
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/autocare-test -l /var/lib/postgresql/autocare-test/server.log -o '-p 5432 -k /tmp' start"
```

`docker-compose.yml` targets a local Docker Postgres. **Docker's daemon is not
running in this environment**, so use the cluster above instead.

`npm install` runs `prisma generate` via `postinstall`, which reads
`DATABASE_URL` through the schema's `env()` call — so `.env` must exist before
installing. The hook copies `.env.example` if it is missing.

## What matters here

- **The total can never come from the client.** `lib/calc.ts` owns the money
  maths and `tests/calc.test.ts` covers it. `tests/security.test.ts` exists
  specifically to prove a client cannot dictate a total — if you touch pricing,
  pipeline or server actions, run `npm run test:db`, not just `npm test`.
- **Authorization lives in `lib/rbac.ts`**, with `tests/access-control.test.ts`
  asserting that only admins may delete, restore or purge, and that a
  signed-out visitor has no capability at all.
- **Sessions are invalidated eagerly.** Deactivating, locking, or resetting a
  password kills live sessions immediately (`lib/session.ts`,
  `lib/auth-logic.ts`). Tests cover each path.
- **Logout revokes one sign-in.** Each JWT carries a `sid`; logging out writes
  it to `RevokedSession`, which `resolveSessionUser` checks. A refused cookie
  is sent to `/api/session/end` (clears it, then `/login`) — not straight to
  `/login`, which would loop because middleware still sees a cookie.
- **No default accounts for other shops.** `lib/setup.ts` + `/setup` create
  the first owner, only while the `User` table is empty and `SETUP_CODE` is
  set. `npm run seed` and `prisma/bootstrap.sql` are HI-OCTEN's alone.
- **Service reminders (Babalikan).** `lib/reminders.ts` is pure (calendar
  months, shortest interval, the shop's "today", tel:/sms: links) and is used
  by both the wizard and the server. `lib/reminder-queries.ts` holds the one
  SQL definition of "on the list" — shared by the page and the dashboard count;
  keep it that way. A reminder drops off when the same car has a newer live
  job with its own next visit (so a carwash never cancels a change-oil
  reminder). Dates are `@db.Date` handled as "YYYY-MM-DD" in UTC — never format them
  with a timezone that could shift the day.
- **Branding is per install, in `ShopSetting`:** `accent` (one of
  `lib/branding.ts`'s four — green, red and amber are reserved for money
  states), `logo` (a PNG data URL checked by `lib/logo.ts`) and `tin`. The
  accent is applied as `<html data-accent>`; `app/globals.css` overrides the
  primary tokens per accent. After touching a colour, run the contrast check.
- **Soft delete.** Deleting a job hides it but preserves money history, and
  deleted jobs are excluded from revenue totals. Do not turn this into a hard
  delete.

## Layout

- `app/(app)` authenticated screens · `app/(auth)` sign-in · `app/actions`
  server actions · `app/api` route handlers
- `lib/` — `calc.ts` (money), `rbac.ts` (authorization), `session.ts`,
  `audit.ts`, `rate-limit.ts`, `security-headers.ts`, `validation.ts`, `pdf/`
- `prisma/schema.prisma` — PostgreSQL; see its header comments for
  deliberately-deferred v2 work (customer portal, inventory, multi-branch)
- `messages/` + `i18n/` — next-intl translations

## CI

`.github/workflows/autocare-ci.yml` runs lint, typecheck, `npm test`, migrate,
seed, `npm run test:db`, build and `npm run test:e2e` against a real PostgreSQL
service container. It is path-filtered to `autocare/**`, and uses `npm ci`.

Vercel's production build (`npm run build:vercel`) runs `prisma migrate
deploy`, so a merged migration applies itself to every shop's database. Keep
migrations additive.

## Gotchas

- `npm run lint` prints a Next.js deprecation notice suggesting a codemod to
  the ESLint CLI. It is noise; lint still passes.
- Prisma warns that `package.json#prisma` config is deprecated and will be
  removed in Prisma 7. Worth migrating to `prisma.config.ts` eventually.
