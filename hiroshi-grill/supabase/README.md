# Database

```
schema.sql                    the migration — run this on Supabase
verify-rls.sql                policy tests — run this locally
local/00-supabase-shim.sql    fakes Supabase's auth pieces for local testing
```

## Setting up a Supabase project

1. Create a project at [supabase.com](https://supabase.com). Choose a region
   near your users — Singapore is the closest to the Philippines.

2. **SQL Editor → New query**, paste all of `schema.sql`, Run. It is idempotent,
   so re-running it later to pick up changes is safe.

3. **Project Settings → API**, copy into `.env.local`:

   | Dashboard field | Variable |
   | --- | --- |
   | Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
   | `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
   | `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` |

   The first two are meant to be public. The third bypasses every policy in
   this directory — it belongs in `.env.local` (gitignored) and in Vercel's
   Environment Variables, and nowhere else.

4. **Authentication → Providers → Email → turn OFF "Enable sign ups".** Staff
   accounts are created by you, not by strangers. Anyone who did sign up would
   land with no `profiles` row and see nothing at all, but there is no reason to
   let them try.

5. Create the staff accounts:

   ```bash
   npm run staff:create -- ana@example.com owner "Ana the owner"
   npm run staff:create -- kuya@example.com host "Kuya at the front desk"
   npm run staff:create -- cha@example.com crew "Cha on the floor"
   ```

   Each prints a one-time password. Hand it over in person and have them change
   it on first sign-in.

## Testing the policies

```bash
npm run db:test
```

This drops and recreates a local `hiroshi_test` database, applies the real
`schema.sql`, and runs 43 assertions covering every row in the spec's §9
checklist. It needs a local Postgres (or
`docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16`), but **no
Supabase project** — `local/00-supabase-shim.sql` stands in for the `auth`
schema and the `anon` / `authenticated` roles, so policies can be tested
offline in about a second.

The tests impersonate each role the way a real request does (`set role
authenticated` plus a `request.jwt.claims` setting that `auth.uid()` reads), so
what they exercise is the actual policy, not a paraphrase of it. Loosen a policy
and the suite goes red and exits non-zero.

## The model in one paragraph

`profiles` holds one row per staff login with their role. `reservations` is
written by the public and managed by staff. Every table has RLS on, which makes
the default answer DENY — so what a role can do is exactly what a policy says,
and nothing else. `staff_role()` is a `security definer` lookup that answers
"who is asking?" once per query. `staff_reservations` is a view that masks phone
numbers for crew. `reservation_events` is an append-only audit trail written by
a trigger, which not even the owner can edit.

The things nobody can do are expressed by policies that do not exist: there is
no insert policy on `profiles`, so no request from any browser with any key can
create an owner.

## Three places this departs from the spec

The spec's §5 is the right shape; these three gaps are marked ✱ in `schema.sql`.

**✱1 The public insert was unbounded.** `with check (true)` lets anyone POST a
reservation that is already `status = 'confirmed'` — a fake booking walked
straight past the host. Now the check pins new rows to `pending`.

**✱2 Crew could not do their job.** §3 says crew mark Confirmed and Seated; §5
grants UPDATE to host and owner only. Crew now has a policy whose `with check`
omits `'cancelled'`, so they can move a booking forward but not cancel it — and
a trigger stops them editing anything but the status, because RLS controls rows,
not columns.

**✱3 Masking moved from the UI to the database.** The spec suggests masking
phone numbers in React for v1. A UI mask lasts until someone opens the network
tab and reads the JSON that was sent to draw it. `staff_reservations` masks in
SQL, so a crew session never receives the digits.

## A note on the browser client

There isn't one, on purpose. Sign-in is a server action and the portal is
server-rendered, so nothing in the browser ever reads the session — which is
what lets the session cookie be `httpOnly` and stay out of reach of any XSS.

If milestone 5 needs live updates, do it through a server action or a route
handler. Adding `createBrowserClient` back means turning that hardening off,
and it should be a decision rather than a side effect.

## Still to come

The owner's daily-summary query is a plain count over `staff_reservations` and
belongs with the dashboard in milestone 5.
