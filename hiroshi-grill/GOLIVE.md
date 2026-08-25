# Going live

> **Just want the click-by-click list?** [`YOUR-STEPS.md`](YOUR-STEPS.md) is this
> same sequence trimmed to the steps that need your own Supabase and Vercel
> accounts, written as actions rather than reasoning. This file is the *why*
> behind each one.

The code is finished. Four things stand between it and a real restaurant using
it. This is the order to do them in, and why that order.

| # | Caveat | Phase |
| --- | --- | --- |
| 1 | Business details are placeholders | **A** |
| 2 | No Supabase project — bookings and portal fail | **B**, **C** |
| 3 | Canonical URL points at the wrong domain | **E** |
| 4 | Preview is a file upload, not git-connected | **E** |

Phases A–D happen on your own machine. Nothing is public until Phase E, which
is deliberate: **you want to be wrong locally, not in production.** RLS mistakes
found on your laptop cost a minute; the same mistake found after launch has
already leaked somebody's phone number.

Budget about two hours.

---

## Phase A — Replace the placeholder data

Do this first. It needs no accounts, blocks nothing, and it is the caveat most
likely to cause real-world harm — a wrong phone number sends customers to a
stranger, and wrong hours send them to a locked door.

### A1. `src/lib/restaurant.ts`

Every value below is currently fake. Replace all of them:

| Field | Placeholder now | What it feeds |
| --- | --- | --- |
| `address.street` | `123 Governor's Drive` | Page, JSON-LD, Google Maps link |
| `address.barangay` | `Barangay Manggahan` | Page, JSON-LD |
| `address.postalCode` | `4107` | JSON-LD |
| `contact.phone` | `(046) 000-0000` | Page, JSON-LD |
| `contact.phoneHref` | `tel:+63460000000` | The tap-to-call link |
| `contact.email` | `hello@example.com` | Not yet rendered — still fix it |
| `contact.facebook` | `https://facebook.com/` | Not yet rendered — still fix it |
| `geo.latitude` / `geo.longitude` | `14.3869` / `120.8817` | JSON-LD, Google's map pin |
| `hours` | 11am–10pm / 11pm | The Visit section |
| `hoursSpec` | same, in 24h | JSON-LD |

Three traps:

- **`phone` and `phoneHref` are separate on purpose.** `phone` is what people
  read; `phoneHref` is what their phone dials. Format the first however you
  like, but the second must be `tel:` + international format with no spaces or
  punctuation — `tel:+63461234567`. If they disagree, the tap-to-call button
  quietly dials the wrong number.
- **`hours` and `hoursSpec` are the same facts twice** — human-readable and
  machine-readable. Change one without the other and your site tells customers
  one thing and Google another. Update them in the same edit, every time.
- **Get the real coordinates** by right-clicking the restaurant's exact pin in
  Google Maps and copying the lat/long it offers. Do not guess — this is what
  places the pin in search results.

### A2. `src/lib/menu.ts`

Replace `unliPackages` (names, prices, what each includes), `alaCarteSections`
(every item and price), and `houseRules` (the six rules — especially the
₱150/100g leftover charge and the "kids under 4 ft" rule, which are commitments
you are publishing).

### A3. Check your work

```bash
npm run dev
```

Open http://localhost:3000 and read the page as a customer would. Then confirm
the structured data agrees with it:

```bash
curl -s http://localhost:3000 | grep -o '"telephone":"[^"]*"'
```

That is the number Google will publish. If it is still `(046) 000-0000`, you
missed a file.

---

## Phase B — Stand up Supabase

### B1. Create the project

At [supabase.com](https://supabase.com) → New project. **Choose Singapore** —
it is the closest region to the Philippines, and every page load in the portal
waits on a round trip to it.

Save the database password somewhere safe. You will not need it for this app
(the app authenticates with API keys), but you cannot recover it.

### B2. Apply the schema

**SQL Editor → New query.** Paste all of `supabase/schema.sql`, Run.

It is idempotent — safe to re-run later when you change something. Expect it to
finish with no errors. If it complains, stop and read the error rather than
skipping ahead; a half-applied schema means half-applied RLS, which is worse
than none because it looks like it worked.

Confirm it took:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
```

**Every row must show `rowsecurity = true`.** That column is the whole security
model. If any table shows `false`, that table is world-readable by anyone
holding the anon key — which is everyone, since the anon key ships in the
browser bundle.

### B3. Copy the keys

**Project Settings → API.** You need three values. Depending on when your
project was made, the dashboard labels them either the old way or the new way:

| Old label | New label | Goes into |
| --- | --- | --- |
| Project URL | Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` | Publishable key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` | Secret key | `SUPABASE_SERVICE_ROLE_KEY` |

Then locally:

```bash
cp .env.example .env.local
```

Fill in those three, plus a rate-limit salt:

```bash
openssl rand -base64 32
```

Paste that as `RATE_LIMIT_SALT`.

**The distinction that matters.** The first two are *meant* to be public — they
are compiled into JavaScript and anyone can read them. The anon key is not a
password; it identifies the project, and what it may do is decided entirely by
the policies you just installed. The service-role key is the opposite: it
bypasses every one of those policies. It belongs in `.env.local` (gitignored)
and in Vercel's environment variables, and nowhere else — never in a client
component, never behind a `NEXT_PUBLIC_` prefix, never in a commit.

If you ever paste the service-role key somewhere public, rotate it immediately
in **Settings → API**. Assume anything that touched it is compromised.

### B4. Close the sign-up door

**Authentication → Providers → Email → turn OFF "Enable sign ups".**

There is already a second layer here: `schema.sql` deliberately writes *no*
insert policy on `profiles`, so a stranger who somehow created a login would
land with no profile row, `staff_role()` would return NULL, and every staff
policy would deny them. They would see an empty portal, not your bookings.

Turn sign-ups off anyway. Defence in depth means you do not spend the second
layer to save yourself a checkbox.

---

## Phase C — Create the staff accounts

From your own machine, never from a deployed route:

```bash
npm run staff:create -- owner@hiroshi.ph  owner "Ana Reyes"
npm run staff:create -- host@hiroshi.ph   host  "Kuya at the front desk"
npm run staff:create -- crew@hiroshi.ph   crew  "Cha on the floor"
```

Each prints a one-time password. It is generated, not chosen, and it is **not
stored anywhere** — copy it before you close the terminal.

Hand each password over in person or through a channel you trust, and have the
person change it on first sign-in.

This script is the one deliberate exception to the whole model: it uses the
service-role key to bypass RLS, because there is no other way to create the
first owner in a system where no route can grant a role. That is why it is a
script you run by hand and not a page on the internet.

---

## Phase D — Prove it before anyone sees it

```bash
npm test        # 126 endpoint, login, CSP and status tests
npm run db:test # 43 RLS assertions against a scratch Postgres
npm run lint
npm run build
```

`db:test` needs a local Postgres. If you have Docker:

```bash
docker run -d -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
```

Then the part no test can do for you — **sign in as each role in turn** at
http://localhost:3000/portal and confirm with your own eyes:

| Role | Must see | Must NOT see |
| --- | --- | --- |
| crew | Confirm, Seat | Cancel button; full phone numbers (masked as `09•• ••• 4567`) |
| host | All four status buttons, full numbers | Owner's daily summary tiles |
| owner | Everything, incl. Covers/Bookings/Pending/Seated | — |

Then submit a booking from the public form and watch it appear in the portal.

**One test worth doing by hand**, because it is the whole point of the
architecture: sign in as crew, open dev tools, and use them to re-enable or
forge a Cancel button. Submit it. The booking must not change — the server
action re-checks, and RLS refuses. If it *does* cancel, stop and do not deploy;
something is wrong with the policies rather than the UI.

---

## Phase E — Its own Vercel project

**This is the phase that fixes caveats 3 and 4, and it starts by moving off the
project the preview is sitting in.**

The current preview lives inside `corruption-report-system`, a project that
belongs to something else — its Root Directory is `autocare`, which is why the
first deploy failed and why I had to prefix the upload to fit. That was fine to
*look* at the site. It is not where this app should live: it would collide with
the other app's settings, and its production domain is what is currently making
your canonical URL wrong.

### E1. Merge your branch

The work is on `claude/new-session-7spck4`. Merge it into `main` (or whatever
your default branch is) so Vercel has something stable to build from.

### E2. Create the project

In the Vercel dashboard: **Add New → Project → Import** your
`wilfredds/CorruptionReportSystem` repo.

Do this in the dashboard yourself — I could not create it from here (Vercel
returned `403: You don't have permission to create a project` for my token).
Clicking through the dashboard uses your own account and works.

Then, critically:

- **Root Directory → `hiroshi-grill`.** The repo holds more than one project.
  Get this wrong and Vercel builds the wrong thing, exactly as it did to me.
- Framework: Next.js (auto-detected).

### E3. Environment variables

**Settings → Environment Variables.** Note which environments each one goes in:

| Variable | Production | Preview | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | **Secret** |
| `RATE_LIMIT_SALT` | ✅ | ✅ | Same value everywhere — see below |
| `NEXT_PUBLIC_SITE_URL` | ✅ | ❌ **leave blank** | This fixes caveat 3 |

Two of these have a catch:

**`NEXT_PUBLIC_SITE_URL` — set on Production only.** Set it to your real domain
(or `https://<project>.vercel.app` until you have one). Leaving it *unset* on
Preview is intentional: a preview that declares itself canonical tells Google
that a throwaway URL is the real site. That is exactly the bug you are seeing
now, where the canonical reads `corruption-report-system.vercel.app` — the
fallback picked up the borrowed project's production domain.

**`RATE_LIMIT_SALT` must be identical across every instance.** It salts the hash
of each caller's IP so the rate-limit table can recognise a repeat visitor
without ever storing who visited — that is a Data Privacy Act consideration, not
just tidiness. If the value differs per instance, the same visitor lands in
different buckets and the limit is enforced per instance instead of globally.
The app degrades to that loudly in the logs rather than refusing bookings, so
this failure is silent to customers and visible only to you.

### E4. Deploy

Push to your default branch. Vercel builds automatically — **that is caveat 4
solved**: every future push deploys itself, and the file-upload preview becomes
irrelevant. You can delete it.

---

## Phase F — Verify in production

Work through this list against the live URL:

- [ ] Address, phone and hours on the page are the real ones.
- [ ] Submit a real test booking. It appears in the portal.
- [ ] Sign in as crew, host and owner. Each sees exactly what Phase D said.
- [ ] Cancel your test booking so it does not sit in the real data.
- [ ] `curl -I https://your-domain.ph` shows `content-security-policy`,
      `strict-transport-security`, `x-frame-options: DENY`,
      `x-content-type-options: nosniff`, and **no** `x-powered-by`.
- [ ] The CSP `nonce-` value **changes on every request**. Run the curl twice.
      A fixed nonce is the same as no nonce.
- [ ] `/portal/dashboard` in a private window redirects to `/portal`.
- [ ] `https://your-domain.ph/robots.txt` names the right sitemap host.
- [ ] Paste the URL into Messenger — the preview card renders.
- [ ] Run it through
      [Google's Rich Results Test](https://search.google.com/test/rich-results).
      The Restaurant schema should be picked up with your real details.
- [ ] Submit the sitemap in Google Search Console.

### Two settings only the dashboard can make

The repo cannot set these for you:

1. **Supabase → Authentication:** turn on a minimum password strength, and
   leaked-password protection if your plan offers it (it checks new passwords
   against known breach corpora). Your staff will pick weak passwords otherwise;
   everyone does.
2. **Supabase → Database → Extensions → `pg_cron`:** schedule the rate-limit
   table to be pruned, or it grows forever.

   ```sql
   select cron.schedule(
     'prune-rate-limits', '0 3 * * *',
     $$select public.prune_rate_limits()$$
   );
   ```

---

## Phase G — Optional, once it is live

**Cloudflare Turnstile.** Get a key pair at
[dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile → Add site, then
set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. The widget
appears on the booking form, the CSP opens up for Cloudflare's origin
automatically, and `verifyTurnstile` starts calling siteverify. Leave both blank
and nothing breaks — the honeypot still runs. Worth adding if you start seeing
junk bookings; not worth it before.

Note that the live siteverify call has never been exercised — the sandbox this
was built in cannot reach Cloudflare. The unit tests cover the logic; the first
real request will be the first real proof.

**Custom domain.** Vercel issues and renews the certificate. Afterwards, set
`NEXT_PUBLIC_SITE_URL` to it and redeploy so the canonical URL, sitemap and
JSON-LD all agree.

One caution before you point a real domain here: `next.config.ts` sends
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. That
tells browsers to refuse plain HTTP on that domain **and every subdomain** for
two years, and it is not quickly reversible — a browser that has already seen
the header keeps honouring it even after you stop sending it. Make sure every
subdomain you intend to use can serve HTTPS first.

---

## If something breaks

| Symptom | Almost always |
| --- | --- |
| "We could not save that request" | Supabase env vars missing or wrong in Vercel |
| Portal accepts the password then bounces back | The auth user exists but has no `profiles` row — re-run `staff:create`, or insert the row by hand |
| Crew sees full phone numbers | You are querying `reservations` instead of the `staff_reservations` view |
| Everything 500s on the booking form | Check the Vercel function logs — `RATE_LIMIT_SALT` and the Supabase keys are read there |
| Blank page, console shows a React hydration error | A CSP change dropped the nonce. See the comment at the top of `src/lib/csp.ts` |

Function logs: Vercel → your project → the deployment → **Logs**. Every failure
path in this app logs a specific line before it returns a vague message to the
customer, which is the split you want — the visitor learns nothing useful to an
attacker, and you learn exactly what happened.
