# Hiroshi Master Grill Samgyupsal — Production Build Spec (for Claude Code)

This is the blueprint for the **real, secure** version of the site (the demo shows what it looks like; this builds what protects it). Open Claude Code, drop this file in the project root, and use the kickoff prompt at the bottom.

---

## 1. What we're building

A restaurant web app with two faces:

- **Public site** (anyone): branding, unli menu, rice & ramen menu, house rules, location, and a **reservation request form**. No login needed.
- **Staff portal** (login required): a dashboard where crew, host, and owner view and manage reservations, with **different permissions per role**.

## 2. Recommended stack — and *why*

| Layer | Choice | Why this one |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Server-rendered pages = strong SEO for "samgyupsal General Trias"; API routes give you a backend without a second server; deploys free to Vercel. |
| Styling | **Tailwind CSS** | Fast, consistent; port the demo's tokens (colors/fonts) straight in. |
| Backend + DB + Auth | **Supabase** (Postgres + Auth + Row Level Security) | This is the key decision. Supabase gives you secure login, password hashing, and — most importantly — **Row Level Security**, which enforces "customers can't read reservations" *at the database level*, not just in the UI. You do not hand-roll authentication (that's where beginners get hacked). |
| Hosting | **Vercel** | One-command deploy, automatic HTTPS, environment variables for secrets. |

> **Why not build auth yourself?** Writing your own password hashing, session tokens, and access checks is the single most common place student projects get breached. Supabase Auth is built by security engineers and audited. Using it is the *professional* choice, not a shortcut.

## 3. The three roles (RBAC)

| Role | Who | Can do |
|---|---|---|
| `customer` | the public | View menus, submit a reservation request. No account required. |
| `crew` | floor staff | View reservations; mark **Confirmed** / **Seated**. **Cannot** see full contact numbers or cancel. |
| `host` | owner's brother (front desk) | Everything crew can, **plus** see contacts, cancel/edit bookings. |
| `owner` | the owner | Everything host can, **plus** a daily summary (covers, pending count). |

Role lives in a `profiles` table linked to the Supabase auth user. Every data rule below is keyed off it.

## 4. Data model

```sql
-- profiles: one row per staff login, holds their role
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null check (role in ('crew','host','owner')),
  created_at timestamptz default now()
);

-- reservations: created by the public, read/managed by staff
create table reservations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  reserve_date date not null,
  reserve_time time not null,
  party_size int not null check (party_size between 1 and 30),
  package text,
  notes text,
  status text not null default 'pending' check (status in ('pending','confirmed','seated','cancelled')),
  created_at timestamptz default now()
);
```

## 5. Row Level Security — the heart of the security model

RLS is Postgres saying "no" before your code even runs. Enable it and write policies:

```sql
alter table reservations enable row level security;
alter table profiles enable row level security;

-- Anyone (even logged-out) may CREATE a reservation request...
create policy "public can request" on reservations
  for insert to anon, authenticated with check (true);

-- ...but ONLY logged-in staff may READ them.
create policy "staff can read" on reservations
  for select to authenticated
  using (exists (select 1 from profiles where profiles.id = auth.uid()));

-- Only host/owner may UPDATE or DELETE.
create policy "host owner manage" on reservations
  for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('host','owner')));

create policy "host owner delete" on reservations
  for delete to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('host','owner')));

-- Each staff member can read only their own profile row.
create policy "read own profile" on profiles
  for select to authenticated using (id = auth.uid());
```

With these in place, a customer literally *cannot* fetch the reservations table even if they open dev tools and try — the database refuses. That's defense that doesn't depend on your UI hiding a button.

> Note: hiding the phone number from `crew` is a UI concern (show a masked value), because RLS controls whole rows, not columns. For true column-level hiding, expose crew reads through a Postgres **view** that omits `contact`, or a security-definer RPC. Keep it simple for v1: mask it in the UI and gate the un-masked value behind a host/owner-only API route.

## 6. Security checklist (your "lots of securities")

Foundational — do all of these:
- [ ] **HTTPS everywhere** — automatic on Vercel; never serve the portal over http.
- [ ] **Never trust the client** — every permission is re-checked on the server / in RLS, never only in React.
- [ ] **Secrets in environment variables** — Supabase service-role key lives only in server code / Vercel env vars, *never* in the browser bundle. The browser only ever uses the public "anon" key.
- [ ] **Parameterized queries** — the Supabase client does this for you; never build SQL by string concatenation. (Stops SQL injection.)
- [ ] **Input validation on the server** — validate the reservation payload with a schema (e.g. **Zod**) in the API route: types, lengths, date not in the past, party size 1–30. Client validation is UX; server validation is security.
- [ ] **Rate limit the reservation endpoint and login** — cap requests per IP (e.g. Upstash rate limit) so bots can't spam bookings or brute-force passwords.
- [ ] **Bot protection on the public form** — a honeypot field + optional Cloudflare Turnstile/CAPTCHA.
- [ ] **Strong password policy + lockout** — Supabase handles hashing (bcrypt) and can enforce minimum strength; enable email confirmation for staff accounts.
- [ ] **Escape all output** — React escapes by default; never use `dangerouslySetInnerHTML` with user text (stops stored XSS).
- [ ] **Security headers** — set CSP, X-Frame-Options, HSTS via `next.config.js` headers.
- [ ] **Least privilege** — staff accounts are created by the owner/you, not self-signup; no public route creates a `host`/`owner`.
- [ ] **Audit trail (nice-to-have)** — log who changed a reservation's status and when.

## 7. Page / route plan

```
/                         public landing (hero, menu, rules, reserve, visit)
/api/reservations  POST   validate + insert reservation (server)
/portal            login  Supabase Auth sign-in
/portal/dashboard  auth   reservations table, role-aware controls
```

## 8. Suggested build order (milestones)

1. Scaffold Next.js + Tailwind; port the demo's design tokens and public sections (menu, rules, visit).
2. Stand up Supabase; create tables + enable RLS + policies above.
3. Wire the public reservation form → `/api/reservations` (with Zod validation + rate limit).
4. Build Supabase Auth login at `/portal`.
5. Build `/portal/dashboard`: fetch reservations, render role-aware actions, owner summary tiles.
6. Add security headers, honeypot/Turnstile, and test each role can only do what it should.
7. Add SEO (metadata, JSON-LD Restaurant schema — copy from the demo's `<head>`), then deploy to Vercel.

## 9. Test the roles before you demo

For each of crew / host / owner, confirm:
- Logged-out user hitting the reservations API read → **denied**.
- Crew → sees list, can confirm/seat, **cannot** cancel, contact masked.
- Host → can cancel, sees contacts.
- Owner → sees summary tiles.

---

## Kickoff prompt for Claude Code

> I'm building a restaurant reservation web app for Hiroshi Master Grill Samgyupsal (an unli samgyupsal place in General Trias, Cavite). Use **Next.js (App Router) + TypeScript + Tailwind + Supabase (Auth + Postgres + Row Level Security)**, deploying to Vercel. Follow the attached `hiroshi-build-spec.md` exactly — the data model, the RLS policies, the three staff roles (crew/host/owner), and the security checklist are all defined there. Start with milestone 1 (scaffold + port the public site design tokens: warm paper `#FBF6EF`, lacquer red `#B01E24`, sumi `#17130F`, gold `#C9A24B`; fonts Fraunces + Hanken Grotesk), then pause so I can review before we wire up Supabase. Explain each step as you go — I'm a 4th-year IT student and I want to understand the security decisions, not just copy them.
