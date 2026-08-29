# Hiroshi Master Grill Samgyupsal

Reservation web app for an unli samgyupsal restaurant in General Trias, Cavite.
Built to the plan in `hiroshi-build-spec.md`.

Two faces, one codebase:

- **Public site** — branding, unli sets, rice & ramen menu, house rules,
  location, and a reservation request form. No login.
- **Staff portal** — sign-in at `/portal`, and a dashboard listing each day's
  bookings with the controls each role is allowed.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 (configured in CSS, not a JS config file) |
| Validation | Zod — one schema shared by the browser form and the server |
| Backend / auth | Supabase (Postgres + Auth + Row Level Security) — milestone 2 |
| Hosting | Vercel |

## Running it

```bash
npm install
cp .env.example .env.local     # then fill it in
npm run dev                    # http://localhost:3000
```

```bash
npm run build && npm run start # production build
npm run lint
npm test                       # endpoint tests — no server, no database needed
npm run db:test                # apply the schema to a scratch DB, test the policies
```

Database setup is in [`supabase/README.md`](supabase/README.md); the Vercel
reference is [`DEPLOY.md`](DEPLOY.md). To take this from finished code to a
restaurant actually using it, follow [`GOLIVE.md`](GOLIVE.md) — it is the whole
sequence in order, from replacing the placeholder data to verifying the live
site.

## Milestone status

| # | Milestone | State |
| --- | --- | --- |
| 1 | Scaffold, design tokens, public site | **Done** |
| 2 | Supabase tables, RLS policies | **Done** — 43 policy tests pass |
| 3 | `/api/reservations` — server validation + rate limit | **Done** — 35 endpoint tests |
| 4 | Supabase Auth login at `/portal` | **Done** — 31 sign-in tests |
| 5 | `/portal/dashboard` with role-aware controls | **Done** — 28 dashboard tests |
| 6 | Honeypot/Turnstile, per-role testing | **Done** — Turnstile optional, 14 tests; 24 CSP tests |
| 7 | SEO + deploy | Site ready; deploy needs your Supabase project |

`npm test` runs 132 of those; the 43 policy tests are separate and need a
database, so they run under `npm run db:test`. Both suites run in CI on every
push that touches this project. If you change a count here, run the suite first
— these numbers drifted once already.

## ⚠️ Before this goes public

Every business detail on the site is a **placeholder**, sitting in two files so
it can be corrected in one place:

- `src/lib/restaurant.ts` — address, phone, hours, map coordinates
- `src/lib/menu.ts` — packages, prices, à la carte items, house rules

The address, phone number and hours are also fed to Google as structured data.
Publishing wrong ones there is worse than publishing none.

[`GOLIVE.md`](GOLIVE.md) Phase A lists every placeholder field and what each one
feeds, so none get missed.

## What is already secure, and why

Security was not left to the end — the foundational pieces are in the scaffold.

**Security headers** (`next.config.ts`) — HSTS so the browser refuses plain
http after the first visit; `X-Frame-Options: DENY` so the staff portal cannot
be iframed and clickjacked; `nosniff`; a locked-down `Permissions-Policy`.

**Content-Security-Policy with a per-request nonce** (`src/proxy.ts`) — the
interesting one. A static `script-src 'self'` looks strict but breaks the App
Router, because Next boots React from inline `<script>` tags; the browser
blocks them, hydration never runs, and the reservation form becomes dead HTML.
This project hit exactly that and the screenshots proved it. The tempting fix,
`'unsafe-inline'`, throws away the main thing a CSP does. The real fix is a
nonce: a fresh random token per response, stamped on the scripts we trust.
Injected script tags cannot guess it.

The cost is stated honestly in that file — a nonce is per-response, so pages
using one render per request instead of being served from a build-time cache.

**One validation schema, run twice** (`src/lib/reservation.ts`) — the browser
runs it for friendly errors as the guest types. That is UX and can be bypassed
by anyone with dev tools. `/api/reservations` imports the *same schema* and
re-runs it on the request it actually received, and that run is the one that
protects the database. The endpoint then stores the schema's **output**, not the
body it was sent — trimmed, coerced, unknown keys dropped. Handing the raw body
onward after validating it is a quietly common way to undo the validation you
just did.

**Honeypot field** — a hidden input a real guest never sees, that bots fill in.
A filled honeypot gets the same cheerful `201` a real booking gets, and is
silently dropped without touching the database. Telling a bot it was caught
teaches whoever wrote it to stop filling the field; success teaches them
nothing.

**Rate limiting in Postgres** (`check_rate_limit` in `schema.sql`) — not in a
JavaScript variable, because on Vercel each serverless instance has its own
memory and a bot that trips an in-memory limit just lands on a fresh instance.
An in-memory limiter on serverless is a limiter that does not limit. The counter
is one atomic `INSERT … ON CONFLICT DO UPDATE`; the naive read-then-write races
under exactly the burst it exists to stop. Verified with 30 concurrent
connections against a limit of 10 — exactly 10 got through.

**IPs are salted and hashed, never stored** — the limiter only needs to know
"same caller as before?", and a hash answers that while leaving the database
holding no record of who visited. Unsalted would be pointless: there are only
four billion IPv4 addresses, so a plain SHA-256 is reversible in seconds.

**Trusting the right header** — `x-forwarded-for` is client-supplied and can say
anything. Taking its leftmost value blindly lets an attacker use a fresh fake
address per request and never hit the cap. On Vercel, `x-vercel-forwarded-for`
is set by the platform, so that is what we prefer.

**Errors that say nothing useful to an attacker** — a failed insert returns one
sentence; the real error, full of table and constraint names, goes to the server
log. The endpoint also refuses non-JSON content types, caps the body at 8 KB
before parsing, and checks the real size rather than the `content-length` the
caller claims.

**Timezone-correct date handling** — "is this date in the past?" is answered in
`Asia/Manila`, not in the server's UTC. Otherwise a 9pm booking made in Manila
gets rejected as yesterday's.

**No secrets in the bundle** — see `.env.example`. The service-role key bypasses
Row Level Security completely and must never carry a `NEXT_PUBLIC_` prefix.

**Row Level Security** (`supabase/schema.sql`) — the piece that makes the rest
real. Every table denies by default, so what a role can do is exactly what a
policy says and nothing else. A customer with the public key and dev tools open
still cannot read one reservation, because the database refuses before any of
our code runs.

Three gaps in the spec's own policies are fixed there and marked ✱: the public
insert was unbounded enough to let anyone file a pre-confirmed booking; crew had
no UPDATE policy at all and so could not do the one job crew exists for; and
phone-number masking moved from React into a SQL view, because a UI mask lasts
only until someone opens the network tab.

**Tested, not asserted** — two suites, both offline and both fast.
`npm run db:test` builds a scratch database, applies the real schema and runs 43
assertions covering the spec's §9 checklist, impersonating each role the way a
real request does. `npm test` drives the reservation endpoint, sign-in, the
dashboard's role rules, Turnstile and the CSP itself through 126 cases,
most of which check that something did *not* happen — the honeypot request never
reached the database, the oversized body was never parsed, the pre-confirmed
payload never got through. Those are the paths clicking around never exercises,
which is why they are the ones that rot.

Both suites have caught real bugs in this project, listed in the commit
messages.

**No self-service roles** — there is no insert policy on `profiles`, so no
request from any browser with any key creates a host or an owner. Accounts are
made with `npm run staff:create`, which is the one deliberate, human-run use of
the service key.

**`getUser()`, never `getSession()`, on the server** (`src/lib/auth/session.ts`)
— `getSession()` hands back whatever the cookie claims, unverified. The cookie
comes from the network, and anyone can send a cookie. `getUser()` revalidates the
token with the Auth server, and it is the only one of the two that can carry an
access decision.

**Sign-in runs on the server** (`src/app/portal/actions.ts`) — the easy version
calls Supabase straight from the browser, which means our server never sees the
attempt and there is nowhere to put a rate limit. §6 asks for one on the login
endpoint, and you cannot limit a request that does not pass through you.

**Login is limited by IP *and* by email** — checking only the first leaves the
owner's account open to many machines each staying under the per-IP cap. This
limiter fails **closed**, unlike the booking form: it and Supabase Auth are the
same service, so if the check cannot reach the database the sign-in was going to
fail anyway. We give up a case that was already lost, and an outage never becomes
an unlimited window for guessing passwords.

**One failure message** — "no such account" and "wrong password" as separate
sentences is a free tool for finding out which staff addresses are real. Both say
the same thing, and the provider's own error text never reaches the browser.

**The session cookie is `httpOnly`** (`src/lib/supabase/cookie-options.ts`) —
Supabase ships it readable by JavaScript so its browser client can use it. This
project signs in through a server action and renders the portal on the server, so
nothing in the browser needs to read the session — which means we can take the
hardening and put the cookie out of reach of any XSS. A stolen session is worse
than a stolen password, because it skips the login entirely.

**The dashboard asks the database what this caller may see** — `getDashboard`
takes no `role` parameter. It selects from `staff_reservations` with the caller's
own session, and the view masks phone numbers in SQL, so a crew session never
receives the digits at all. Reading the base table and declining to render the
column would have put every guest's number in the page source of a page that
merely chose not to show it.

**The status-change action does not check the caller's role** — on purpose. A
server action is a public HTTP endpoint, so an `if (role === 'crew') reject`
there would be a second copy of a rule that already lives in the policies, and
two copies drift. It issues the UPDATE and lets Postgres answer; `.select()` on
the end makes a refusal visible, because an update blocked by a `using` clause is
not an error, it just matches zero rows. Verified by logging in as crew,
injecting a cancel button the UI never draws, and clicking it — the booking did
not change.

**Three layers on the dashboard, and only one of them counts** — the proxy
redirects, the page calls `requireStaff()` for itself in case a path is ever left
out of the matcher, and Row Level Security decides what the data actually is. The
first two exist to show people a sensible page; the third is what makes the
answer safe.

**No open redirect** — `?next=` exists so a bounce through the login lands you
where you were going, and unchecked it sends staff to a lookalike site the
instant they sign in, when they are least suspicious. Paths are resolved with the
URL parser and then checked, which catches `//evil.example`, a backslash prefix,
`javascript:` and `/portal/../../etc/passwd` alike — the last of which got past
the first, string-matching version.

**SEO that cannot drift from the content** — `robots.ts`, `sitemap.ts`, the
favicon and the Open Graph image are all generated from the same
`restaurant.ts`, so changing the restaurant's name updates the social card too.
The share image matters more than it sounds for a place in Cavite: on Facebook
and Messenger it is the entire first impression, and without one the link is a
grey box.

One thing `robots.txt` is *not*: `Disallow: /portal` keeps the staff pages out
of Google and does nothing whatsoever to stop someone typing the URL. It is a
request to well-behaved crawlers. What protects the portal is the login and
Row Level Security — if robots.txt were the only thing in the way, the
reservations would already be public.

**Bot protection, two layers** (`src/lib/turnstile.ts`) — the honeypot is free,
invisible and stops commodity spam bots. Cloudflare Turnstile costs a round trip
and can occasionally make a real guest click something, but it stops the bot
written for *this* form that knows to leave the honeypot alone. Turnstile is
optional: with no keys set, the widget does not render and bookings still work.
A security feature that breaks the product when unconfigured gets removed rather
than configured.

**The CSP detail that would have wasted an afternoon** — `'strict-dynamic'`
makes browsers **ignore host allowlists in `script-src` entirely**. Adding
`https://challenges.cloudflare.com` there does nothing at all. The widget script
is allowed because it is injected by Next's own already-trusted bundle, and
under `'strict-dynamic'` that trust is inherited. `frame-src` is a normal host
list, so Cloudflare *is* named there for the challenge iframe — and only when
Turnstile is switched on. Verified in a browser: the script is fetched with no
nonce of its own and no CSP refusal.

### The §6 checklist, honestly

| Item | State |
| --- | --- |
| HTTPS everywhere | Automatic on Vercel; HSTS set so the browser insists |
| Never trust the client | Every rule re-checked on the server or in RLS |
| Secrets in env vars | ✅ and the service key throws if read in a browser |
| Parameterized queries | ✅ via the Supabase client; no string-built SQL |
| Server-side validation | ✅ one Zod schema, run again on the request |
| Rate limit bookings + login | ✅ in Postgres, so it works across instances |
| Bot protection | ✅ honeypot always, Turnstile when configured |
| Escape all output | ✅ and `react/no-danger` is a lint **error** |
| Security headers | ✅ CSP with a nonce, HSTS, frame options, and tests |
| Least privilege | ✅ no policy lets anyone create a staff role |
| Audit trail | ✅ trigger-written and append-only |
| Strong password policy | ⚠️ **partly** — see below |

The password item is the one that is not fully done, and it is worth saying so
rather than ticking it. Supabase handles hashing (bcrypt) and `staff:create`
generates a 24-byte random password, so nobody picks a weak one at setup. But
minimum-strength rules and leaked-password checks are **dashboard settings** in
Supabase (Authentication → Policies) that this repo cannot set for you, and
there is no forced rotation after the first sign-in. Turn those on when you
create the project.

Two more things this project does not do, listed so they are decisions rather
than oversights: there is no email confirmation flow for staff (accounts are
created already confirmed, because the owner hands the password over in person),
and a guest whose browser blocks Cloudflare will not be able to submit the form
once Turnstile is on — the phone number on the page is the fallback.

## Layout

```
src/
  app/
    layout.tsx        fonts, metadata, JSON-LD, reads the CSP nonce
    page.tsx          the public landing page
    api/reservations/route.ts   POST — a thin adapter over handler.ts
    portal/           sign-in, server actions, and the dashboard
    robots.ts         robots.txt
    sitemap.ts        sitemap.xml
    icon.tsx          generated favicon
    opengraph-image.tsx  generated social card
    globals.css       design tokens (Tailwind v4 @theme)
  components/         one file per section of the landing page
  lib/
    restaurant.ts     business details + Schema.org markup   ⚠️ placeholders
    menu.ts           packages, à la carte, house rules      ⚠️ placeholders
    reservation.ts    the shared Zod schema
    csp.ts            the Content-Security-Policy, as testable data
    site.ts           one canonical origin, shared by four consumers
    rate-limit.ts     client IP, salted hashing, the limit check
    turnstile.ts      Cloudflare verification, optional by design
    auth/
      login.ts        sign-in logic, with side effects injected
      session.ts      getUser() + profile lookup; requireStaff()
    reservations/
      handler.ts      the endpoint's logic, with side effects injected
      insert.ts       the write — anon key, so RLS still judges it
      status.ts       what each role may do; the UI's mirror of the policies
      dashboard.ts    the day's bookings, read through the masked view
    format.ts         peso formatting
    supabase/
      env.ts          reads the keys; the dangerous one throws in the browser
      server.ts       server client, plus the RLS-bypassing admin client
      cookie-options.ts  httpOnly/secure/sameSite on the session cookie
      types.ts        database types
  proxy.ts            per-request CSP nonce
supabase/
  schema.sql          tables, policies, triggers, the masked staff view
  verify-rls.sql      43 policy tests
  local/              Supabase shim so the tests run without a project
tests/                          npm test — 132 in total
  reservation-handler.test.ts   35
  login.test.ts                 31
  reservation-status.test.ts    28
  csp.test.ts                   24
  turnstile.test.ts             14
scripts/
  create-staff.mjs    the only way an account gets a role
  db-test.sh          npm run db:test
```

## Design tokens

| Token | Value | Use |
| --- | --- | --- |
| `paper` | `#FBF6EF` | page ground |
| `lacquer` | `#B01E24` | brand accent, buttons, prices |
| `sumi` | `#17130F` | body text, dark panels |
| `gold` | `#C9A24B` | decoration, and text **on sumi only** |

Gold on paper is roughly 2.2:1 contrast — well under the 4.5:1 that WCAG AA
wants for body text. So gold is used for hairlines and dividers on light
backgrounds, and only becomes text on the dark sumi panels, where it reaches
7.4:1.

Fonts are Fraunces (display) and Hanken Grotesk (body), self-hosted by
`next/font` at build time. No visitor's browser ever calls Google Fonts, which
means no third party gets a log of who visits, and `font-src 'self'` can stay
strict.
