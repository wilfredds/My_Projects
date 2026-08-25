# The steps only you can do

Everything in this file needs *your* accounts. I can write code and deploy file
uploads, but I cannot create a Supabase project, hold your keys, or create a
Vercel project under your account — that last one I tried twice and got
`403: You don't have permission to create the project` both times, so it is a
permission on your account, not a broken tool.

This is the same sequence as [`GOLIVE.md`](GOLIVE.md), trimmed to just the
account-level actions and written as clicks rather than reasoning. If you want
to know *why* a step exists, GOLIVE.md has the explanation next to it.

**Order matters.** Supabase first, verify locally, Vercel last. You want to be
wrong on your laptop, not in production.

Work from `hiroshi-grill/` with the branch checked out:

```bash
cd CorruptionReportSystem
git checkout claude/new-session-7spck4
git pull origin claude/new-session-7spck4
cd hiroshi-grill
npm install
```

---

# Part 1 — Supabase (~30 min)

## Step 1. Create the project

1. Go to [supabase.com](https://supabase.com) → sign in → **New project**.
2. Name: anything (`hiroshi-grill`).
3. **Region: Singapore.** Closest to the Philippines; every portal page load
   waits on a round trip to it.
4. Set a database password and save it in your password manager. You will not
   need it for this app, but it cannot be recovered.
5. Wait for provisioning (~2 min).

## Step 2. Apply the schema

1. Left sidebar → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from the repo, copy **the whole file**, paste it in.
3. Click **Run**.

✅ **Expect:** "Success. No rows returned." No red errors.

❌ If you get an error, stop and read it — do not move on. A half-applied schema
means half-applied security. The file is idempotent, so fixing and re-running is
safe.

## Step 3. Prove RLS is actually on

Still in the SQL Editor, new query:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
```

✅ **Expect four rows** — `profiles`, `reservations`, `reservation_events`,
`rate_limits` — **every one with `rowsecurity = true`**.

Do not skip this. That column is the entire security model. Any table showing
`false` is readable by anyone holding the anon key, and the anon key ships inside
the browser bundle where everyone can read it.

## Step 4. Copy the three values

1. **Project Settings** (gear icon) → **API**.
2. Copy these three. Newer projects label them differently — either naming is fine:

| Old label | Newer label | You need it for |
| --- | --- | --- |
| Project URL | Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` | Publishable key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` | Secret key | `SUPABASE_SERVICE_ROLE_KEY` |

3. On your machine:

```bash
cp .env.example .env.local
```

4. Open `.env.local` and paste the three in.

5. Generate the rate-limit salt and paste it as `RATE_LIMIT_SALT`:

```bash
openssl rand -base64 32
```

> **The one rule.** The first two are *meant* to be public — they get compiled
> into JavaScript and anyone can read them. The third bypasses every policy you
> just installed. It belongs in `.env.local` (which is gitignored) and in
> Vercel's environment variables. Never in a commit, never in a chat message,
> never with a `NEXT_PUBLIC_` prefix. If it ever leaks, rotate it immediately in
> Settings → API.

✅ **Check:** `git status` should **not** list `.env.local`.

## Step 5. Close the sign-up door

1. **Authentication** → **Sign In / Providers** → **Email**.
2. Turn **OFF** "Enable sign ups" (older dashboards: "Allow new users to sign up").
3. Save.

While you are there, turn on a **minimum password length** (12+) and
**leaked-password protection** if your plan offers it.

## Step 6. Create the three staff accounts

On your machine, with `.env.local` filled in:

```bash
npm run staff:create -- owner@yourdomain.ph owner "Ana Reyes"
npm run staff:create -- host@yourdomain.ph  host  "Kuya at the front desk"
npm run staff:create -- crew@yourdomain.ph  crew  "Cha on the floor"
```

✅ **Expect** each to print a user id and a **temporary password**.

⚠️ **Copy each password before closing the terminal.** They are generated, shown
once, and stored nowhere. Hand them over in person and have each person change
theirs on first sign-in.

Use real addresses people can receive mail at, or ones you control — password
resets go there.

---

# Part 2 — Prove it locally before anyone can see it (~15 min)

## Step 7. Run the automated checks

```bash
npm test        # 132 — endpoint, login, CSP, status logic
npm run lint
npm run build
```

`npm run db:test` (43 RLS assertions) needs a local Postgres. If you have Docker:

```bash
docker run -d -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
npm run db:test
```

If you don't have Docker, skip it — those policies are already tested and the
real ones now live in your Supabase project.

## Step 8. Sign in as each role and look with your own eyes

```bash
npm run dev
```

Go to http://localhost:3000, submit a booking from the form, then sign in at
http://localhost:3000/portal as each account in turn.

| Sign in as | Must see | Must NOT see |
| --- | --- | --- |
| **crew** | Confirm, Seat buttons | Cancel button; full phone number (shows masked, e.g. `09•• ••• 4567`) |
| **host** | All four status buttons, full phone numbers | The Covers/Bookings/Pending/Seated tiles |
| **owner** | Everything including the summary tiles | — |

✅ **Expect:** the booking you submitted appears, and each role sees exactly the
row above.

### Step 8b. The one test worth doing by hand

This is the whole point of the architecture, and it is the single most
demonstrable thing in your project:

1. Sign in as **crew**.
2. Open DevTools → Elements.
3. Find a booking's button row and edit the HTML to add a cancel button, or take
   an existing button and change its `value` attribute to `cancelled`.
4. Click it.

✅ **Expect:** the booking does **not** cancel. You get "Your role cannot make
that change. Ask the host."

That refusal comes from Row Level Security in Postgres, not from the page. The
hidden button was only ever a convenience — the actual permission lives in the
database, which is why forging the UI achieves nothing.

❌ If it *does* cancel, stop and tell me. Do not deploy.

---

# Part 3 — Vercel (~20 min)

## Step 9. Merge to your default branch

```bash
git checkout main
git merge claude/new-session-7spck4
git push origin main
```

## Step 10. Create the project

1. [vercel.com](https://vercel.com) → **Add New** → **Project**.
2. **Import** `wilfredds/CorruptionReportSystem`.
3. **Root Directory** → click **Edit** → select **`hiroshi-grill`**.

⚠️ **Do not skip the Root Directory.** Your repo holds six projects (`autocare`,
`bike-guide-app`, `corruption-reporting-system-final`, `cyclemind_ai`,
`hiroshi-grill`, `rallyready`). Leave it at the root and Vercel builds the wrong
one — that is exactly how my first deploy failed.

4. Framework should auto-detect as **Next.js**.
5. **Do not deploy yet** — add the environment variables first, or the first
   build ships without them.

## Step 11. Environment variables

**Settings → Environment Variables.** Watch the Preview column:

| Variable | Production | Preview | Value |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | from Step 4 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | from Step 4 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | from Step 4 — **secret** |
| `RATE_LIMIT_SALT` | ✅ | ✅ | from Step 4 — **same value in both** |
| `NEXT_PUBLIC_SITE_URL` | ✅ | ❌ **leave unset** | your live URL |

Two that catch people:

- **`NEXT_PUBLIC_SITE_URL` on Production only.** Set it to your real domain, or
  `https://<your-project>.vercel.app` until you have one. Leaving it unset on
  Preview is deliberate — a preview that declares itself canonical tells Google a
  throwaway URL is the real site. That is the exact bug on the current
  deployment, where the canonical reads `corruption-report-system.vercel.app`.
- **`RATE_LIMIT_SALT` must be byte-identical everywhere.** Different values put
  the same visitor in different buckets, so the limit ends up enforced per
  serverless instance instead of globally. It fails silently to customers and
  only shows up in your logs.

## Step 12. Deploy

**Deployments** → **Redeploy**, or just push a commit.

✅ **Expect** a green build. From now on **every push to `main` deploys itself** —
that is the git-connected hosting this project has been missing.

## Step 13. Verify the live site

- [ ] Landing page loads; address, phone and hours are the real ones.
- [ ] Submit a booking on the live site → it appears in the live portal.
- [ ] Sign in as crew / host / owner → same table as Step 8.
- [ ] Cancel your test booking so it is not sitting in real data.
- [ ] Private window → `/portal/dashboard` redirects to `/portal`.
- [ ] Headers:

```bash
curl -I https://your-site.vercel.app
```

Expect `content-security-policy`, `strict-transport-security`,
`x-frame-options: DENY`, `x-content-type-options: nosniff`, and **no**
`x-powered-by`.

- [ ] Run that curl **twice** and confirm the `nonce-` value **changes**. A fixed
      nonce is the same as no nonce.
- [ ] Paste the URL into Messenger — the preview card renders.
- [ ] [Google Rich Results Test](https://search.google.com/test/rich-results) →
      picks up the Restaurant schema with your real details.

## Step 14. Schedule the rate-limit cleanup

Supabase → **Database** → **Extensions** → enable **`pg_cron`**. Then in the SQL
Editor:

```sql
select cron.schedule(
  'prune-rate-limits', '0 3 * * *',
  $$select public.prune_rate_limits()$$
);
```

Without this the rate-limit table grows forever.

## Step 15. Delete the throwaway

The old preview lives inside the `corruption-report-system` project and is a
one-off file upload — it will never update. Once your own project is live, delete
that deployment so nobody bookmarks it.

---

# What is left for me

Once Part 1 and Part 3 are done, send me:

- your live URL, and
- **the anon key and project URL only** — these two are public by design.

**Do not send the service-role key.** It bypasses every policy in
`supabase/schema.sql`; it belongs only in `.env.local` and Vercel's dashboard.

I can still do, any time — no accounts needed:

- **Phase A, the placeholder data.** Give me the real address, phone, opening
  hours and prices and I will replace every value in `src/lib/restaurant.ts` and
  `src/lib/menu.ts`, keep `hours`/`hoursSpec` and `phone`/`phoneHref` in step,
  and push it.
- Any bug you hit in Steps 7–13 — paste the error and I will fix it.
- Cloudflare Turnstile wiring, if junk bookings start arriving.
