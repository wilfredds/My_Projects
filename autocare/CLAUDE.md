# AutoCare — working notes

Job-management system for HI-OCTEN CAR CARE SERVICES. Replaces a paper
notebook: the owner records a finished job across seven short screens, and the
running total is always calculated, never typed.

**Stack:** Next.js (App Router) · TypeScript · Prisma · PostgreSQL · next-auth ·
Tailwind · Radix/shadcn · next-intl · Zod · react-hook-form

## Commands

```bash
npm run lint        # next lint
npm run typecheck   # tsc --noEmit
npm test            # money maths and input schemas, no database
npm run test:db     # job integrity, security, access control — needs PostgreSQL
npm run test:all    # both
npm run build       # prisma generate && next build
npm run dev
```

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
seed, `npm run test:db` and build against a real PostgreSQL service container.
It is path-filtered to `autocare/**`, and uses `npm ci`.

## Gotchas

- `npm run lint` prints a Next.js deprecation notice suggesting a codemod to
  the ESLint CLI. It is noise; lint still passes.
- Prisma warns that `package.json#prisma` config is deprecated and will be
  removed in Prisma 7. Worth migrating to `prisma.config.ts` eventually.
- **Zod stays on the server.** Zod 4 probes `new Function` when it builds an
  object schema, and the production CSP reports that as a violation. Read the
  header of `lib/validation.ts` before importing a schema into a client
  component.
